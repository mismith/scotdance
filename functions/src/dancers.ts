import { config, https } from 'firebase-functions';
import Typesense from 'typesense';
import { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';

import { isCypress, isEmulator } from './utility/env';
import { ensureAdmin } from './utility/competition';

const client = new Typesense.Client({
  nodes: [{
    host: isEmulator() ? 'localhost' : config().typesense?.host,
    port: isEmulator() ? 8108 : 443,
    protocol: isEmulator() ? 'http' : 'https',
  }],
  apiKey: isEmulator() ? 'xyz' : config().typesense?.api_key,
  connectionTimeoutSeconds: 60,
});
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

export async function onCreate(snap, ctx) {
  if (isCypress()) return;

  const { dancerId, competitionId } = ctx.params;
  const doc = dancerExtender(snap.val(), { dancerId, competitionId });
  await client.collections('dancers').documents().create(doc);
}
export async function onUpdate({ after: snap }, ctx) {
  if (isCypress()) return;

  const { dancerId, competitionId } = ctx.params;
  const doc = dancerExtender(snap.val(), { dancerId, competitionId });
  await client.collections('dancers').documents(dancerId).update(doc);
}
export async function onDelete(snap, ctx) {
  if (isCypress()) return;

  const { dancerId } = ctx.params;
  await client.collections('dancers').documents(dancerId).delete();
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
      const response = await client.multiSearch.perform({
        searches: [
          {
            collection: 'dancers',
            query_by: '$name',
            filter_by: Array.isArray(authorizedCompetitionIds) ? `$competitionId:[${authorizedCompetitionIds.join()}]` : undefined,
            ...searchParams,
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
    await client.collections('dancers').delete().catch(() => {});
    await client.collections().create(schema);

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
    await client.collections('dancers').documents().import(documents, { action: 'upsert' });

    return documents;
  };
}
