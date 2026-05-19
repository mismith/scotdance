import { https } from 'firebase-functions/v1';
import { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';

import { isCypress } from './utility/env';
import { ensureAdmin } from './utility/competition';
import { getTypesense } from './utility/typesense';
import { createAggregator, type AggregatorConfig } from './utility/aggregate';

const schema: CollectionCreateSchema = {
  name: 'dancers',
  fields: [
    {
      name: '$competitionId',
      type: 'string',
      facet: true,
    },
    {
      name: 'firstName',
      type: 'string',
      optional: true,
    },
    {
      name: 'lastName',
      type: 'string',
      optional: true,
    },
    {
      name: '$name',
      type: 'string',
      facet: true,
    },
  ],
};

function dancerExtender(dancer, { dancerId, competitionId }) {
  return {
    id: dancerId,
    $competitionId: competitionId,
    $name: `${(dancer.firstName || '').trim()} ${(dancer.lastName || '').trim()}`.trim(),
    ...dancer,
  };
}

interface DancerRecord {
  firstName?: string
  lastName?: string
  image?: string
  location?: string
  number?: number | string
  dancerId?: string
}

interface DancerAppearance {
  competitionId: string
  dancerId: string | null
  firstName: string | null
  lastName: string | null
  image: string | null
  location: string | null
  number: number | null
}

function dancerName(d: DancerRecord): string {
  return `${(d.firstName || '').trim()} ${(d.lastName || '').trim()}`.trim();
}

const aggregatorConfig: AggregatorConfig<DancerRecord, DancerAppearance> = {
  namespace: 'dancers',
  sectionName: 'dancers',
  recordIdParam: 'dancerId',
  backPointerField: 'dancerId',
  // Every dancer record contributes — no type filter like staff has.
  predicate: (d): d is DancerRecord => !!d,
  nameOf: dancerName,
  nameFromAppearance: (a) => `${(a.firstName || '').trim()} ${(a.lastName || '').trim()}`.trim(),
  toAppearance: (dancer, { competitionId, recordId }) => ({
    competitionId,
    // The per-comp dancer push key. NOT the aggregate id — that's the key of
    // /dancers/{aggregateId}/appearances/{compId:dancerId}.
    dancerId: recordId,
    firstName: dancer.firstName ?? null,
    lastName: dancer.lastName ?? null,
    image: dancer.image ?? null,
    location: dancer.location ?? null,
    number: typeof dancer.number === 'string'
      ? Number.parseInt(dancer.number, 10) || null
      : dancer.number ?? null,
  }),
  // Denorm name/image/location onto the agg root so the slim index can carry
  // them. "Latest" is approximate — first-non-null in appearance iteration
  // order, since appearances don't carry a date. Profile pages still do the
  // proper date-sorted pick client-side via comp meta.
  recomputeFromAppearances: (apps) => {
    const pick = <K extends keyof DancerAppearance>(f: K): DancerAppearance[K] | null => {
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

export function getOnCreate(db: any) {
  const agg = createAggregator(db, aggregatorConfig);
  return async function onCreate(snap: any, ctx: any) {
    if (isCypress()) return;
    const { dancerId, competitionId } = ctx.params;
    const doc = dancerExtender(snap.val(), { dancerId, competitionId });
    await getTypesense().collections('dancers').documents().upsert(doc);
    await agg.onCreate(snap, ctx);
  };
}

export function getOnUpdate(db: any) {
  const agg = createAggregator(db, aggregatorConfig);
  return async function onUpdate(change: any, ctx: any) {
    if (isCypress()) return;
    const { dancerId, competitionId } = ctx.params;
    const doc = dancerExtender(change.after.val(), { dancerId, competitionId });
    await getTypesense().collections('dancers').documents().upsert(doc);
    await agg.onUpdate(change, ctx);
  };
}

export function getOnDelete(db: any) {
  const agg = createAggregator(db, aggregatorConfig);
  return async function onDelete(snap: any, ctx: any) {
    if (isCypress()) return;
    const { dancerId } = ctx.params;
    await getTypesense().collections('dancers').documents(dancerId).delete().catch(() => {});
    await agg.onDelete(snap, ctx);
  };
}

export function getOnBackfillAggregates(db: any) {
  const agg = createAggregator(db, aggregatorConfig);
  return async function onBackfillAggregates(_data: unknown, ctx: any) {
    await ensureAdmin(ctx, db);
    return agg.backfill();
  };
}

export function getOnBackfillBackPointers(db: any) {
  const agg = createAggregator(db, aggregatorConfig);
  return async function onBackfillBackPointers(data: unknown, ctx: any) {
    await ensureAdmin(ctx, db);
    const opts = (data ?? {}) as { batchSize?: number };
    return agg.backfillBackPointers(opts);
  };
}

export function getOnSearch(db) {
  return async function onSearch(searchParams, ctx) {
    if (!ctx.auth?.uid) throw new https.HttpsError('unauthenticated', '');

    // aggregate a list of all competition ids this user has access too
    const permissions = (await db.child(`users:permissions/${ctx.auth.uid}`).get()).val();
    let authorizedCompetitionIds;
    if (permissions?.admin !== true) {
      const competitionsPublished = (await db.child('competitions:published').get()).val();
      authorizedCompetitionIds = [
        ...Object.keys(competitionsPublished || {}),
        ...Object.keys(permissions?.competitions || {}),
      ];
    }

    try {
      const response = await getTypesense().multiSearch.perform({
        searches: [
          {
            ...searchParams,
            collection: 'dancers',
            query_by: '$name',
            filter_by: Array.isArray(authorizedCompetitionIds) ? `$competitionId:[${authorizedCompetitionIds.join()}]` : undefined,
          },
        ],
      });
      return response?.results?.[0];
    } catch (error) {
      throw new https.HttpsError('invalid-argument', error?.message, error);
    }
  };
}

export function getOnReindex(db) {
  return async function onReindex(data, ctx) {
    await ensureAdmin(ctx, db);

    // reset the collection
    await getTypesense().collections('dancers').delete().catch(() => {});
    await getTypesense().collections().create(schema);

    // populate it with dancer data
    const competitions = (await db.child('competitions').get()).val();
    const documents = [].concat(...(await Promise.all(Object.keys(competitions || {}).map(
      async (competitionId) => {
        const dancers = (await db.child(`competitions:data/${competitionId}/dancers`).get()).val();
        return Object.entries(dancers || {}).map(
          ([dancerId, dancer]) => dancerExtender(dancer, { dancerId, competitionId }),
        );
      },
    ))));
    await getTypesense().collections('dancers').documents().import(documents, { action: 'upsert' });

    return documents;
  };
}
