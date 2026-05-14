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

export const JUDGE_TYPE = 'Judge';

export const schema: CollectionCreateSchema = {
  name: 'judges',
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

function isJudge(member: any): boolean {
  return !!member && typeof member.type === 'string' && member.type === JUDGE_TYPE;
}

function staffDocId(competitionId: string, staffId: string) {
  return `${competitionId}:${staffId}`;
}

function judgeExtender(
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
    .collections('judges')
    .documents(docId)
    .delete()
    .catch(() => {});
}

export async function onCreate(snap: any, ctx: any) {
  if (isCypress()) return;
  const member = snap.val();
  if (!isJudge(member)) return;
  const { competitionId, staffId } = ctx.params;
  const doc = judgeExtender(member, { competitionId, staffId });
  await getTypesense().collections('judges').documents().upsert(doc);
}

export async function onUpdate({ after: snap }: any, ctx: any) {
  if (isCypress()) return;
  const member = snap.val();
  const { competitionId, staffId } = ctx.params;
  if (!isJudge(member)) {
    // staff member no longer a judge — remove from index if previously indexed
    await safeDelete(staffDocId(competitionId, staffId));
    return;
  }
  const doc = judgeExtender(member, { competitionId, staffId });
  await getTypesense().collections('judges').documents().upsert(doc);
}

export async function onDelete(_snap: any, ctx: any) {
  if (isCypress()) return;
  const { competitionId, staffId } = ctx.params;
  await safeDelete(staffDocId(competitionId, staffId));
}

export function getOnReindex(db: any) {
  return async function onReindex(_data: unknown, ctx: any) {
    await ensureAdmin(ctx, db);

    await getTypesense().collections('judges').delete().catch(() => {});
    await getTypesense().collections().create(schema);

    const competitions = (await db.child('competitions').get()).val() || {};
    const documents = [].concat(...(await Promise.all(Object.keys(competitions).map(
      async (competitionId) => {
        const staff = (await db.child(`competitions:data/${competitionId}/staff`).get()).val() || {};
        return Object.entries(staff)
          .filter(([, member]) => isJudge(member))
          .map(([staffId, member]) => judgeExtender(member, { competitionId, staffId })) as never;
      },
    ))));
    if (documents.length) {
      await getTypesense().collections('judges').documents().import(documents, { action: 'upsert' });
    }
    return documents;
  };
}
