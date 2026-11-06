import { HttpsError } from 'firebase-functions/v2/https';
import { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';

import { ensureAdmin } from './utility/competition';
import {
  getTypesense, getTypesenseSearch, indexBestEffort, rebuild, sameExcept,
} from './utility/typesense';
import { createAggregator } from './utility/aggregate';
import { filterList, searchTerm, withAppKeys } from './search';
import { dancerAggregator as aggregatorConfig, linkableMember, personName } from './utility/entityConfigs';
import { isTeam, memberName, teamMembers } from './utility/entries';

const schema: CollectionCreateSchema = {
  name: 'dancers',
  fields: [
    {
      name: 'competitionId',
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
      name: 'name',
      type: 'string',
      facet: true,
    },
  ],
};

function dancerExtender(dancer, { dancerId, competitionId }) {
  return {
    id: dancerId,
    ...dancer,
    // The apps read these as $competitionId and $name (search.ts withAppKeys).
    competitionId,
    name: personName(dancer),
  };
}

const text = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '');

/**
 * What search holds for an entry: a dancer's entry, or a team's members, so
 * searching a name finds them in their team (ADR 0012). A team's own name
 * isn't a person, so it isn't searched for. A member's document carries the
 * team's entry id, number and age group: v3's search opens that entry.
 */
export function searchDocs(row: any, { dancerId, competitionId }: { dancerId: string, competitionId: string }) {
  if (!row || typeof row !== 'object') return [];
  if (!isTeam(row)) return [dancerExtender(row, { dancerId, competitionId })];
  // Members with a profile only (a first name alone would find everyone's
  // Clare); not the team's location, which isn't where the dancer's from.
  return teamMembers(row).filter(([, m]) => linkableMember(m)).map(([key, m]) => ({
    id: `${dancerId}.${key}`,
    entryId: dancerId,
    competitionId,
    firstName: text(m.firstName),
    lastName: text(m.lastName),
    name: memberName(m),
    ...(text(row.number) && { number: text(row.number) }),
    ...(typeof row.groupId === 'string' && { groupId: row.groupId }),
  }));
}

/** Bring search in line with an entry's documents before and after a write. */
async function reindexEntry(before: any[], after: any[]) {
  const collection = getTypesense().collections('dancers');
  const kept = new Set(after.map((d) => d.id));
  const was = new Map(before.map((d) => [d.id, JSON.stringify(d)]));
  for (const doc of before) {
    if (!kept.has(doc.id)) await collection.documents(doc.id).delete().catch(() => {});
  }
  for (const doc of after) {
    // A back-pointer write changes nothing search uses.
    if (was.get(doc.id) === JSON.stringify(doc)) continue;
    await indexBestEffort('dancer upsert', () => collection.documents().upsert(doc));
  }
}

export function getOnCreate(db: any) {
  const agg = createAggregator(db, aggregatorConfig);
  return async function onCreate(snap: any, ctx: any) {
    const { dancerId, competitionId } = ctx.params;
    await indexBestEffort('dancer upsert', () => reindexEntry([], searchDocs(snap.val(), { dancerId, competitionId })));
    await agg.onCreate(snap, ctx);
  };
}

export function getOnUpdate(db: any) {
  const agg = createAggregator(db, aggregatorConfig);
  return async function onUpdate(change: any, ctx: any) {
    const { dancerId, competitionId } = ctx.params;
    // A back-pointer write changes nothing search uses (a team member's
    // makes the same documents, so reindexEntry skips them).
    if (!sameExcept(change.before.val(), change.after.val(), [aggregatorConfig.backPointerField])) {
      const docs = (v: any) => searchDocs(v, { dancerId, competitionId });
      await indexBestEffort('dancer upsert', () => reindexEntry(docs(change.before.val()), docs(change.after.val())));
    }
    await agg.onUpdate(change, ctx);
  };
}

export function getOnDelete(db: any) {
  const agg = createAggregator(db, aggregatorConfig);
  return async function onDelete(snap: any, ctx: any) {
    const { dancerId, competitionId } = ctx.params;
    await indexBestEffort('dancer delete', () => reindexEntry(searchDocs(snap.val(), { dancerId, competitionId }), []));
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

/** v3 opens a hit by its id: a team member's opens their team's entry. */
export function asEntries(result: any) {
  if (!result) return result;
  const toEntry = (hit: any) => {
    const { entryId, ...rest } = hit?.document || {};
    return entryId ? { ...hit, document: { ...rest, id: entryId } } : hit;
  };
  return {
    ...result,
    ...(result.hits && { hits: result.hits.map(toEntry) }),
    ...(result.grouped_hits && {
      grouped_hits: result.grouped_hits.map((g: any) => ({ ...g, hits: g.hits?.map(toEntry) })),
    }),
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
      const response = await getTypesenseSearch().multiSearch.perform({
        searches: [
          {
            collection: 'dancers',
            q,
            query_by: 'name',
            filter_by: Array.isArray(authorizedCompetitionIds) ? `competitionId:${filterList(authorizedCompetitionIds)}` : undefined,
            group_by: 'name',
            group_limit: 99,
            per_page: 99,
            // What v3 shows of each entry (views/Dancers.vue, DancerListItem).
            include_fields: 'id,entryId,competitionId,name,firstName,lastName,number,groupId,location,website',
          },
        ],
      });
      return withAppKeys(asEntries(response?.results?.[0]));
    } catch (error) {
      throw new HttpsError('invalid-argument', error?.message, error);
    }
  };
}

export function getOnReindex(db) {
  return async function onReindex(data, ctx) {
    await ensureAdmin(ctx, db);
    const competitions = (await db.child('competitions').get()).val();
    const documents = [].concat(...(await Promise.all(Object.keys(competitions || {}).map(
      async (competitionId) => {
        const dancers = (await db.child(`competitions:data/${competitionId}/dancers`).get()).val();
        return Object.entries(dancers || {}).flatMap(
          ([dancerId, dancer]) => searchDocs(dancer, { dancerId, competitionId }),
        );
      },
    ))));
    return rebuild(schema, documents);
  };
}
