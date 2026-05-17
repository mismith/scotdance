import { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';

import { isCypress } from './utility/env';
import { ensureAdmin } from './utility/competition';
import { getTypesense } from './utility/typesense';

export const schema: CollectionCreateSchema = {
  name: 'competitions',
  fields: [
    { name: '$name', type: 'string', facet: true },
    { name: 'name', type: 'string', optional: true },
    {
      name: 'venue', type: 'string', optional: true, facet: true,
    },
    { name: 'location', type: 'string', optional: true },
    {
      name: 'country', type: 'string', optional: true, facet: true,
    },
    {
      name: 'region', type: 'string', optional: true, facet: true,
    },
    {
      name: 'locality', type: 'string', optional: true, facet: true,
    },
    { name: 'date', type: 'int64', optional: true },
    {
      name: 'published', type: 'bool', facet: true, optional: true,
    },
    {
      name: 'listed', type: 'bool', facet: true, optional: true,
    },
    {
      name: 'image', type: 'string', optional: true, index: false,
    },
  ],
};

function toMs(d: unknown): number | undefined {
  if (d == null) return undefined;
  if (typeof d === 'number') return d;
  const t = Date.parse(String(d));
  return Number.isFinite(t) ? t : undefined;
}

function competitionExtender(comp: any, { competitionId }: { competitionId: string }) {
  return {
    id: competitionId,
    $name: (comp?.name || '').trim(),
    name: comp?.name,
    venue: comp?.venue,
    location: comp?.location,
    country: comp?.country,
    region: comp?.region,
    locality: comp?.locality,
    date: toMs(comp?.date),
    published: !!comp?.published,
    listed: !!comp?.listed,
    image: comp?.image,
  };
}

export async function onCreate(snap: any, ctx: any) {
  if (isCypress()) return;
  const { competitionId } = ctx.params;
  const doc = competitionExtender(snap.val(), { competitionId });
  await getTypesense().collections('competitions').documents().upsert(doc);
}

export async function onUpdate({ after: snap }: any, ctx: any) {
  if (isCypress()) return;
  const { competitionId } = ctx.params;
  const doc = competitionExtender(snap.val(), { competitionId });
  await getTypesense().collections('competitions').documents().upsert(doc);
}

export async function onDelete(_snap: any, ctx: any) {
  if (isCypress()) return;
  const { competitionId } = ctx.params;
  await getTypesense()
    .collections('competitions')
    .documents(competitionId)
    .delete()
    .catch(() => {});
}

export function getOnReindex(db: any) {
  return async function onReindex(_data: unknown, ctx: any) {
    await ensureAdmin(ctx, db);

    await getTypesense().collections('competitions').delete().catch(() => {});
    await getTypesense().collections().create(schema);

    const competitions = (await db.child('competitions').get()).val() || {};
    const documents = Object.entries(competitions).map(
      ([competitionId, comp]) => competitionExtender(comp, { competitionId }),
    );
    if (documents.length) {
      await getTypesense().collections('competitions').documents().import(documents, { action: 'upsert' });
    }
    return documents;
  };
}
