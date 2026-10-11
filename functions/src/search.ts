import { HttpsError } from 'firebase-functions/v2/https';

import { dayOf } from './competitions';
import { getTypesenseSearch } from './utility/typesense';

type EntityType = 'competitions' | 'dancers' | 'judges' | 'pipers' | 'places' | 'organisations';
const ALL_TYPES: EntityType[] = ['competitions', 'dancers', 'judges', 'pipers', 'places', 'organisations'];

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
    organisations: null,
  };
}

/**
 * A Typesense filter value list. Each id is quoted, so ids with commas or
 * other filter syntax in them stay one value (RTDB keys allow most of it).
 */
export function filterList(ids: string[]): string {
  return `[${ids.filter((id) => !id.includes('`')).map((id) => `\`${id}\``).join(',')}]`;
}

/**
 * The caller's q, or '' when it has no word to find. Typesense drops
 * punctuation and reads `-word` as "not word", and a q with no word left
 * searches everything, as `*` does, so one word must start with a letter or
 * digit.
 */
export function searchTerm(q: unknown): string {
  const text = (typeof q === 'string' ? q : '').trim().slice(0, 200);
  return text.split(' ').some((word) => /^[\p{L}\p{N}]/u.test(word)) ? text : '';
}

/**
 * A people search's hits as the apps read them: the index's `name` and
 * `competitionId` as `$name` and `$competitionId`. Newer Typesense reads a
 * leading `$` in a filter, group_by or include_fields as a join, so the
 * index can't have them itself.
 */
export function withAppKeys(result: any) {
  if (!result) return result;
  const rename = (hit: any) => {
    const { name, competitionId, ...rest } = hit?.document || {};
    return { ...hit, document: { ...rest, $name: name, $competitionId: competitionId } };
  };
  return {
    ...result,
    ...(result.hits && { hits: result.hits.map(rename) }),
    ...(result.grouped_hits && {
      grouped_hits: result.grouped_hits.map((g: any) => ({ ...g, hits: g.hits?.map(rename) })),
    }),
  };
}

// Which competitions show (about 40 KB of ids) changes only when one is
// published, listed or hidden, so each instance reads it once a minute rather
// than on every search: a newly shown one turns up in search within a minute.
const SHOWN_TTL_MS = 60 * 1000;

export function getOnSearchAll(db: any) {
  let shown: { at: number, lists: Promise<string[][]> } | null = null;
  const shownLists = () => {
    if (!shown || Date.now() - shown.at > SHOWN_TTL_MS) {
      const lists = Promise.all(
        ['competitions:published', 'competitions:listed'].map(async (path) => Object.keys((await db.child(path).get()).val() || {})),
      );
      shown = { at: Date.now(), lists };
      // A failed read isn't kept: the next search tries again.
      lists.catch(() => { shown = null; });
    }
    return shown.lists;
  };

  return async function onSearchAll(params: SearchAllParams, ctx: any) {
    // Anyone can call this, so take nothing on trust.
    const q = searchTerm(params?.q);
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
      const [published, listed] = await shownLists();
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
    const childFilter = (ids: string[]) => (isAdmin ? undefined : `competitionId:${filterList(ids)}`);

    // Short-circuit: non-admin with nothing to see → nothing to search.
    if (!isAdmin && shownIds.length === 0) return emptyOut();

    // Build searches and remember which result slot each one targets. Each
    // returns only the fields the app reads (web/src/lib/searchAll.ts).
    const slots: Array<
    { key: 'dancers' | 'judges' | 'pipers' | 'organisations' }
    | { key: 'competitions'; when: 'upcoming' | 'past' }
    | { key: 'places'; kind: 'venue' | 'locality' | 'region' }
    > = [];
    const searches: any[] = [];

    // A name matches every year of a competition equally well, so among
    // equal matches those coming up come first (soonest first), then past
    // ones (latest first); a better match still comes first. From yesterday,
    // in UTC: one on today anywhere, or on its second day, is still coming up.
    const since = dayOf(Date.now() - 24 * 60 * 60 * 1000);
    const when = {
      upcoming: { filter: `day:>=${since}`, sort: '_text_match:desc,day:asc' },
      past: { filter: `day:<${since}`, sort: '_text_match:desc,day:desc' },
    };

    types.forEach((type) => {
      if (type === 'competitions') {
        (['upcoming', 'past'] as const).forEach((part) => {
          slots.push({ key: 'competitions', when: part });
          searches.push({
            collection: 'competitions',
            q,
            query_by: 'name,venue,location,locality,region,country',
            filter_by: [compFilter, when[part].filter].filter(Boolean).join(' && '),
            sort_by: when[part].sort,
            per_page: perGroup,
            include_fields: 'id,name,venue,location,locality,region,country,date,image,organisations',
          });
        });
      } else if (type === 'dancers' || type === 'judges' || type === 'pipers') {
        const ids = type === 'dancers' ? publishedIds : shownIds;
        // Nothing published yet: no dancers to find (an empty list isn't a filter).
        if (!isAdmin && !ids.length) return;
        slots.push({ key: type });
        searches.push({
          collection: type,
          q,
          query_by: 'name,firstName,lastName',
          filter_by: childFilter(ids),
          per_page: perGroup,
          group_by: 'name',
          group_limit: 5,
          // A dancer's entry holds more than search shows, and no photo shows.
          include_fields: type === 'dancers' ? 'name,competitionId,location' : 'name,competitionId,location,image',
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
            include_fields: 'id,venue,locality,region,country',
          });
        });
      } else if (type === 'organisations') {
        // Organisations are matched on the device (there are tens): this
        // counts each one's listed competitions, which anyone may see.
        slots.push({ key: 'organisations' });
        searches.push({
          collection: 'competitions',
          q: '*',
          filter_by: 'listed:true',
          facet_by: 'organisations',
          max_facet_values: 250,
          per_page: 0,
        });
      }
    });

    try {
      const response = await getTypesenseSearch().multiSearch.perform({ searches });
      const results = response?.results || [];
      const out: any = emptyOut();
      const competitions: Record<string, any> = {};
      slots.forEach((slot, i) => {
        const result = results[i] ?? null;
        if (slot.key === 'places') {
          if (!out.places) out.places = { venues: null, localities: null, regions: null };
          const bucket = ({ venue: 'venues', locality: 'localities', region: 'regions' } as const)[slot.kind];
          out.places[bucket] = result;
        } else if (slot.key === 'competitions') {
          competitions[slot.when] = result;
        } else if (slot.key === 'organisations') {
          out.organisations = result;
        } else {
          out[slot.key] = withAppKeys(result);
        }
      });
      if (types.includes('competitions')) {
        // Each list is best match first: take the better of their heads,
        // the coming one when they match as well. The score is exact as text:
        // as a number, a match on the name and one on the venue come out equal.
        const score = (hit: any) => BigInt(hit.text_match_info?.score ?? hit.text_match ?? 0);
        const up = competitions.upcoming?.hits ?? [];
        const past = competitions.past?.hits ?? [];
        const hits = [];
        while (hits.length < perGroup && (up.length || past.length)) {
          const pastBetter = past.length && (!up.length || score(past[0]) > score(up[0]));
          hits.push((pastBetter ? past : up).shift());
        }
        out.competitions = {
          found: (competitions.upcoming?.found ?? 0) + (competitions.past?.found ?? 0),
          hits,
        };
      }
      return out;
    } catch (error: any) {
      throw new HttpsError('invalid-argument', error?.message, error);
    }
  };
}
