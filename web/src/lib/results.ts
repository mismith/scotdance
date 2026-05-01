import type {
  DancePlacing,
  EnrichedDance,
  EnrichedGroup,
  PointsTree,
  ResultsTree,
} from '@/types/competition';

const REVERSE_PREFIX = 'reverse:';
const TIE_SUFFIX = ':tie';

interface ParsedPlacing {
  dancerId: string;
  tie: boolean;
}

interface ParsedPlacings {
  reverseFrom: number | null;
  placings: ParsedPlacing[];
}

function parsePlacings(raw: DancePlacing[] | false | undefined): ParsedPlacings {
  if (!Array.isArray(raw) || !raw.length) {
    return { reverseFrom: null, placings: [] };
  }
  let reverseFrom: number | null = null;
  let entries = raw;
  if (typeof raw[0] === 'string' && raw[0].startsWith(REVERSE_PREFIX)) {
    reverseFrom = Number.parseInt(raw[0].slice(REVERSE_PREFIX.length), 10);
    entries = raw.slice(1);
  }
  const placings = entries.map<ParsedPlacing>((entry) => {
    const tie = entry.endsWith(TIE_SUFFIX);
    return {
      dancerId: tie ? entry.slice(0, -TIE_SUFFIX.length) : entry,
      tie,
    };
  });
  return { reverseFrom, placings };
}

export function findGroupDances(group: EnrichedGroup, dances: EnrichedDance[]): EnrichedDance[] {
  return dances.filter((dance) => dance.groupIds?.[group.id]);
}

export function isDancerPointed(
  points: PointsTree,
  groupId: string | undefined,
  danceId: string | undefined,
  dancerId: string,
): boolean {
  if (!groupId || !danceId) return false;
  const dancePoints = points?.[groupId]?.[danceId];
  if (!dancePoints) return false;
  return Object.values(dancePoints)
    .flat()
    .includes(dancerId);
}

export interface PlaceResult {
  place: number | null; // 1-based, null if not placed
  tied: boolean;
  pointed: boolean;
}

export function getDancerPlace(
  dancerId: string,
  groupId: string | undefined,
  danceId: string,
  results: ResultsTree,
  points: PointsTree,
): PlaceResult {
  const pointed = isDancerPointed(points, groupId, danceId, dancerId);
  if (!groupId) return { place: null, tied: false, pointed };

  const raw = results?.[groupId]?.[danceId];
  const { reverseFrom, placings } = parsePlacings(raw);
  const idx = placings.findIndex((p) => p.dancerId === dancerId);
  if (idx < 0) return { place: null, tied: false, pointed };

  const tied = placings[idx].tie || (placings[idx + 1]?.tie ?? false);

  if (reverseFrom != null) {
    // dancers entered in reverse order (last place first)
    const rest = placings.slice(idx + 1);
    const nextNonTieOffset = rest.findIndex((p) => !p.tie);
    const groupEnd = nextNonTieOffset < 0 ? placings.length - 1 : idx + nextNonTieOffset;
    const place = reverseFrom - groupEnd;
    return { place: place > 0 ? place : null, tied, pointed };
  }

  // forward placings: account for ties (everyone in a tie gets the leader's place)
  let place = 0;
  for (let i = 0; i <= idx; i += 1) {
    if (i === 0 || !placings[i].tie) {
      place = i + 1;
    }
  }
  return { place, tied, pointed };
}

export function getOrdinalSuffix(place: number): string {
  const s = place % 100;
  if (s >= 11 && s <= 13) return 'th';
  switch (place % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}
