import { config, https } from 'firebase-functions';
import Typesense from 'typesense';
import { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';

import { isCypress, isEmulator } from './utility/env';

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
    const competitions = (await db.child('competitions').get()).val();
    const authorizedCompeitionIds = Object.entries(competitions || {})
      .map(([competitionId, { published }]: any) => (
        published
          || permissions?.admin === true
          || permissions?.competitions?.[competitionId] === true
        ) && competitionId
      )
      .filter(Boolean);

    try {
      const response = await client.collections('dancers').documents().search({
        query_by: '$name',
        filter_by: `$competitionId:[${authorizedCompeitionIds.join()}]`,
        ...searchParams,
      });
      return response;
    } catch (error) {
      throw new https.HttpsError('invalid-argument', error?.message, error);
    }
  }
}

export function getOnReindex(db) {
  return async function onReindex(data, ctx) {
    if (!ctx.auth?.uid) throw new https.HttpsError('unauthenticated', '');
    const isAdmin = (await db.child(`users:permissions/${ctx.auth.uid}/admin`).get())
      .val() === true;
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
