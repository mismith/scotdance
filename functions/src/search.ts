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

export function getOnSearchAll(db: any) {
  return async function onSearchAll(params: SearchAllParams, ctx: any) {
    const q = (params?.q || '').trim();
    if (!q) return emptyOut();

    const perGroup = Math.min(Math.max(params?.perGroup ?? 5, 1), 50);
    const types = (params?.types && params.types.length ? params.types : ALL_TYPES)
      .filter((t): t is EntityType => ALL_TYPES.includes(t));

    const uid = ctx?.auth?.uid as string | undefined;

    // Permission set: admins see everything; everyone else sees published comps
    // plus any they own. Anonymous users get the published set only.
    const permissions = uid
      ? (await db.child(`users:permissions/${uid}`).get()).val()
      : null;
    const isAdmin = permissions?.admin === true;

    let authorizedCompIds: string[] | null = null;
    if (!isAdmin) {
      const publishedIds = Object.keys(
        (await db.child('competitions:published').get()).val() || {},
      );
      const ownedIds = uid
        ? Object.keys(permissions?.competitions || {})
        : [];
      authorizedCompIds = Array.from(new Set([...publishedIds, ...ownedIds]));
    }

    const idList = (authorizedCompIds || []).join();
    const compFilter = isAdmin ? undefined : `id:[${idList}]`;
    const childFilter = isAdmin ? undefined : `$competitionId:[${idList}]`;

    // Short-circuit: non-admin with no authorized comps → nothing to search.
    if (!isAdmin && (authorizedCompIds || []).length === 0) return emptyOut();

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
        slots.push({ key: type });
        searches.push({
          collection: type,
          q,
          query_by: '$name,firstName,lastName',
          filter_by: childFilter,
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
          const bucket = `${slot.kind}s` as 'venues' | 'localities' | 'regions';
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
