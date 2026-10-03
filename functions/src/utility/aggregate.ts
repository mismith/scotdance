// Generic entity-aggregator factory.
//
// All four first-class entities (judges, pipers, dancers, venues) share the
// same mechanics: a per-comp source record is the truth, a trigger maintains
// a top-level aggregate node + an index for dedupe by name, and a back-pointer
// on the source record points at the aggregate. Differences are captured by
// the config — source path layout, identity key shape, denormed appearance
// fields, optional locality-style recompute.
//
// See docs/adr/0003-first-class-entities.md for the design and
// docs/aggregators.md for the runtime flow.

import { isCypress } from './env';
import { normalizeName } from './normalize';

export interface AppearanceCtx {
  competitionId: string
  /** Push key of the per-comp record. null for single-per-comp entities (venues). */
  recordId: string | null
}

export interface AggregatorConfig<R, A extends Record<string, any>> {
  /** Aggregate RTDB namespace, e.g. 'judges' / 'venues'. */
  namespace: string
  /**
   * Trigger param name for the per-comp record id (e.g. 'staffId', 'dancerId').
   * null for venues, where the trigger fires on the comp meta itself.
   */
  recordIdParam: string | null
  /** Back-pointer field name written onto the source record. */
  backPointerField: string
  /** True when this record contributes to this aggregator. */
  predicate: (record: R | undefined | null) => boolean
  /** Display name for the aggregate's `name` field. Empty string ⇒ skip. */
  nameOf: (record: R) => string
  /**
   * Recompute the display `name` from an appearance (used by the default
   * recompute path). If omitted, the aggregate's existing `name` is preserved.
   * Venues set `recomputeFromAppearances` instead and don't need this.
   */
  nameFromAppearance?: (appearance: A) => string
  /**
   * Index key. Default: normalize(nameOf(record)). Override for composite
   * identity (e.g. venues use `name|locality`).
   */
  identityKey?: (record: R) => string
  /**
   * Same as `identityKey` but reading from an appearance — used by the lazy
   * `_identity` migration for aggregates created before the field existed.
   * If omitted, falls back to normalize over `nameFromAppearance`.
   */
  identityKeyFromAppearance?: (appearance: A) => string
  /** Extra fields written into the aggregate on first creation. */
  seedAggregate?: (record: R) => Record<string, unknown>
  /**
   * Extra fields projected into the slim `/{namespace}:index/{key}` entry.
   * The list view reads `:index` so it can render without pulling each
   * aggregate's full `appearances` map. Defaults to none — index entries
   * always include `id`, `name`, `appearanceCount`.
   */
  slimFields?: (agg: any) => Record<string, unknown>
  /** Per-appearance denorm. */
  toAppearance: (record: R, ctx: AppearanceCtx) => A
  /**
   * Recompute aggregate-level display fields from current appearances.
   * Venues override to pick latest-non-null locality/region/country sorted
   * by date. Default refreshes `name` via `nameFromAppearance`.
   */
  recomputeFromAppearances?: (apps: A[]) => Record<string, unknown>
  /**
   * Iterate the records to consider for backfill of a single competition.
   * Default scans `/competitions:data/{compId}/{sectionName}` — supply
   * `sectionName` instead of overriding `iterate` unless the layout differs.
   */
  iterate?: (
    db: any,
    competitionId: string,
    comp: any,
  ) => Promise<Array<[string | null, R]>>
  /** When `iterate` is not supplied, scan `competitions:data/{compId}/{sectionName}`. */
  sectionName?: string
  /**
   * Which competitions' records may show: the aggregates are world-readable.
   * Dancers wait for a competition to be published (its entries are private
   * until then: rules on competitions:data, and Manage says so); judges and
   * pipers show once it's listed. (Venues, whose record is the competition,
   * check that in their predicate.) Default: every competition. A change of
   * listing or publishing runs `syncCompetition`.
   */
  shownIn?: (comp: { published?: unknown, listed?: unknown }) => boolean
}

export interface AggregatorHandlers {
  onCreate(snap: any, ctx: any): Promise<void>
  onUpdate(change: any, ctx: any): Promise<void>
  onDelete(snap: any, ctx: any): Promise<void>
  /** Re-link every record of one competition (after it's listed, published or hidden again). */
  syncCompetition(competitionId: string): Promise<{ linked: number, unlinked: number }>
  backfill(): Promise<{
    linked: number
    skipped: number
    pruned: number
    competitions: number
  }>
  backfillBackPointers(opts?: { batchSize?: number }): Promise<{
    written: number
    cleared: number
    alreadySet: number
    unmatched: number
    competitions: number
    batches: number
  }>
}

/** An index entry's aggregate id: legacy entries are a bare string, new ones `{ id }`. */
export function indexedId(entry: unknown): string | null {
  if (typeof entry === 'string') return entry || null;
  const id = (entry as { id?: unknown } | null)?.id;
  return typeof id === 'string' && id ? id : null;
}

function appearanceKey(ctx: AppearanceCtx): string {
  return ctx.recordId === null
    ? ctx.competitionId
    : `${ctx.competitionId}:${ctx.recordId}`;
}

/** Usable as an index key: not empty, and (venues) neither half of `name|locality` missing. */
export function validKey(key: string): boolean {
  // RTDB refuses paths over 768 bytes, and one such key would fail a whole
  // backfill batch on every run: a name that long is junk, so skip it.
  return !!key && !key.startsWith('|') && !key.endsWith('|') && Buffer.byteLength(key) <= 300;
}

/** How many records the publish sync handles at once. */
const SYNC_CONCURRENCY = 10;

export function createAggregator<R, A extends Record<string, any>>(
  db: any,
  config: AggregatorConfig<R, A>,
): AggregatorHandlers {
  const {
    namespace,
    recordIdParam,
    backPointerField,
    predicate,
    nameOf,
    nameFromAppearance,
    toAppearance,
    seedAggregate,
    recomputeFromAppearances,
    sectionName,
    shownIn,
  } = config;
  const slimFields = config.slimFields ?? (() => ({}));

  const buildIndexEntry = (id: string, agg: any) => ({
    id,
    name: agg.name ?? '',
    appearanceCount: agg.appearanceCount ?? 0,
    ...slimFields(agg),
  });

  const identityKey = config.identityKey ?? ((r: R) => normalizeName(nameOf(r)));
  const identityKeyFromAppearance = config.identityKeyFromAppearance
    ?? ((a: A) => (nameFromAppearance ? normalizeName(nameFromAppearance(a)) : ''));

  const keyOf = (r: R): string => {
    const key = identityKey(r);
    return validKey(key) ? key : '';
  };
  // A record only contributes if it passes the predicate AND has a usable
  // name. Folding the name check in here ensures that clearing a name (e.g.
  // both firstName and lastName set to '') is treated as "no longer matches"
  // and the old appearance gets unlinked.
  const matches = (r: R | null | undefined): r is R => (
    !!r && typeof r === 'object' && predicate(r) && !!nameOf(r) && !!keyOf(r)
  );
  // Only an id-shaped pointer counts: the value becomes a path segment, so an
  // organiser typing "otherId/appearances" into their own record could
  // otherwise reach (and wipe) someone else's profile.
  const pointerOf = (r: unknown): string | null => {
    const v = (r as Record<string, unknown> | null)?.[backPointerField];
    return typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v) ? v : null;
  };
  const sameAppearance = (a: R, b: R, ctx: AppearanceCtx) => (
    JSON.stringify(toAppearance(a, ctx)) === JSON.stringify(toAppearance(b, ctx))
  );

  const iterate = config.iterate
    ?? (async (innerDb: any, competitionId: string) => {
      if (!sectionName) return [];
      const records = (await innerDb
        .child(`competitions:data/${competitionId}/${sectionName}`)
        .get()).val() || {};
      return Object.entries(records) as Array<[string, R]>;
    });

  /** The source record's path (relative to the data namespace). */
  function recordPath({ competitionId, recordId }: AppearanceCtx): string {
    // Venues: the record is the comp meta itself.
    if (recordId === null) return `competitions/${competitionId}`;
    if (!sectionName) {
      throw new Error(`${namespace}: records need a sectionName`);
    }
    return `competitions:data/${competitionId}/${sectionName}/${recordId}`;
  }

  async function included(competitionId: string): Promise<boolean> {
    if (!shownIn) return true;
    // One read, so a switch that sets both `listed` and `published` is seen whole.
    const comp = (await db.child(`competitions/${competitionId}`).get()).val();
    return !!comp && shownIn(comp);
  }

  const indexRef = (key: string) => db.child(`${namespace}:index/${key}`);

  async function lookup(key: string): Promise<string | null> {
    if (!key) return null;
    return indexedId((await indexRef(key).get()).val());
  }

  // Every write to an aggregate or index entry is a transaction: an aggregate
  // is changed and recounted in one step whatever else links to it at the
  // same moment, and an aggregate never takes over a name another one holds
  // (two writes adding the same new person at once, e.g. an import with
  // someone in two age groups, make one aggregate, not two), nor removes a
  // name it doesn't hold.
  // (A transaction's first try sees null when nothing is cached; answering
  // null to that makes the server send the real value for a second try.)

  /**
   * Run a transaction, trying again when the SDK cancels it because this same
   * process wrote there meanwhile (it rejects with 'set'): e.g. the publish
   * sync linking two entries of one dancer at once.
   */
  async function transact(
    ref: any,
    update: (current: any) => unknown,
  ): Promise<{ committed: boolean, snapshot: any }> {
    for (let attempt = 1; ; attempt += 1) {
      try {
         
        const result = await ref.transaction(update, undefined, false);
        return result;
      } catch (error) {
        if ((error as Error)?.message !== 'set' || attempt >= 5) throw error;
      }
    }
  }

  /** Point `key` at `id` unless another aggregate holds it. Returns the holder. */
  async function claimIndex(key: string, id: string, agg: any): Promise<string> {
    const { committed, snapshot } = await transact(indexRef(key), (cur: unknown) => {
      const holder = indexedId(cur);
      return holder && holder !== id ? undefined : buildIndexEntry(id, agg);
    });
    return committed ? id : (indexedId(snapshot.val()) ?? id);
  }

  /** Remove `key` from the index if `id` holds it. Whether it did. */
  async function releaseIndex(key: string, id: string): Promise<boolean> {
    let held = false;
    await transact(indexRef(key), (cur: unknown) => {
      if (cur === null) return null;
      held = indexedId(cur) === id;
      return held ? null : undefined;
    });
    return held;
  }

  // When an aggregate empties, its id is kept under its name in
  // /{namespace}:retired (admin-only, like everything not opened up in the
  // rules), so the same person coming back — a competition unpublished and
  // published again, dancers deleted and imported again — gets the same id,
  // and everyone following them still is.
  const retiredRef = (key: string) => db.child(`${namespace}:retired/${key}`);

  /**
   * The aggregate for a record's name, claiming the name for a new one (with
   * the id it had before, if any). The aggregate itself is created by the
   * first link (`seedFor`).
   */
  async function findOrCreateAggregate(record: R): Promise<string | null> {
    const key = keyOf(record);
    if (!key) return null;
    const existing = await lookup(key);
    if (existing) return existing;
    const retired = (await retiredRef(key).get()).val();
    const id = typeof retired === 'string' && retired ? retired : db.child(namespace).push().key as string;
    const holder = await claimIndex(key, id, { name: nameOf(record), appearanceCount: 0 });
    if (holder === id && id === retired) await retiredRef(key).remove();
    return holder;
  }

  /** Fields a new aggregate starts with. */
  const seedFor = (record: R) => ({ ...(seedAggregate?.(record) ?? {}), name: nameOf(record) });

  /**
   * Change an aggregate's appearances and recount it, in one transaction (so
   * appearances linked at the same moment are counted, and an aggregate is
   * only deleted while it's really empty), then update its index entry.
   */
  async function changeAggregate(
    entityId: string,
    edit: (apps: Record<string, A>) => void,
    { key = null, seed = {} }: { key?: string | null, seed?: Record<string, unknown> } = {},
  ) {
    let identity: string | null = null;
    const { snapshot } = await transact(db.child(`${namespace}/${entityId}`), (cur: any) => {
      const agg = cur && typeof cur === 'object' ? cur : seed;
      const apps = { ...(agg.appearances || {}) };
      edit(apps);
      const list = Object.values(apps) as A[];
      // `_identity` is stored so we can remove the right /{ns}:index entry
      // when the last appearance unlinks. Aggregates made before it existed
      // derive it from their first appearance.
       
      identity = agg._identity || key || (list.length ? identityKeyFromAppearance(list[0]) : '') || null;
      if (!list.length) return null;
      const refreshed = recomputeFromAppearances
        ? recomputeFromAppearances(list)
        : { name: nameFromAppearance?.(list[0]) || agg.name || '' };
      return {
        ...agg, ...refreshed, appearances: apps, _identity: identity, appearanceCount: list.length,
      };
    });
    if (!identity) return;
    const agg = snapshot.val();
    if (agg) await claimIndex(identity, entityId, agg);
    else if (await releaseIndex(identity, entityId)) await retiredRef(identity).set(entityId);
  }

  async function linkAppearance(entityId: string, ctx: AppearanceCtx, record: R) {
    const appearance = toAppearance(record, ctx);
    await changeAggregate(entityId, (apps) => {
       
      apps[appearanceKey(ctx)] = appearance;
    }, { key: keyOf(record), seed: seedFor(record) });
  }

  async function unlinkAppearance(entityId: string, ctx: AppearanceCtx) {
    await changeAggregate(entityId, (apps) => {
       
      delete apps[appearanceKey(ctx)];
    });
  }

  async function setBackPointer(ctx: AppearanceCtx, entityId: string | null) {
    // A transaction, so a record deleted meanwhile (an add that was undone
    // straight away) isn't brought back as an empty shell.
    await transact(db.child(recordPath(ctx)), (cur: any) => {
      if (cur === null) return null;
      if (typeof cur !== 'object' || pointerOf(cur) === entityId) return undefined;
      const next = { ...cur };
      if (entityId) next[backPointerField] = entityId;
      else delete next[backPointerField];
      return next;
    });
  }

  function ctxFor(params: any): AppearanceCtx {
    return {
      competitionId: params.competitionId,
      recordId: recordIdParam ? params[recordIdParam] : null,
    };
  }

  async function maintainOnWrite(record: R | null, prev: R | null, ctx: AppearanceCtx) {
    const pointer = pointerOf(record);
    const prevPointer = pointerOf(prev);
    const isMatch = matches(record);
    const wasMatch = matches(prev);
    const newKey = isMatch ? keyOf(record) : '';
    const oldKey = wasMatch ? keyOf(prev) : '';

    // Nothing the aggregate shows changed (e.g. this write was the back-pointer).
    if (isMatch && wasMatch && newKey === oldKey && pointer && sameAppearance(prev, record, ctx)) {
      if (pointer === prevPointer) return;
      // A new back-pointer: two quick edits can finish out of order and leave
      // a stale one, so check it against the index.
      if (pointer === await lookup(newKey)) return;
    }

    const inc = (isMatch || wasMatch) && await included(ctx.competitionId);
    // Where this record's appearance may be linked now. The back-pointer can
    // be missing (records the backfill linked before back-pointers were
    // written), so the old name's aggregate counts too.
    const linked = new Set([prevPointer, pointer].filter((id): id is string => !!id));
    if (inc && wasMatch && !prevPointer) {
      const id = await lookup(oldKey);
      if (id) linked.add(id);
    }
    const target = inc && isMatch ? await findOrCreateAggregate(record) : null;
     
    for (const id of linked) {
       
      if (id !== target) await unlinkAppearance(id, ctx);
    }
    if (target) await linkAppearance(target, ctx, record as R);
    if (record && pointer !== target) await setBackPointer(ctx, target);
  }

  /** Link (or unlink) one record as it stands, for the publish sync. */
  async function syncRecord(ctx: AppearanceCtx): Promise<'linked' | 'unlinked' | null> {
    // Read again: the list was read before the sync began, and the record may
    // have been renamed or deleted since (its own trigger deals with that).
    const record = (await db.child(recordPath(ctx)).get()).val() as R | null;
    if (!record) return null;
    const pointer = pointerOf(record);
    // Checked per record: listing then unlisting quickly runs two syncs at once.
    const target = matches(record) && await included(ctx.competitionId)
      ? await findOrCreateAggregate(record)
      : null;
    if (pointer && pointer !== target) await unlinkAppearance(pointer, ctx);
    if (target) await linkAppearance(target, ctx, record);
    if (pointer !== target) await setBackPointer(ctx, target);
    if (target) return 'linked';
    return pointer ? 'unlinked' : null;
  }

  /** Multi-path writes, sent in batches. */
  function batchWriter(size: number) {
    let updates: Record<string, unknown> = {};
    let count = 0;
    let batches = 0;
    async function flush() {
      if (!count) return;
      const batch = updates;
      updates = {};
      count = 0;
      await db.update(batch);
      batches += 1;
    }
    return {
      async set(path: string, value: unknown) {
        updates[path] = value;
        count += 1;
        if (count >= size) await flush();
      },
      flush,
      batches: () => batches,
    };
  }

  return {
    async onCreate(snap, ctx) {
      if (isCypress()) return;
      await maintainOnWrite(snap.val() as R | null, null, ctxFor(ctx.params));
    },
    async onUpdate(change, ctx) {
      if (isCypress()) return;
      await maintainOnWrite(
        change.after.val() as R | null,
        change.before.val() as R | null,
        ctxFor(ctx.params),
      );
    },
    async onDelete(snap, ctx) {
      if (isCypress()) return;
      const record = snap.val() as R | null;
      const actx = ctxFor(ctx.params);
      const ids = new Set<string>();
      const pointer = pointerOf(record);
      if (pointer) ids.add(pointer);
      else if (matches(record) && await included(actx.competitionId)) {
        const id = await lookup(keyOf(record));
        if (id) ids.add(id);
      }
       
      for (const id of ids) {
         
        await unlinkAppearance(id, actx);
      }
    },
    // The backfills walk every competition one at a time on purpose: running
    // them in parallel would flood RTDB with writes (and re-fire triggers).
     
    async syncCompetition(competitionId) {
      if (isCypress()) return { linked: 0, unlinked: 0 };
      // A deleted competition's records (if any are left) all unlink.
      const comp = (await db.child(`competitions/${competitionId}`).get()).val();
      const records = await iterate(db, competitionId, comp);
      let linked = 0;
      let unlinked = 0;
      // A few at a time: quick enough for a big competition, gentle on RTDB.
      for (let i = 0; i < records.length; i += SYNC_CONCURRENCY) {
        const done = await Promise.all(records.slice(i, i + SYNC_CONCURRENCY).map(
          ([recordId]) => syncRecord({ competitionId, recordId }),
        ));
        linked += done.filter((d) => d === 'linked').length;
        unlinked += done.filter((d) => d === 'unlinked').length;
      }
      return { linked, unlinked };
    },
    async backfill() {
      // Reads everything once, builds every aggregate in memory, and writes
      // them back in large multi-path batches: a round trip per record runs
      // far past a function's time limit at production size.
      //
      // Idempotent: aggregates keep their ids (from the index, or their own
      // `_identity` if the index entry went missing), each one's
      // `appearances` is replaced with the current source of truth, and
      // aggregates nothing links to any more are removed. Other fields on an
      // aggregate are left alone.
      //
      // Back-pointer writes are intentionally skipped here — that's
      // `backfillBackPointers`' job. Running them in one pass meant every
      // back-pointer write re-fired the source trigger and re-ran the full
      // recompute. The dedicated pass relies on the back-pointer-only
      // short-circuit in `maintainOnWrite` to keep amplification cheap.
      const competitions = (await db.child('competitions').get()).val() || {};
      const compIds = Object.keys(competitions);
      const existing: Record<string, any> = (await db.child(namespace).get()).val() || {};
      const index: Record<string, unknown> = (await db.child(`${namespace}:index`).get()).val() || {};
      const retired: Record<string, unknown> = (await db.child(`${namespace}:retired`).get()).val() || {};

      const idByKey = new Map<string, string>();
      for (const [key, entry] of Object.entries(index)) {
        const id = indexedId(entry);
        if (id && validKey(key)) idByKey.set(key, id);
      }
      for (const [id, agg] of Object.entries(existing)) {
         
        const key = agg?._identity;
        if (typeof key === 'string' && validKey(key) && !idByKey.has(key)) idByKey.set(key, id);
      }

      const built = new Map<string, { key: string, first: R, apps: Record<string, A> }>();
      let linked = 0;
      let skipped = 0;
      for (const competitionId of compIds) {
        const comp = competitions[competitionId];
        const records = await iterate(db, competitionId, comp);
        const inc = !shownIn || shownIn(comp ?? {});
        for (const [recordId, record] of records) {
          if (!inc || !matches(record)) {
            skipped += 1;
            continue;
          }
          const key = keyOf(record);
          let id = idByKey.get(key);
          // An id the index gave two names (left by an old rename) stays with one.
          if (id && built.has(id) && built.get(id)!.key !== key) id = undefined;
          if (!id) {
            const before = retired[key];
            id = typeof before === 'string' && before && !built.has(before) && !existing[before]
              ? before
              : db.child(namespace).push().key as string;
            idByKey.set(key, id);
          }
          const entry = built.get(id) ?? { key, first: record, apps: {} };
          const ctx: AppearanceCtx = { competitionId, recordId };
          entry.apps[appearanceKey(ctx)] = toAppearance(record, ctx);
          built.set(id, entry);
          linked += 1;
        }
      }

      const writer = batchWriter(1000);
      const builtKeys = new Set<string>();
      for (const [id, { key, first, apps }] of built) {
        const list = Object.values(apps);
        const prior = existing[id];
        const fields: Record<string, unknown> = {
          ...(prior ? {} : seedAggregate?.(first) ?? {}),
          ...(recomputeFromAppearances
            ? recomputeFromAppearances(list)
            : { name: nameFromAppearance?.(list[0]) || prior?.name || nameOf(first) }),
          _identity: key,
          appearanceCount: list.length,
        };
        await writer.set(`${namespace}/${id}/appearances`, apps);
        for (const [field, value] of Object.entries(fields)) {
          await writer.set(`${namespace}/${id}/${field}`, value ?? null);
        }
        await writer.set(`${namespace}:index/${key}`, buildIndexEntry(id, { ...prior, ...fields }));
        if (key in retired) await writer.set(`${namespace}:retired/${key}`, null);
        builtKeys.add(key);
      }
      // Names nobody has any more, and aggregates nothing links to.
      for (const key of Object.keys(index)) {
        if (!builtKeys.has(key)) await writer.set(`${namespace}:index/${key}`, null);
      }
      let pruned = 0;
      for (const [id, agg] of Object.entries(existing)) {
        if (built.has(id)) continue;
        await writer.set(`${namespace}/${id}`, null);
        // Keep the id for the name, if nobody else has the name now.
         
        const key = agg?._identity;
        if (typeof key === 'string' && validKey(key) && !builtKeys.has(key)) {
          await writer.set(`${namespace}:retired/${key}`, id);
        }
        pruned += 1;
      }
      await writer.flush();
      return {
        linked, skipped, pruned, competitions: compIds.length,
      };
    },
    async backfillBackPointers(opts?: { batchSize?: number }) {
      // Writes the back-pointer field (e.g. `judgeId`) onto every source record
      // that matches an existing aggregate but has it missing/stale, and
      // removes it from records that shouldn't link anywhere (a judge who
      // became a sponsor, a dancer in an unpublished competition). Prereq:
      // `backfill()` has run so /{namespace} + /{namespace}:index are populated.
      //
      // Each write fires the source trigger. The short-circuit in
      // `maintainOnWrite` makes those fires cheap (no appearance overwrite,
      // no aggregate recompute, one index read to confirm the new pointer).
      //
      // Writes are batched via multi-path `update()` calls (default 500 paths
      // per batch). Re-runs are cheap: `alreadySet` short-circuits anything
      // that already has the right pointer, so running this is effectively its
      // own preview.
      const batchSize = Math.max(1, Math.floor(Number(opts?.batchSize) || 500));

      // Read-only resolution: aggregate id is found via /{namespace}:index
      // keyed by identityKey(record). No aggregates are created here — if the
      // index has no entry, the record is `unmatched` (a signal the regular
      // backfill needs to run first).
      const rawIndex = ((await db.child(`${namespace}:index`).get()).val() as Record<string, unknown> | null) ?? {};
      const aggIdByKey = new Map<string, string>();
      for (const [key, val] of Object.entries(rawIndex)) {
        const id = indexedId(val);
        if (id) aggIdByKey.set(key, id);
      }

      const competitions = (await db.child('competitions').get()).val() || {};
      const compIds = Object.keys(competitions);

      let written = 0;
      let cleared = 0;
      let alreadySet = 0;
      let unmatched = 0;
      const writer = batchWriter(batchSize);

      for (const competitionId of compIds) {
        const comp = competitions[competitionId];
        const records = await iterate(db, competitionId, comp);
        const inc = !shownIn || shownIn(comp ?? {});
        for (const [recordId, record] of records) {
          const pointer = pointerOf(record);
          const path = `${recordPath({ competitionId, recordId })}/${backPointerField}`;
          if (!inc || !matches(record)) {
            if (pointer) {
              await writer.set(path, null);
              cleared += 1;
            }
            continue;
          }
          const targetId = aggIdByKey.get(keyOf(record));
          if (!targetId) {
            unmatched += 1;
            continue;
          }
          if (pointer === targetId) {
            alreadySet += 1;
            continue;
          }
          await writer.set(path, targetId);
          written += 1;
        }
      }
      await writer.flush();

      return {
        written,
        cleared,
        alreadySet,
        unmatched,
        competitions: compIds.length,
        batches: writer.batches(),
      };
    },
  };
   
}
