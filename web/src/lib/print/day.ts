import { events, dances as eventDances, isSpacerId, platformLabel } from '@/lib/schedule'
import { trophyEventEntrants } from '@/lib/trophyEvents'
import type { EnrichedGroup, EnrichedTrophyEvent, StaffMember } from '@/types/competition'
import { shortName } from '@/lib/print/people'
import { dancerCounts, groupDancers, sessions } from '@/lib/print/program'
import type { PrintSource } from '@/lib/print/source'
import type { PartId, PlatformDance, Unit } from '@/lib/print/model'

// Paper for the day itself: each platform's running order, for its judge,
// steward, announcer and piper, instead of copies of a spreadsheet.

/**
 * Numbers in dancing order: the draw where there is one, else number order.
 * Anyone in the age group the draw doesn't have (a late entry) is listed
 * after it, so nobody drops off the sheet.
 */
function dancingOrder(src: PrintSource, groupId: string, danceId: string): { order: string[]; drawn: boolean; late: string[] } {
  const numbers = [...new Set(groupDancers(src, groupId).filter((d) => d.number != null).map((d) => String(d.number)))]
  const drawn = src.draws[groupId]?.[danceId] ?? []
  if (!drawn.length) return { order: numbers, drawn: false, late: [] }
  return { order: drawn, drawn: true, late: numbers.filter((n) => !drawn.includes(n)) }
}

/** A trophy event danced on its own, as a row: whoever dances it (those called back, once they are), in number order. */
function trophyEventRow(src: PrintSource, a: EnrichedTrophyEvent): PlatformDance['rows'][number] {
  const dancers = trophyEventEntrants(a, src.dancers, src.results)
  const numbers = [...new Set(dancers.filter((d) => d.number != null).map((d) => String(d.number)))]
  const order = numbers.sort((x, y) => Number(x) - Number(y) || x.localeCompare(y))
  return { group: a.fullName, count: new Set(dancers.map((d) => `${d.number ?? ''}|${d.fullName.trim().toLowerCase()}`)).size, order, drawn: false, late: [] }
}

/** One page (or more) per platform per session: every dance it runs, who judges, and who dances in what order. */
export function platformUnits(src: PrintSource): Unit[] {
  const groupsById = new Map<string, EnrichedGroup>(src.groups.map((g) => [g.id, g]))
  const trophyEventsById = new Map(src.trophyEvents.map((a) => [a.id, a]))
  const staffById = new Map(src.staff.map((m) => [m.id, m]))
  const dancesById = new Map(src.dances.map((d) => [d.id, d]))
  const counts = dancerCounts(src)

  const units: Unit[] = []
  for (const s of sessions(src)) {
    for (const p of src.platforms) {
      const runs: PlatformDance[] = []
      for (const ev of events(s.block)) {
        for (const d of eventDances(ev)) {
          const slot = d.platforms?.[p.id]
          if (!d.danceId || !slot) continue
          const rows = (slot.orderedGroupIds ?? [])
            .filter((id) => !isSpacerId(id))
            .flatMap((id) => {
              const g = groupsById.get(id)
              if (g) return [{ group: g.fullName || 'Age group', count: counts.get(g.id) ?? 0, ...dancingOrder(src, g.id, d.danceId!) }]
              const a = trophyEventsById.get(id)
              return a ? [trophyEventRow(src, a)] : []
            })
          if (!rows.length) continue
          const judges = (slot.orderedJudgeIds ?? [])
            .map((id) => staffById.get(id))
            .filter((m): m is StaffMember => !!m)
            .map(shortName)
            .join(' / ')
          runs.push({ dance: dancesById.get(d.danceId)?.fullName || d.name?.trim() || 'Dance', judges, rows })
        }
      }
      if (!runs.length) continue
      const name = platformLabel(p.name) || 'Platform'
      const key = `p:${s.id}/${p.id}`
      units.push({
        key: `${key}:h`,
        part: 'platforms',
        kind: 'heading',
        level: 1,
        title: name,
        aside: [s.title, s.time].filter(Boolean).join(' · '),
        note: 'For the judge, steward, announcer and piper: numbers in the order they dance.',
        breakBefore: true,
        keepWithNext: true,
      })
      const repeat: Unit = { key: `${key}:cont`, part: 'platforms', kind: 'heading', level: 2, title: `${name} (continued)`, aside: s.title }
      runs.forEach((dance, i) => units.push({ key: `${key}/${i}`, part: 'platforms', kind: 'platformDance', dance, repeat }))
    }
  }
  return units
}

export function dayUnits(src: PrintSource, parts: PartId[]): Unit[] {
  return parts.includes('platforms') ? platformUnits(src) : []
}

