import { blocks, dances as eventDances, days, events, idList, platformLabel } from '@/lib/schedule'
import { findGroupDances } from '@/lib/results'
import type { PrintSource } from '@/lib/print/source'
import type { DocId } from '@/lib/print/model'

// What to look at before printing: the things paper makes permanent that
// are easy to fix in Manage first. Each says where to fix it.

export interface PrintCheck {
  id: string
  text: string
  /** Manage route name, and the item to open there. */
  route: string
  itemId?: string
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
const listed = (names: string[], max = 3) => (names.length > max ? `${names.slice(0, max).join(', ')} and ${names.length - max} more` : names.join(', '))

export function printChecks(src: PrintSource, doc: DocId): PrintCheck[] {
  const checks: PrintCheck[] = []
  const withGroup = src.dancers.filter((d) => d.group)
  const noGroup = src.dancers.filter((d) => !d.group)
  if (noGroup.length) {
    checks.push({ id: 'no-group', text: `${plural(noGroup.length, 'dancer has', 'dancers have')} no age group`, route: 'manage.dancers', itemId: noGroup[0].id })
  }
  const noNumber = withGroup.filter((d) => d.number == null)
  if (noNumber.length) {
    checks.push({ id: 'no-number', text: `${plural(noNumber.length, 'dancer has', 'dancers have')} no number`, route: 'manage.dancers', itemId: noNumber[0].id })
  }
  // One number for two people (the same dancer in two age groups is fine).
  const names = new Map<number, Set<string>>()
  for (const d of src.dancers) {
    if (d.number == null) continue
    names.set(d.number, (names.get(d.number) ?? new Set()).add(d.fullName.trim().toLowerCase()))
  }
  const shared = [...names.entries()].filter(([, who]) => who.size > 1).map(([num]) => num).sort((a, b) => a - b)
  if (shared.length) {
    checks.push({
      id: 'dup-number',
      text: shared.length === 1 ? `Number ${shared[0]} is on two different dancers` : `${shared.length} numbers are on two different dancers: ${listed(shared.map(String))}`,
      route: 'manage.dancers',
    })
  }

  const entered = src.groups.filter((g) => withGroup.some((d) => d.groupId === g.id))
  if (doc === 'program') {
    const noDances = entered.filter((g) => !findGroupDances(g, src.dances).length)
    if (noDances.length) {
      checks.push({ id: 'no-dances', text: `${listed(noDances.map((g) => g.fullName))} ${noDances.length === 1 ? 'has' : 'have'} no dances`, route: 'manage.groups', itemId: noDances[0].id })
    }
  }

  // A draw that misses someone (a late entry), lists someone twice, or lists
  // someone not in the age group prints a wrong dancing order.
  if (doc === 'program' || doc === 'day') {
    const odd: string[] = []
    let first: string | undefined
    for (const g of src.groups) {
      const numbers = new Set(src.dancers.filter((d) => d.groupId === g.id && d.number != null).map((d) => String(d.number)))
      for (const dance of findGroupDances(g, src.dances)) {
        const drawn = src.draws[g.id]?.[dance.id] ?? []
        if (!drawn.length) continue
        if (new Set(drawn).size !== drawn.length || drawn.some((n) => !numbers.has(n)) || [...numbers].some((n) => !drawn.includes(n))) {
          odd.push(g.fullName)
          first ??= g.id
          break
        }
      }
    }
    if (odd.length) {
      checks.push({
        id: 'odd-draw',
        text: odd.length === 1 ? `The draw for ${odd[0]} doesn’t match its dancers` : `Draws for ${listed(odd)} don’t match their dancers`,
        route: 'manage.groups.draws',
        itemId: first,
      })
    }
  }

  if (src.schedule) {
    const scheduled = new Set<string>()
    const noJudge: string[] = []
    let gone = 0
    for (const day of days(src.schedule)) {
      for (const block of blocks(day)) {
        for (const ev of events(block)) {
          for (const d of eventDances(ev)) {
            if (!d.danceId) continue
            const dance = src.dances.find((x) => x.id === d.danceId)
            if (!dance) {
              gone++
              continue
            }
            for (const [pid, slot] of Object.entries(d.platforms ?? {})) {
              const ids = idList(slot.orderedGroupIds)
              ids.forEach((id) => scheduled.add(id))
              if (ids.some((id) => src.groups.some((g) => g.id === id)) && !idList(slot.orderedJudgeIds).length) {
                const platform = platformLabel(src.platforms.find((p) => p.id === pid)?.name) || 'a platform'
                noJudge.push(`${dance.name?.trim() || 'a dance'} on ${platform} (${block.name?.trim() || ev.name?.trim() || 'the schedule'})`)
              }
            }
          }
        }
      }
    }
    const unscheduled = entered.filter((g) => !scheduled.has(g.id))
    if (unscheduled.length) {
      checks.push({ id: 'unscheduled', text: `${listed(unscheduled.map((g) => g.fullName))} ${unscheduled.length === 1 ? 'isn’t' : 'aren’t'} on the schedule`, route: 'manage.schedule' })
    }
    if (gone) {
      checks.push({ id: 'gone-dance', text: `${plural(gone, 'dance in the schedule no longer exists', 'dances in the schedule no longer exist')}, so ${gone === 1 ? 'it prints' : 'they print'} as “Dance”`, route: 'manage.schedule' })
    }
    if (noJudge.length) {
      checks.push({
        id: 'no-judge',
        text: noJudge.length === 1 ? `No judge for ${noJudge[0]}` : `${noJudge.length} dances have a platform with no judge, starting with ${noJudge[0]}`,
        route: 'manage.schedule',
      })
    }
  }
  return checks
}
