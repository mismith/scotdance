import { config, https } from 'firebase-functions';
import Typesense from 'typesense';
import { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';

import { isEmulator } from './utility/env';

const client = new Typesense.Client({
  nodes: [{
    host: isEmulator() ? 'localhost' : `${config().typesense?.cluster_id}-1.a1.typesense.net`,
    port: isEmulator() ? 8108 : 443,
    protocol: isEmulator() ? 'http' : 'https',
  }],
  apiKey: config().typesense?.admin_api_key || 'MISSING',
  connectionTimeoutSeconds: 2,
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
  const { dancerId, competitionId } = ctx.params;
  const doc = dancerExtender(snap.val(), { dancerId, competitionId });
  return client.collections('dancers').documents().create(doc);
}
export async function onUpdate({ after: snap }, ctx) {
  const { dancerId, competitionId } = ctx.params;
  const doc = dancerExtender(snap.val(), { dancerId, competitionId });
  return client.collections('dancers').documents(dancerId).update(doc);
}
export async function onDelete(snap, ctx) {
  const { dancerId } = ctx.params;
  return client.collections('dancers').documents(dancerId).delete();
}

export function reindex(db) {
  return async function onCall(data, ctx) {
    if (!ctx.auth?.uid) throw new https.HttpsError('unauthenticated', '');
    const isAdmin = (await db.child(`users:permissions/${ctx.auth.uid}/admin`).get()).val();
    if (!isAdmin) throw new https.HttpsError('permission-denied', '');

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
export async function search(searchParams, ctx) {
  if (!ctx.auth?.uid) throw new https.HttpsError('unauthenticated', '');

  try {
    const response = await client.collections('dancers').documents().search({
      query_by: '$name',
      ...searchParams,
    });
    return response;
  } catch (error) {
    throw new https.HttpsError('invalid-argument', error?.message, error);
  }
}
