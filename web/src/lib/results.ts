import type {
  DancePlacing,
  EnrichedDance,
  EnrichedDancer,
  EnrichedGroup,
  PointsTree,
  ResultsTree,
} from '@/types/competition'
import { OVERALL_ID, groupHasOverall } from '@/types/competition'

const REVERSE_PREFIX = 'reverse:'
const TIE_SUFFIX = ':tie'

export const CALLBACKS_ID = 'callbacks'

interface ParsedPlacing {
  dancerId: string
  tie: boolean
}

interface ParsedPlacings {
  reverseFrom: number | null
  placings: ParsedPlacing[]
}

function parsePlacings(raw: DancePlacing[] | false | null | undefined): ParsedPlacings {
  if (!Array.isArray(raw) || !raw.length) {
    return { reverseFrom: null, placings: [] }
  }
  let reverseFrom: number | null = null
  let entries = raw
  if (typeof raw[0] === 'string' && raw[0].startsWith(REVERSE_PREFIX)) {
    const n = Number.parseInt(raw[0].slice(REVERSE_PREFIX.length), 10)
    // "reverse:0" or garbage reads as normal order, as the old app did.
    reverseFrom = n > 0 ? n : null
    entries = raw.slice(1)
  }
  // Skip gaps and stray markers (hand-edited data). The first dancer can't be
  // tied with the one before: there isn't one.
  const placings = entries
    .filter((entry): entry is string => typeof entry === 'string' && entry !== '' && !entry.startsWith(REVERSE_PREFIX))
    .map<ParsedPlacing>((entry, i) => {
      const tie = entry.endsWith(TIE_SUFFIX)
      return {
        dancerId: tie ? entry.slice(0, -TIE_SUFFIX.length) : entry,
        tie: tie && i > 0,
      }
    })
  return { reverseFrom, placings }
}

/**
 * A dance's results are in: dancers placed, or marked as none placed. A
 * Championship start on its own ("reverse:6", nobody placed yet) isn't.
 */
export function isPosted(raw: DancePlacing[] | false | null | undefined): boolean {
  return raw === false || parsePlacings(raw).placings.length > 0
}

export function findGroupDances(
  group: EnrichedGroup,
  dances: EnrichedDance[],
): EnrichedDance[] {
  return dances.filter((dance) => dance.groupIds?.[group.id])
}

export function isDancerPointed(
  points: PointsTree,
  groupId: string | undefined,
  danceId: string | undefined,
  dancerId: string,
): boolean {
  if (!groupId || !danceId) return false
  const dancePoints = points?.[groupId]?.[danceId]
  if (!dancePoints) return false
  return Object.values(dancePoints).flat().includes(dancerId)
}

export interface PlaceResult {
  place: number | null // 1-based, null if not placed
  tied: boolean
  pointed: boolean
}

export function getDancerPlace(
  dancerId: string,
  groupId: string | undefined,
  danceId: string,
  results: ResultsTree,
  points: PointsTree,
): PlaceResult {
  const pointed = isDancerPointed(points, groupId, danceId, dancerId)
  if (!groupId) return { place: null, tied: false, pointed }

  const raw = results?.[groupId]?.[danceId]
  const { reverseFrom, placings } = parsePlacings(raw)
  const idx = placings.findIndex((p) => p.dancerId === dancerId)
  if (idx < 0) return { place: null, tied: false, pointed }

  const tied = placings[idx].tie || (placings[idx + 1]?.tie ?? false)

  if (reverseFrom != null) {
    // dancers entered in reverse order (last place first)
    const rest = placings.slice(idx + 1)
    const nextNonTieOffset = rest.findIndex((p) => !p.tie)
    const groupEnd = nextNonTieOffset < 0 ? placings.length - 1 : idx + nextNonTieOffset
    const place = reverseFrom - groupEnd
    return { place: place > 0 ? place : null, tied, pointed }
  }

  // forward placings: account for ties (everyone in a tie gets the leader's place)
  let place = 0
  for (let i = 0; i <= idx; i += 1) {
    if (i === 0 || !placings[i].tie) {
      place = i + 1
    }
  }
  return { place, tied, pointed }
}

// A dance's everyday short name, for under a rosette or in a one-line summary
// ("1st Fling"). Older competitions' own short names are unreliable (often a
// different dance's), so it comes from the full name.
const SHORT_DANCE: [RegExp, string][] = [
  [/pas de bas|\bpdb\b/i, 'Pas de basques'],
  [/fling/i, 'Fling'],
  [/broadsword/i, 'Broadsword'],
  [/sword/i, 'Sword'],
  [/seann|sean |triubhas|truibhas|trews/i, 'Seann'],
  [/reel|strathspey/i, 'Reel'],
  [/flora/i, 'Flora'],
  [/hornpipe/i, 'Hornpipe'],
  [/jig/i, 'Jig'],
  [/lilt/i, 'Lilt'],
  [/earl/i, 'Earl'],
  [/laddie/i, 'Laddie'],
  [/barracks/i, 'Barracks'],
  [/blue bonnets/i, 'Bonnets'],
  [/village maid/i, 'Village Maid'],
  [/choreograph/i, 'Choreography'],
  [/overall/i, 'Overall'],
]
export function shortDanceName(name: string | null | undefined): string {
  const n = (name ?? '').replace(/\s*\([^)]*\)\s*$/, '').trim()
  return SHORT_DANCE.find(([re]) => re.test(n))?.[1] ?? n
}

export function getOrdinalSuffix(place: number): string {
  const s = place % 100
  if (s >= 11 && s <= 13) return 'th'
  switch (place % 10) {
    case 1:
      return 'st'
    case 2:
      return 'nd'
    case 3:
      return 'rd'
    default:
      return 'th'
  }
}

export interface PlacedDancerRow {
  dancerId: string
  dancer: EnrichedDancer | null
  place: number | null
  tied: boolean
}

export interface DanceResults {
  rows: PlacedDancerRow[]
  reverseFrom: number | null
  explicitlyEmpty: boolean
  hasResults: boolean
}

function lookupDancer(
  dancerId: string,
  dancersById: Map<string, EnrichedDancer>,
): EnrichedDancer | null {
  return dancersById.get(dancerId) ?? null
}

export function getDanceResults(
  groupId: string,
  danceId: string,
  dancers: EnrichedDancer[],
  results: ResultsTree,
): DanceResults {
  const raw = results?.[groupId]?.[danceId]
  const explicitlyEmpty = raw === false
  const { reverseFrom, placings } = parsePlacings(Array.isArray(raw) ? raw : [])
  const dancersById = new Map(dancers.map((d) => [d.id, d]))

  const rows: PlacedDancerRow[] = placings.map((p, i) => {
    const tied = p.tie || (placings[i + 1]?.tie ?? false)
    let place: number | null
    if (reverseFrom != null) {
      const rest = placings.slice(i + 1)
      const nextNonTieOffset = rest.findIndex((q) => !q.tie)
      const groupEnd = nextNonTieOffset < 0 ? placings.length - 1 : i + nextNonTieOffset
      const candidate = reverseFrom - groupEnd
      place = candidate > 0 ? candidate : null
    } else {
      let pl = 1
      for (let j = 0; j <= i; j += 1) {
        if (j === 0 || !placings[j].tie) pl = j + 1
      }
      place = pl
    }
    return {
      dancerId: p.dancerId,
      dancer: lookupDancer(p.dancerId, dancersById),
      place,
      tied,
    }
  })

  if (reverseFrom != null) {
    rows.reverse()
    // Anyone entered after 1st (more than the places awarded) goes last.
    rows.sort((a, b) => Number(a.place == null) - Number(b.place == null))
  }

  return { rows, reverseFrom, explicitlyEmpty, hasResults: rows.length > 0 }
}

const dancerNumberValue = (d: EnrichedDancer | null) =>
  d?.number != null && Number.isFinite(d.number) ? d.number : Number.POSITIVE_INFINITY

export interface CallbackResults {
  dancers: Array<{ dancerId: string; dancer: EnrichedDancer | null }>
  explicitlyEmpty: boolean
  hasResults: boolean
}

export function getCallbackResults(
  groupId: string,
  dancers: EnrichedDancer[],
  results: ResultsTree,
): CallbackResults {
  const raw = results?.[groupId]?.[CALLBACKS_ID]
  const explicitlyEmpty = raw === false
  const dancersById = new Map(dancers.map((d) => [d.id, d]))
  const rows = parsePlacings(raw).placings
    .map(({ dancerId }) => ({ dancerId, dancer: lookupDancer(dancerId, dancersById) }))
    .sort((a, b) => dancerNumberValue(a.dancer) - dancerNumberValue(b.dancer))
  return { dancers: rows, explicitlyEmpty, hasResults: rows.length > 0 }
}

export function findPointedDancers(
  points: PointsTree,
  groupId: string,
  danceId: string,
  dancers: EnrichedDancer[],
): EnrichedDancer[] {
  const dancePoints = points?.[groupId]?.[danceId]
  if (!dancePoints) return []
  const seen = new Set<string>()
  for (const ids of Object.values(dancePoints)) {
    if (Array.isArray(ids)) for (const id of ids) seen.add(id)
  }
  const dancersById = new Map(dancers.map((d) => [d.id, d]))
  return [...seen]
    .map((id) => dancersById.get(id))
    .filter((d): d is EnrichedDancer => Boolean(d))
    .sort((a, b) => dancerNumberValue(a) - dancerNumberValue(b))
}

export function findGroupDancers(
  groupId: string,
  dancers: EnrichedDancer[],
): EnrichedDancer[] {
  return dancers.filter((d) => d.group?.id === groupId)
}

function dancesForGroup(group: EnrichedGroup, dances: EnrichedDance[]): EnrichedDance[] {
  const list = findGroupDances(group, dances)
  if (groupHasOverall(group)) {
    list.push({ id: OVERALL_ID, fullName: 'Overall' })
  }
  return list
}

// Unmatched dancer IDs are stored as a JS timestamp (fully numeric string).
// Real IDs are Firebase push keys (alphanumeric).
export function isPlaceholderDancerId(id: string | undefined | null): boolean {
  return !!id && /^\d+$/.test(id)
}

// One dance's placings, or its championship points, with a "?" stand-in.
function placingsHavePlaceholder(raw: unknown): boolean {
  if (!Array.isArray(raw)) return false
  return raw.some((entry) => {
    if (typeof entry !== 'string' || entry.startsWith(REVERSE_PREFIX)) return false
    return isPlaceholderDancerId(entry.endsWith(TIE_SUFFIX) ? entry.slice(0, -TIE_SUFFIX.length) : entry)
  })
}
function pointsHavePlaceholder(dancePoints: unknown): boolean {
  if (!dancePoints || typeof dancePoints !== 'object') return false
  return Object.values(dancePoints).some((ids) => Array.isArray(ids) && ids.some((id) => isPlaceholderDancerId(id)))
}

export function groupHasPlaceholderDancers(
  group: EnrichedGroup,
  results: ResultsTree,
  points: PointsTree,
): boolean {
  const groupResults = results?.[group.id]
  const groupPoints = points?.[group.id]
  // Walk whatever's actually in the tree — some legacy data has results stored
  // under (groupId, danceId) combos where the dance isn't claimed in groupIds,
  // and we still want to surface placeholders there.
  if (groupResults && typeof groupResults === 'object' && Object.values(groupResults).some(placingsHavePlaceholder)) return true
  if (groupPoints && typeof groupPoints === 'object' && Object.values(groupPoints).some(pointsHavePlaceholder)) return true
  return false
}

/** Whether one age group's dance (its placings or its points) has "?" stand-ins to fix. */
export function danceHasPlaceholder(results: ResultsTree, points: PointsTree, groupId: string, danceId: string): boolean {
  return placingsHavePlaceholder(results?.[groupId]?.[danceId]) || pointsHavePlaceholder(points?.[groupId]?.[danceId])
}

export function hasGroupAnyResults(
  group: EnrichedGroup,
  dances: EnrichedDance[],
  results: ResultsTree,
): boolean {
  const groupResults = results?.[group.id]
  if (!groupResults) return false
  const ids = [CALLBACKS_ID, ...dancesForGroup(group, dances).map((d) => d.id)]
  return ids.some((id) => parsePlacings(groupResults[id]).placings.length > 0)
}

export function isGroupInProgress(
  group: EnrichedGroup,
  dances: EnrichedDance[],
  results: ResultsTree,
): boolean {
  const groupResults = results?.[group.id]
  if (!groupResults) return false
  const ids = [CALLBACKS_ID, ...dancesForGroup(group, dances).map((d) => d.id)]
  const anyEntered = ids.some((id) => parsePlacings(groupResults[id]).placings.length > 0)
  if (!anyEntered) return false
  return ids.some((id) => !isPosted(groupResults[id]))
}
