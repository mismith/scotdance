import { formatLongDate } from '@/lib/format'
import { registrationLabel, registrations } from '@/lib/registration'
import { findGroupDances } from '@/lib/results'
import { blocks, dances as eventDances, dayLabel, days, events, idList, isSpacerId, platformLabel } from '@/lib/schedule'
import { clockMinutes } from '@/lib/scheduleProgress'
import { stripTags } from '@/lib/stripTags'
import { groupHasOverall, type EnrichedDancer, type EnrichedGroup, type ScheduleBlock, type StaffMember } from '@/types/competition'
import { isType, person, shortName, sponsorName } from '@/lib/print/people'
import { placesFor, type PlacesRule } from '@/lib/print/places'
import { numberKey, type PrintSource } from '@/lib/print/source'
import { WIDE_GRID, type CoverSheet, type GridCell, type GridRow, type PartId, type Unit, type UnitOf } from '@/lib/print/model'

// The program: a cover, then each session's platform grid followed by its
// age groups (each one's dancers, a grid to write the placings in, and its
// trophy; a championship's draw before it). Laid out the way organisers'
// own programs are (Edmonton, Calgary, the SDCCS), from what's in Manage.

/** A description's first line when it's a time ("8:30 am"), and the rest. */
export function timeAndNote(description: string | undefined): { time?: string; note?: string } {
  const lines = stripTags(description ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  if (!lines.length) return {}
  if (clockMinutes(lines[0]) != null) return { time: lines[0], note: lines.slice(1).join(' ') || undefined }
  return { note: lines.join(' ') }
}

/**
 * An age group's dancers, once each, by number. Some older competitions hold
 * a dancer once per dance they entered: on paper they're one dancer.
 */
export function groupDancers(src: PrintSource, groupId: string): EnrichedDancer[] {
  const seen = new Set<string>()
  return src.dancers
    .filter((d) => d.groupId === groupId)
    .filter((d) => {
      const key = `${d.number ?? ''}|${d.fullName.trim().toLowerCase()}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => (a.number ?? Infinity) - (b.number ?? Infinity) || a.fullName.localeCompare(b.fullName))
}

/** How many dance in each age group (once each). */
export const dancerCounts = (src: PrintSource) => new Map(src.groups.map((g) => [g.id, groupDancers(src, g.id).length]))

/** Each session (a day's block), named as its pages head it: "Morning", or "Saturday · Morning" over several days. */
export function sessions(src: PrintSource): Array<{ id: string; title: string; block: ScheduleBlock; time?: string; note?: string }> {
  const all = days(src.schedule)
  return all.flatMap((day, i) =>
    blocks(day).map((block, j) => {
      const name = block.name?.trim() || (blocks(day).length > 1 ? `Session ${j + 1}` : '')
      const dayName = all.length > 1 ? dayLabel(day, i) : ''
      const title = [dayName, name].filter(Boolean).join(' · ') || 'Schedule'
      return { id: `${day.id}/${block.id}`, title, block, ...timeAndNote(block.description) }
    }),
  )
}

export function coverSheet(src: PrintSource): CoverSheet {
  const c = src.competition
  // Its first day, and its last where the schedule's days are dated (stored
  // as timestamps or as text, as the old admin did).
  const dated = days(src.schedule)
    .map((d) => formatLongDate(d.date))
    .filter(Boolean)
  const first = formatLongDate(c?.date) || dated[0] || ''
  const last = dated.length > 1 ? dated[dated.length - 1] : ''
  const dates = last && last !== first ? `${first} to ${last}` : first
  return {
    name: c?.name?.trim() || 'Untitled competition',
    dates,
    venue: c?.venue?.trim() || undefined,
    address: [c?.address, c?.location].map((s) => s?.trim()).filter(Boolean).join(', ') || undefined,
    registrations: registrations(c?.sobhd).map((r) => `${registrationLabel(r)}: ${r.number}`),
    image: c?.image || undefined,
    sessions: sessions(src).map((s) => ({ label: s.title, time: s.time })),
    judges: src.staff.filter((m) => isType(m, 'judge')).map(person),
    pipers: src.staff.filter((m) => isType(m, 'piper')).map(person),
  }
}

function coverUnits(src: PrintSource): Unit[] {
  return [{ key: 'cover', part: 'cover', kind: 'cover', fullPage: true, cover: coverSheet(src) }]
}

/**
 * The platform grid, as paper programs draw it: per session, each event's
 * dances down the side and its platforms across, every cell naming the
 * judge (they rotate dance by dance) and the age groups in the order they
 * dance. A line with no dance ("Primary awards") runs across.
 */
export function scheduleUnits(src: PrintSource): Unit[] {
  return sessions(src).flatMap((s) => sessionUnits(src, s))
}

type Session = ReturnType<typeof sessions>[number]

/** One session's platform grid, on a page of its own. */
export function sessionUnits(src: PrintSource, s: Session): Unit[] {
  const groupsById = new Map<string, EnrichedGroup>(src.groups.map((g) => [g.id, g]))
  const staffById = new Map(src.staff.map((m) => [m.id, m]))
  const dancesById = new Map(src.dances.map((d) => [d.id, d]))
  const evs = events(s.block)
  if (!evs.length) return []
  const units: Unit[] = [{ key: `s:${s.id}`, part: 'schedule', kind: 'heading', level: 1, title: s.title, aside: s.time, note: s.note, breakBefore: true, keepWithNext: true }]
  for (const ev of evs) {
    const ds = eventDances(ev)
    // Only the platforms this event uses.
    const used = src.platforms.filter((p) =>
      ds.some((d) => {
        const slot = d.platforms?.[p.id]
        return !!slot && ((slot.orderedGroupIds?.length ?? 0) > 0 || (slot.orderedJudgeIds?.length ?? 0) > 0)
      }),
    )
    const own = timeAndNote(ev.description)
    const head: UnitOf<'gridHead'>['head'] = {
      title: ev.name?.trim() || 'Event',
      time: own.time,
      platforms: used.map((p) => platformLabel(p.name) || 'Platform'),
    }
    const key = `e:${s.id}/${ev.id}`
    const repeat: Unit = { key: `${key}:cont`, part: 'schedule', kind: 'gridHead', head, continued: true }
    units.push({ key, part: 'schedule', kind: 'gridHead', head, keepWithNext: true })
    for (const d of ds) {
      let row: GridRow | null = null
      if (d.danceId) {
        const dance = dancesById.get(d.danceId)
        const custom = d.name?.trim() && !/^\d+$/.test(d.name.trim()) ? d.name.trim() : ''
        const cells = used.map<GridCell | null>((p) => {
          const slot = d.platforms?.[p.id]
          if (!slot) return null
          const lines = (slot.orderedGroupIds ?? []).flatMap((id) => {
            if (isSpacerId(id)) return [null]
            const g = groupsById.get(id)
            return g ? [{ group: g.fullName || 'Age group' }] : []
          })
          const judges = (slot.orderedJudgeIds ?? [])
            .map((id) => staffById.get(id))
            .filter((m): m is StaffMember => !!m)
            .map(shortName)
            .join(' / ')
          return { judges, lines }
        })
        row = { kind: 'dance', name: dance?.fullName || custom || 'Dance', cells }
      } else if (d.name?.trim()) {
        row = { kind: 'note', text: d.name.trim() }
      }
      if (row) units.push({ key: `${key}/${d.id}`, part: 'schedule', kind: 'gridRow', row, columns: used.length, repeat })
    }
  }
  // A session with a grid too wide to stand up goes sideways, all of it.
  if (units.some((u) => u.kind === 'gridHead' && u.head.platforms.length >= WIDE_GRID)) {
    for (const u of units) {
      u.rotate = true
      if (u.repeat) u.repeat.rotate = true
    }
  }
  return units
}

/** The session each age group first dances in. */
export function firstSessions(src: PrintSource): Map<string, string> {
  const first = new Map<string, string>()
  for (const s of sessions(src)) {
    for (const ev of events(s.block)) {
      for (const d of eventDances(ev)) {
        for (const slot of Object.values(d.platforms ?? {})) {
          for (const id of idList(slot?.orderedGroupIds)) if (!first.has(id)) first.set(id, s.id)
        }
      }
    }
  }
  return first
}

/**
 * How an age group dances: one order for every dance (its dancers are
 * listed in it), or a draw that differs dance by dance, as a championship's
 * does (printed as its Draw).
 */
export function groupOrder(src: PrintSource, g: EnrichedGroup): { order?: string[]; draw?: Array<{ dance: string; list: string[] }> } {
  const lists = findGroupDances(g, src.dances).map((d) => ({ dance: d.fullName, list: src.draws[g.id]?.[d.id] ?? [] }))
  const drawn = lists.filter((d) => d.list.length)
  if (!drawn.length) return {}
  const same = drawn.length === lists.length && drawn.every((d) => d.list.join() === drawn[0].list.join())
  return same ? { order: drawn[0].list } : { draw: drawn }
}

/** An age group's dancers in the order they dance (anyone the draw missed after, by number), else by number. */
export function orderedDancers(src: PrintSource, g: EnrichedGroup): EnrichedDancer[] {
  const dancers = groupDancers(src, g.id)
  const order = groupOrder(src, g).order
  if (!order) return dancers
  const at = (d: EnrichedDancer) => {
    const i = order.indexOf(numberKey(d.number))
    return i < 0 ? Infinity : i
  }
  return [...dancers].sort((a, b) => at(a) - at(b))
}

const DRAW_ROWS = 32

/** A draw that differs dance by dance: who dances when, one column per dance, as Edmonton and the SDCCS print it. */
export function drawUnits(src: PrintSource, g: EnrichedGroup): Unit[] {
  const lists = groupOrder(src, g).draw
  if (!lists) return []
  const units: Unit[] = []
  const length = Math.max(...lists.map((d) => d.list.length))
  for (let from = 0; from < length; from += DRAW_ROWS) {
    const rows = Array.from({ length: Math.min(DRAW_ROWS, length - from) }, (_, i) => lists.map((d) => d.list[from + i] ?? ''))
    units.push({ key: `d:${g.id}:${from}`, part: 'groups', kind: 'draw', draw: { group: g.fullName || 'Age group', dances: lists.map((d) => d.dance), rows, from } })
  }
  return units
}

/**
 * A page per age group with dancers: its dancers, an empty grid to write
 * the placings in as they're announced, and its trophy; its draw on a page
 * of its own before it, where the draw differs dance by dance.
 */
export function ageGroupUnits(src: PrintSource, places: PlacesRule, groups: EnrichedGroup[] = src.groups): Unit[] {
  const staffById = new Map(src.staff.map((m) => [m.id, m]))
  return groups.flatMap((g): Unit[] => {
    const dancers = orderedDancers(src, g)
    if (!dancers.length) return []
    const draw = drawUnits(src, g)
    return [
      ...draw.map((u, i) => (i ? u : ({ ...u, breakBefore: true } as Unit))),
      {
        key: `g:${g.id}`,
        part: 'groups',
        kind: 'ageGroup',
        breakBefore: true,
        group: {
          title: g.fullName || 'Age group',
          dancers: dancers.map((d) => ({ number: d.number, name: d.fullName, location: d.location?.trim() || undefined })),
          dances: findGroupDances(g, src.dances).map((d) => d.fullName),
          places: placesFor(dancers.length, places),
          overall: groupHasOverall(g),
          trophy: g.trophy?.trim() || undefined,
          sponsor: sponsorName(g.sponsor, staffById),
        },
      },
    ]
  })
}

export interface ProgramOptions {
  places: PlacesRule
}

/**
 * The program, as organisers lay theirs out: the cover, then each session's
 * schedule followed by the age groups that start dancing in it (in the
 * organiser's order), so a family reads the morning, then the morning's
 * groups, then the afternoon.
 */
export function programUnits(src: PrintSource, parts: PartId[], opts: ProgramOptions): Unit[] {
  const on = new Set(parts)
  const first = firstSessions(src)
  const groupsIn = (session?: string) => (on.has('groups') ? ageGroupUnits(src, opts.places, src.groups.filter((g) => first.get(g.id) === session)) : [])
  return [
    ...(on.has('cover') ? coverUnits(src) : []),
    ...sessions(src).flatMap((s) => [...(on.has('schedule') ? sessionUnits(src, s) : []), ...groupsIn(s.id)]),
    // Any not on the schedule yet, at the end.
    ...groupsIn(undefined),
  ]
}
