import Typesense from 'typesense';
import { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';

import { isCypress, isEmulator } from './utility/env';
import { ensureAdmin } from './utility/competition';
import { getConfig } from './utility/config';

let typesenseClient: InstanceType<typeof Typesense.Client>;
function getTypesense() {
  if (!typesenseClient) {
    typesenseClient = new Typesense.Client({
      nodes: [{
        host: isEmulator() ? 'localhost' : getConfig().typesense?.host,
        port: isEmulator() ? 8108 : 443,
        protocol: isEmulator() ? 'http' : 'https',
      }],
      apiKey: isEmulator() ? 'xyz' : getConfig().typesense?.api_key,
      connectionTimeoutSeconds: 60,
    });
  }
  return typesenseClient;
}

export const PIPER_TYPE = 'Piper';

export const schema: CollectionCreateSchema = {
  name: 'pipers',
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

function isPiper(member: any): boolean {
  return !!member && typeof member.type === 'string' && member.type === PIPER_TYPE;
}

function staffDocId(competitionId: string, staffId: string) {
  return `${competitionId}:${staffId}`;
}

function piperExtender(
  member: any,
  { competitionId, staffId }: { competitionId: string; staffId: string },
) {
  return {
    id: staffDocId(competitionId, staffId),
    $competitionId: competitionId,
    $name: `${(member.firstName || '').trim()} ${(member.lastName || '').trim()}`.trim(),
    firstName: member.firstName,
    lastName: member.lastName,
    location: member.location,
    image: member.image,
  };
}

async function safeDelete(docId: string) {
  await getTypesense()
    .collections('pipers')
    .documents(docId)
    .delete()
    .catch(() => {});
}

export async function onCreate(snap: any, ctx: any) {
  if (isCypress()) return;
  const member = snap.val();
  if (!isPiper(member)) return;
  const { competitionId, staffId } = ctx.params;
  const doc = piperExtender(member, { competitionId, staffId });
  await getTypesense().collections('pipers').documents().upsert(doc);
}

export async function onUpdate({ after: snap }: any, ctx: any) {
  if (isCypress()) return;
  const member = snap.val();
  const { competitionId, staffId } = ctx.params;
  if (!isPiper(member)) {
    // staff member no longer a piper — remove from index if previously indexed
    await safeDelete(staffDocId(competitionId, staffId));
    return;
  }
  const doc = piperExtender(member, { competitionId, staffId });
  await getTypesense().collections('pipers').documents().upsert(doc);
}

export async function onDelete(_snap: any, ctx: any) {
  if (isCypress()) return;
  const { competitionId, staffId } = ctx.params;
  await safeDelete(staffDocId(competitionId, staffId));
}

export function getOnReindex(db: any) {
  return async function onReindex(_data: unknown, ctx: any) {
    await ensureAdmin(ctx, db);

    await getTypesense().collections('pipers').delete().catch(() => {});
    await getTypesense().collections().create(schema);

    const competitions = (await db.child('competitions').get()).val() || {};
    const documents = [].concat(...(await Promise.all(Object.keys(competitions).map(
      async (competitionId) => {
        const staff = (await db.child(`competitions:data/${competitionId}/staff`).get()).val() || {};
        return Object.entries(staff)
          .filter(([, member]) => isPiper(member))
          .map(([staffId, member]) => piperExtender(member, { competitionId, staffId })) as never;
      },
    ))));
    if (documents.length) {
      await getTypesense().collections('pipers').documents().import(documents, { action: 'upsert' });
    }
    return documents;
  };
}
