import { https } from 'firebase-functions/v1';

import { getTypesense } from './utility/typesense';

type EntityType = 'competitions' | 'dancers' | 'judges' | 'pipers' | 'places';
const ALL_TYPES: EntityType[] = ['competitions', 'dancers', 'judges', 'pipers', 'places'];

interface SearchAllParams {
  q?: string;
  perGroup?: number;
  types?: EntityType[];
}

function emptyOut() {
  return {
    competitions: null,
    dancers: null,
    judges: null,
    pipers: null,
    places: null,
  };
}

/**
 * A Typesense filter value list. Each id is quoted, so ids with commas or
 * other filter syntax in them stay one value (RTDB keys allow most of it).
 */
export function filterList(ids: string[]): string {
  return `[${ids.filter((id) => !id.includes('`')).map((id) => `\`${id}\``).join(',')}]`;
}

export function getOnSearchAll(db: any) {
  return async function onSearchAll(params: SearchAllParams, ctx: any) {
    // Anyone can call this, so take nothing on trust.
    const q = (typeof params?.q === 'string' ? params.q : '').trim().slice(0, 200);
    if (!q) return emptyOut();

    const requested = Math.floor(Number(params?.perGroup ?? 5));
    const perGroup = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), 50) : 5;
    const types = (Array.isArray(params?.types) && params.types.length ? params.types : ALL_TYPES)
      .filter((t): t is EntityType => ALL_TYPES.includes(t));

    const uid = ctx?.auth?.uid as string | undefined;

    // What each person may find, as the rules read it: admins everything;
    // everyone else the competitions that are listed or published (with their
    // judges and pipers), dancers only once published, and whatever they
    // manage. Anonymous users get the public set only.
    const permissions = uid
      ? (await db.child(`users:permissions/${uid}`).get()).val()
      : null;
    const isAdmin = permissions?.admin === true;

    let shownIds: string[] = [];
    let publishedIds: string[] = [];
    if (!isAdmin) {
      const [published, listed] = await Promise.all(
        ['competitions:published', 'competitions:listed'].map(async (path) => Object.keys((await db.child(path).get()).val() || {})),
      );
      // As the rules read it: only `true` grants a competition.
      const ownedIds = uid
        ? Object.entries(permissions?.competitions || {})
          .filter(([, granted]) => granted === true)
          .map(([id]) => id)
        : [];
      publishedIds = Array.from(new Set([...published, ...ownedIds]));
      shownIds = Array.from(new Set([...publishedIds, ...listed]));
    }

    const compFilter = isAdmin ? undefined : `id:${filterList(shownIds)}`;
    const childFilter = (ids: string[]) => (isAdmin ? undefined : `$competitionId:${filterList(ids)}`);

    // Short-circuit: non-admin with nothing to see → nothing to search.
    if (!isAdmin && shownIds.length === 0) return emptyOut();

    // Build searches and remember which result slot each one targets.
    const slots: Array<
    { key: 'competitions' | 'dancers' | 'judges' | 'pipers' }
    | { key: 'places'; kind: 'venue' | 'locality' | 'region' }
    > = [];
    const searches: any[] = [];

    types.forEach((type) => {
      if (type === 'competitions') {
        slots.push({ key: 'competitions' });
        searches.push({
          collection: 'competitions',
          q,
          query_by: 'name,venue,location,locality,region,country',
          filter_by: compFilter,
          per_page: perGroup,
        });
      } else if (type === 'dancers' || type === 'judges' || type === 'pipers') {
        const ids = type === 'dancers' ? publishedIds : shownIds;
        // Nothing published yet: no dancers to find (an empty list isn't a filter).
        if (!isAdmin && !ids.length) return;
        slots.push({ key: type });
        searches.push({
          collection: type,
          q,
          query_by: '$name,firstName,lastName',
          filter_by: childFilter(ids),
          per_page: perGroup,
          group_by: '$name',
          group_limit: 5,
        });
      } else if (type === 'places') {
        // Three sub-queries — one per place kind. Each is scoped to its own
        // field so a comp-name match doesn't surface its parent locality.
        (['venue', 'locality', 'region'] as const).forEach((kind) => {
          slots.push({ key: 'places', kind });
          searches.push({
            collection: 'competitions',
            q,
            query_by: kind,
            filter_by: compFilter,
            per_page: perGroup,
            group_by: kind,
            // High enough to capture all comps for any one venue/locality/region
            // so the picker sheet gets the full list (not just a sample).
            group_limit: 50,
          });
        });
      }
    });

    try {
      const response = await getTypesense().multiSearch.perform({ searches });
      const results = response?.results || [];
      const out: any = emptyOut();
      slots.forEach((slot, i) => {
        const result = results[i] ?? null;
        if (slot.key === 'places') {
          if (!out.places) out.places = { venues: null, localities: null, regions: null };
          const bucket = ({ venue: 'venues', locality: 'localities', region: 'regions' } as const)[slot.kind];
          out.places[bucket] = result;
        } else {
          out[slot.key] = result;
        }
      });
      return out;
    } catch (error: any) {
      throw new https.HttpsError('invalid-argument', error?.message, error);
    }
  };
}
