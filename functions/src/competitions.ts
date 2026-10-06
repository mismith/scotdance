import { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';

import { ensureAdmin } from './utility/competition';
import { getTypesense, indexBestEffort, sameExcept } from './utility/typesense';

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
    {
      name: 'date', type: 'string', optional: true, index: false,
    },
    {
      name: 'published', type: 'bool', facet: true, optional: true,
    },
    {
      name: 'listed', type: 'bool', facet: true, optional: true,
    },
    {
      name: 'image', type: 'string', optional: true, index: false,
    },
    // Its organisations' ids: hits lead with them, and Search counts each
    // one's listed competitions, without reading every competition.
    {
      name: 'organisations', type: 'string[]', facet: true, optional: true,
    },
  ],
};

/**
 * The date as the competition has it ('2026-12-12', or an old admin's ISO
 * time or ms), so the app reads a search hit's date the way it reads the
 * competition's. As ms, '2026-12-12' was UTC midnight: the day before in the
 * Americas.
 */
function dateOf(d: unknown): string | undefined {
  if (typeof d === 'number') return Number.isFinite(d) ? String(d) : undefined;
  return typeof d === 'string' && d ? d : undefined;
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
    date: dateOf(comp?.date),
    published: !!comp?.published,
    listed: !!comp?.listed,
    image: comp?.image,
    // As the app reads it: only `true` tags.
    organisations: Object.entries(comp?.organisations || {})
      .filter(([, on]) => on === true)
      .map(([id]) => id),
  };
}

export async function onCreate(snap: any, ctx: any) {
  const { competitionId } = ctx.params;
  const doc = competitionExtender(snap.val(), { competitionId });
  await indexBestEffort('competition upsert', () => getTypesense().collections('competitions').documents().upsert(doc));
}

export async function onUpdate({ before, after: snap }: any, ctx: any) {
  // The venue back-pointer changes nothing search uses.
  if (sameExcept(before.val(), snap.val(), ['venueId'])) return;
  const { competitionId } = ctx.params;
  const doc = competitionExtender(snap.val(), { competitionId });
  await indexBestEffort('competition upsert', () => getTypesense().collections('competitions').documents().upsert(doc));
}

export async function onDelete(_snap: any, ctx: any) {
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
