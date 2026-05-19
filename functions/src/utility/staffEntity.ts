// Bundle of Typesense + aggregator wiring for staff-type entities (judges,
// pipers). Judges and pipers are structurally identical — same staff source
// path, same denorm fields, same Typesense schema — so they share this
// factory and differ only by `staffType`, `namespace`, and `backPointerField`.

import { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';

import { isCypress } from './env';
import { ensureAdmin } from './competition';
import { getTypesense } from './typesense';
import { createAggregator, type AggregatorConfig } from './aggregate';

export interface StaffRecord {
  type?: string
  firstName?: string
  lastName?: string
  location?: string
  image?: string
  description?: string
}

export interface StaffAppearance {
  competitionId: string
  staffId: string | null
  firstName: string | null
  lastName: string | null
  image: string | null
  bio: string | null
  location: string | null
}

export interface StaffEntityConfig {
  /** Discriminator on `/staff/{id}.type`, e.g. 'Judge' or 'Piper'. */
  staffType: string
  /** Aggregate namespace + Typesense collection name, e.g. 'judges'. */
  namespace: string
  /** Back-pointer field written onto the source staff record. */
  backPointerField: string
}

function memberName(m: StaffRecord): string {
  return `${(m.firstName || '').trim()} ${(m.lastName || '').trim()}`.trim();
}

function staffDocId(competitionId: string, staffId: string) {
  return `${competitionId}:${staffId}`;
}

export function createStaffEntity(config: StaffEntityConfig) {
  const { staffType, namespace, backPointerField } = config;

  const schema: CollectionCreateSchema = {
    name: namespace,
    fields: [
      { name: '$competitionId', type: 'string', facet: true },
      { name: '$name', type: 'string', facet: true },
      { name: 'firstName', type: 'string', optional: true },
      { name: 'lastName', type: 'string', optional: true },
      { name: 'location', type: 'string', optional: true },
      {
        name: 'image', type: 'string', optional: true, index: false,
      },
    ],
  };

  const isMatch = (m: StaffRecord | null | undefined): m is StaffRecord =>
    !!m && m.type === staffType;

  function docFor(member: StaffRecord, ctx: { competitionId: string; staffId: string }) {
    return {
      id: staffDocId(ctx.competitionId, ctx.staffId),
      $competitionId: ctx.competitionId,
      $name: memberName(member),
      firstName: member.firstName,
      lastName: member.lastName,
      location: member.location,
      image: member.image,
    };
  }

  async function safeDelete(docId: string) {
    await getTypesense().collections(namespace).documents(docId).delete().catch(() => {});
  }

  const aggregatorConfig: AggregatorConfig<StaffRecord, StaffAppearance> = {
    namespace,
    sectionName: 'staff',
    recordIdParam: 'staffId',
    backPointerField,
    predicate: isMatch,
    nameOf: memberName,
    nameFromAppearance: (a) => `${(a.firstName || '').trim()} ${(a.lastName || '').trim()}`.trim(),
    toAppearance: (m, { competitionId, recordId }) => ({
      competitionId,
      staffId: recordId,
      firstName: m.firstName ?? null,
      lastName: m.lastName ?? null,
      image: m.image ?? null,
      bio: m.description ?? null,
      location: m.location ?? null,
    }),
    // Denorm name/image/location onto the agg root so the slim index can carry
    // them. "Latest" is approximate — first-non-null in appearance iteration
    // order, since appearances don't carry a date. Profile pages still do the
    // proper date-sorted pick client-side via comp meta.
    recomputeFromAppearances: (apps) => {
      const pick = <K extends keyof StaffAppearance>(f: K): StaffAppearance[K] | null => {
        const hit = apps.find((a) => a[f] != null && a[f] !== '');
        return hit ? hit[f] : null;
      };
      const firstName = pick('firstName') ?? '';
      const lastName = pick('lastName') ?? '';
      return {
        name: `${firstName} ${lastName}`.trim(),
        image: pick('image'),
        location: pick('location'),
      };
    },
    slimFields: (agg) => ({
      image: agg.image ?? null,
      location: agg.location ?? null,
    }),
  };

  function getOnCreate(db: any) {
    const agg = createAggregator(db, aggregatorConfig);
    return async function onCreate(snap: any, ctx: any) {
      if (isCypress()) return;
      const member = snap.val();
      if (isMatch(member)) {
        const { competitionId, staffId } = ctx.params;
        await getTypesense()
          .collections(namespace)
          .documents()
          .upsert(docFor(member, { competitionId, staffId }));
      }
      await agg.onCreate(snap, ctx);
    };
  }

  function getOnUpdate(db: any) {
    const agg = createAggregator(db, aggregatorConfig);
    return async function onUpdate(change: any, ctx: any) {
      if (isCypress()) return;
      const member = change.after.val();
      const prev = change.before.val();
      const { competitionId, staffId } = ctx.params;
      if (isMatch(member)) {
        await getTypesense()
          .collections(namespace)
          .documents()
          .upsert(docFor(member, { competitionId, staffId }));
      } else if (isMatch(prev)) {
        await safeDelete(staffDocId(competitionId, staffId));
      }
      await agg.onUpdate(change, ctx);
    };
  }

  function getOnDelete(db: any) {
    const agg = createAggregator(db, aggregatorConfig);
    return async function onDelete(snap: any, ctx: any) {
      if (isCypress()) return;
      const { competitionId, staffId } = ctx.params;
      if (isMatch(snap.val())) await safeDelete(staffDocId(competitionId, staffId));
      await agg.onDelete(snap, ctx);
    };
  }

  function getOnReindex(db: any) {
    return async function onReindex(_data: unknown, ctx: any) {
      await ensureAdmin(ctx, db);
      await getTypesense().collections(namespace).delete().catch(() => {});
      await getTypesense().collections().create(schema);
      const competitions = (await db.child('competitions').get()).val() || {};
      const documents: any[] = [].concat(...(await Promise.all(Object.keys(competitions).map(
        async (competitionId) => {
          const staff = (await db.child(`competitions:data/${competitionId}/staff`).get()).val() || {};
          return Object.entries(staff)
            .filter(([, member]) => isMatch(member as StaffRecord))
            .map(([staffId, member]) => docFor(member as StaffRecord, { competitionId, staffId })) as never;
        },
      ))));
      if (documents.length) {
        await getTypesense().collections(namespace).documents().import(documents, { action: 'upsert' });
      }
      return documents;
    };
  }

  function getOnBackfillAggregates(db: any) {
    const agg = createAggregator(db, aggregatorConfig);
    return async function onBackfillAggregates(_data: unknown, ctx: any) {
      await ensureAdmin(ctx, db);
      return agg.backfill();
    };
  }

  return {
    schema,
    getOnCreate,
    getOnUpdate,
    getOnDelete,
    getOnReindex,
    getOnBackfillAggregates,
  };
}
