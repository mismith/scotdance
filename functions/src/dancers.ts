import { HttpsError } from 'firebase-functions/v2/https';
import { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';

import { ensureAdmin } from './utility/competition';
import { getTypesense, indexBestEffort, sameExcept } from './utility/typesense';
import { createAggregator } from './utility/aggregate';
import { filterList, searchTerm } from './search';
import { dancerAggregator as aggregatorConfig, personName } from './utility/entityConfigs';

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
    $name: personName(dancer),
    ...dancer,
  };
}

export function getOnCreate(db: any) {
  const agg = createAggregator(db, aggregatorConfig);
  return async function onCreate(snap: any, ctx: any) {
    const { dancerId, competitionId } = ctx.params;
    const doc = dancerExtender(snap.val(), { dancerId, competitionId });
    await indexBestEffort('dancer upsert', () => getTypesense().collections('dancers').documents().upsert(doc));
    await agg.onCreate(snap, ctx);
  };
}

export function getOnUpdate(db: any) {
  const agg = createAggregator(db, aggregatorConfig);
  return async function onUpdate(change: any, ctx: any) {
    const { dancerId, competitionId } = ctx.params;
    // A back-pointer write changes nothing search uses.
    if (!sameExcept(change.before.val(), change.after.val(), [aggregatorConfig.backPointerField])) {
      const doc = dancerExtender(change.after.val(), { dancerId, competitionId });
      await indexBestEffort('dancer upsert', () => getTypesense().collections('dancers').documents().upsert(doc));
    }
    await agg.onUpdate(change, ctx);
  };
}

export function getOnDelete(db: any) {
  const agg = createAggregator(db, aggregatorConfig);
  return async function onDelete(snap: any, ctx: any) {
    const { dancerId } = ctx.params;
    await getTypesense().collections('dancers').documents(dancerId).delete()
      .catch(() => {});
    await agg.onDelete(snap, ctx);
  };
}

/** Link or unlink a competition's dancers after it's published or unpublished. */
export function getOnSyncCompetition(db: any) {
  return createAggregator(db, aggregatorConfig).syncCompetition;
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

// The v3 app's Dancers search. It takes only the q: the rest is what v3 sends,
// so nobody can page through every published dancer.
export function getOnSearch(db) {
  return async function onSearch(searchParams, ctx) {
    if (!ctx.auth?.uid) throw new HttpsError('unauthenticated', '');
    const q = searchTerm(searchParams?.q);
    if (!q) throw new HttpsError('invalid-argument', 'Search for a name');

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
            collection: 'dancers',
            q,
            query_by: '$name',
            filter_by: Array.isArray(authorizedCompetitionIds) ? `$competitionId:${filterList(authorizedCompetitionIds)}` : undefined,
            group_by: '$name',
            group_limit: 99,
            per_page: 99,
            // What v3 shows of each entry (views/Dancers.vue, DancerListItem).
            include_fields: 'id,$competitionId,$name,firstName,lastName,number,groupId,location,website',
          },
        ],
      });
      return response?.results?.[0];
    } catch (error) {
      throw new HttpsError('invalid-argument', error?.message, error);
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
    if (documents.length) {
      await getTypesense().collections('dancers').documents().import(documents, { action: 'upsert' });
    }

    return documents;
  };
}
