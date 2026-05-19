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
}

export interface AggregatorHandlers {
  onCreate(snap: any, ctx: any): Promise<void>
  onUpdate(change: any, ctx: any): Promise<void>
  onDelete(snap: any, ctx: any): Promise<void>
  backfill(): Promise<{
    linked: number
    skipped: number
    pruned: number
    competitions: number
  }>
}

function appearanceKey(ctx: AppearanceCtx): string {
  return ctx.recordId === null
    ? ctx.competitionId
    : `${ctx.competitionId}:${ctx.recordId}`;
}

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
  } = config;
  const slimFields = config.slimFields ?? (() => ({}));

  const buildIndexEntry = (id: string, agg: any) => ({
    id,
    name: agg.name ?? '',
    appearanceCount: agg.appearanceCount ?? 0,
    ...slimFields(agg),
  });

  const identityKey = config.identityKey ?? ((r: R) => normalizeName(nameOf(r)));
  const identityKeyFromAppearance =
    config.identityKeyFromAppearance
    ?? ((a: A) => (nameFromAppearance ? normalizeName(nameFromAppearance(a)) : ''));

  // A record only contributes if it passes the predicate AND has a display
  // name. Folding the name check in here ensures that clearing a name (e.g.
  // both firstName and lastName set to '') is treated as "no longer matches"
  // and the old appearance gets unlinked.
  const matches = (r: R | null | undefined): r is R =>
    !!r && predicate(r) && !!nameOf(r);

  const iterate =
    config.iterate ??
    (async (innerDb: any, competitionId: string) => {
      if (!sectionName) return [];
      const records = (await innerDb
        .child(`competitions:data/${competitionId}/${sectionName}`)
        .get()).val() || {};
      return Object.entries(records) as Array<[string, R]>;
    });

  async function findOrCreateAggregate(record: R): Promise<string | null> {
    const key = identityKey(record);
    if (!key || key.startsWith('|') || key.endsWith('|')) return null;
    const indexRef = db.child(`${namespace}:index/${key}`);
    const existing = (await indexRef.get()).val();
    // Legacy entries stored a bare id string; new entries are objects with `.id`.
    const existingId =
      typeof existing === 'string'
        ? existing
        : typeof existing?.id === 'string'
          ? existing.id
          : null;
    if (existingId) return existingId;
    // Race: concurrent writes for the same key may create orphans. Pruned by
    // recompute when the last appearance is removed.
    const newRef = db.child(namespace).push();
    const id = newRef.key as string;
    const seed = seedAggregate?.(record) ?? {};
    // `_identity` is stored so we can remove the right /{ns}:index entry when
    // the last appearance unlinks. Re-deriving from the aggregate's denormed
    // fields is fragile (some are renamed: firstName/lastName → name).
    const initialAgg = {
      ...seed,
      name: nameOf(record),
      _identity: key,
      appearanceCount: 0,
    };
    await newRef.set(initialAgg);
    await indexRef.set(buildIndexEntry(id, initialAgg));
    return id;
  }

  async function recomputeAggregate(entityId: string) {
    const aggRef = db.child(`${namespace}/${entityId}`);
    const aggSnap = await aggRef.get();
    const agg = aggSnap.val();
    if (!agg) return;
    const apps = (agg.appearances || {}) as Record<string, A>;
    const list = Object.values(apps);
    const count = list.length;

    // Lazy migration: aggregates created before `_identity` existed can derive
    // it from their first appearance (the appearance carries the same fields
    // identity is built from). Captured *before* the empty-check so cleanup
    // can use it even when this is the last unlink.
    let identity = agg._identity as string | undefined;
    if (!identity && list.length) {
      const derived = identityKeyFromAppearance(list[0]);
      if (derived) identity = derived;
    }

    if (count === 0) {
      await aggRef.remove();
      if (identity) await db.child(`${namespace}:index/${identity}`).remove();
      return;
    }

    const refreshed = recomputeFromAppearances
      ? recomputeFromAppearances(list)
      : { name: nameFromAppearance?.(list[0]) || agg.name || '' };
    const update: Record<string, unknown> = { ...refreshed, appearanceCount: count };
    if (!agg._identity && identity) update._identity = identity;
    await aggRef.update(update);

    if (identity) {
      const merged = { ...agg, ...update };
      await db
        .child(`${namespace}:index/${identity}`)
        .set(buildIndexEntry(entityId, merged));
    }
  }

  async function linkAppearance(entityId: string, ctx: AppearanceCtx, record: R) {
    const key = appearanceKey(ctx);
    await db
      .child(`${namespace}/${entityId}/appearances/${key}`)
      .set(toAppearance(record, ctx));
    await recomputeAggregate(entityId);
  }

  async function unlinkAppearance(entityId: string, ctx: AppearanceCtx) {
    const key = appearanceKey(ctx);
    await db.child(`${namespace}/${entityId}/appearances/${key}`).remove();
    await recomputeAggregate(entityId);
  }

  async function setBackPointer(snap: any, entityId: string | null) {
    const current = (snap.val() as any)?.[backPointerField] ?? null;
    if (current === entityId) return;
    await snap.ref.update({ [backPointerField]: entityId });
  }

  function ctxFor(params: any): AppearanceCtx {
    return {
      competitionId: params.competitionId,
      recordId: recordIdParam ? params[recordIdParam] : null,
    };
  }

  async function maintainOnWrite(snap: any, params: any, prev: R | null) {
    const record = snap.val() as R | null;
    const ctx = ctxFor(params);
    const wasMatch = matches(prev);
    const isMatch = matches(record);

    if (wasMatch && !isMatch) {
      const oldId = (prev as any)?.[backPointerField];
      if (oldId) {
        await unlinkAppearance(oldId, ctx);
        await setBackPointer(snap, null);
      }
      return;
    }
    if (!isMatch || !record) return;

    const newKey = identityKey(record);
    const oldKey = wasMatch && prev ? identityKey(prev) : '';
    const oldId: string | undefined = (prev as any)?.[backPointerField];

    if (oldId && oldKey === newKey) {
      await linkAppearance(oldId, ctx, record);
      return;
    }
    if (oldId && oldKey !== newKey) {
      await unlinkAppearance(oldId, ctx);
    }
    const newId = await findOrCreateAggregate(record);
    if (!newId) return;
    await linkAppearance(newId, ctx, record);
    await setBackPointer(snap, newId);
  }

  return {
    async onCreate(snap, ctx) {
      if (isCypress()) return;
      await maintainOnWrite(snap, ctx.params, null);
    },
    async onUpdate(change, ctx) {
      if (isCypress()) return;
      await maintainOnWrite(change.after, ctx.params, change.before.val() as R);
    },
    async onDelete(snap, ctx) {
      if (isCypress()) return;
      const record = snap.val() as R | null;
      if (!matches(record)) return;
      const entityId = (record as any)?.[backPointerField];
      if (!entityId) return;
      await unlinkAppearance(entityId, ctxFor(ctx.params));
    },
    async backfill() {
      // Idempotent: preserves existing aggregate push keys across runs by
      // re-using whatever the index already points at. Replaces each touched
      // aggregate's `appearances` map atomically with the current source-of-
      // truth, then prunes aggregates whose source records no longer exist.
      //
      // Back-pointer writes are intentionally skipped: each would re-fire the
      // source trigger and overwhelm the emulator. Live triggers populate the
      // back-pointer on the next legitimate edit. Reverse lookup uses
      // /{namespace}:index in the meantime.
      const competitions = (await db.child('competitions').get()).val() || {};
      const compIds = Object.keys(competitions);
      const newAppearancesByEntity = new Map<string, Record<string, A>>();
      let linked = 0;
      let skipped = 0;
      for (const competitionId of compIds) {
        const records = await iterate(db, competitionId, competitions[competitionId]);
        for (const [recordId, record] of records) {
          if (!matches(record)) {
            skipped += 1;
            continue;
          }
          const entityId = await findOrCreateAggregate(record);
          if (!entityId) {
            skipped += 1;
            continue;
          }
          const ctx: AppearanceCtx = { competitionId, recordId };
          const bucket = newAppearancesByEntity.get(entityId) ?? {};
          bucket[appearanceKey(ctx)] = toAppearance(record, ctx);
          newAppearancesByEntity.set(entityId, bucket);
          linked += 1;
        }
      }
      // Replace each touched aggregate's appearances atomically + recompute.
      for (const [entityId, apps] of newAppearancesByEntity) {
        await db.child(`${namespace}/${entityId}/appearances`).set(apps);
        await recomputeAggregate(entityId);
      }
      // Sweep aggregates whose source is gone — empty their appearances, then
      // recomputeAggregate's count===0 branch removes the agg + index entry.
      const existing = (await db.child(namespace).get()).val() || {};
      let pruned = 0;
      for (const entityId of Object.keys(existing)) {
        if (newAppearancesByEntity.has(entityId)) continue;
        await db.child(`${namespace}/${entityId}/appearances`).set({});
        await recomputeAggregate(entityId);
        pruned += 1;
      }
      return { linked, skipped, pruned, competitions: compIds.length };
    },
  };
}
