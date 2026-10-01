import { computed } from 'vue'
import { ordered, useBuilder, type CellLocation } from './builder'

// Starting points for a schedule, from the competition's dances, age groups,
// judges and platforms. Each one is a single change, so one undo puts
// everything back.

export function useAutoFill() {
  const b = useBuilder()

  /** Age groups youngest first: by category, then within it. */
  const groupOrder = computed(() =>
    b.categories.value
      .flatMap((c) => b.groupsByCategory.value.get(c.id) ?? [])
      .concat(b.groupsByCategory.value.get('') ?? []),
  )
  const groupIdsIn = (categoryIds?: Set<string>) =>
    groupOrder.value
      .filter((g) => !categoryIds || (g.categoryId && categoryIds.has(g.categoryId)))
      .map((g) => g.id)

  /**
   * Add the competition's dances that aren't in the event yet. With
   * categories, only dances one of their age groups does (or any group).
   */
  function placeDances(blockId: string, eventId: string, categoryIds?: Set<string>) {
    const event = b.getEvent(blockId, eventId)
    if (!event) return
    const placed = new Set(ordered(event.dances).map(([, r]) => r.danceId))
    const groups = categoryIds && groupIdsIn(categoryIds)
    for (const d of b.dances.value) {
      if (placed.has(d.id)) continue
      if (
        groups &&
        !groups.some((g) => b.eligible(d.id, g)) &&
        Object.values(d.groupIds ?? {}).some(Boolean)
      )
        continue
      b.addRow(blockId, eventId, { danceId: d.id })
    }
  }

  /**
   * Share each dance's age groups across the platforms in turn, youngest
   * first. Replaces the event's age groups (and spacers).
   */
  function fillGroups(blockId: string, eventId: string, categoryIds?: Set<string>) {
    const event = b.getEvent(blockId, eventId)
    const platformIds = b.platforms.value.map((p) => p.id)
    if (!event || !platformIds.length) return
    const all = groupIdsIn(categoryIds)
    for (const [rowId, row] of ordered(event.dances)) {
      const each = platformIds.map(() => [] as string[])
      if (row.danceId)
        all
          .filter((g) => b.eligible(row.danceId, g))
          .forEach((g, i) => each[i % platformIds.length].push(g))
      platformIds.forEach((platformId, i) =>
        b.setCell('group', { blockId, eventId, danceId: rowId, platformId }, each[i]),
      )
    }
  }

  /**
   * One judge per platform, alphabetically, moving one platform along with
   * each dance so judges see different dancers. Replaces the event's judges.
   */
  function cycleJudges(blockId: string, eventId: string) {
    const event = b.getEvent(blockId, eventId)
    const platformIds = b.platforms.value.map((p) => p.id)
    const judgeIds = [...b.judges.value]
      .sort(
        (x, y) =>
          (x.lastName ?? '').localeCompare(y.lastName ?? '') ||
          (x.firstName ?? '').localeCompare(y.firstName ?? ''),
      )
      .map((j) => j.id)
    if (!event || !platformIds.length || !judgeIds.length) return
    ordered(event.dances).forEach(([rowId, row], r) => {
      platformIds.forEach((platformId, p) => {
        const loc: CellLocation = { blockId, eventId, danceId: rowId, platformId }
        const judge =
          row.danceId && p < judgeIds.length
            ? judgeIds[(((p - r) % judgeIds.length) + judgeIds.length) % judgeIds.length]
            : null
        b.setCell('judge', loc, judge ? [judge] : [])
      })
    })
  }

  /**
   * A whole day: younger categories in the morning, older in the afternoon,
   * each with Registration, their dances (age groups and judges assigned)
   * and Results. Replaces the day's sessions.
   */
  function fillSchedule() {
    const categoryIds = b.categories.value.map((c) => c.id)
    if (!categoryIds.length) return Promise.resolve(null)
    return b.edit('Autofilled the schedule', () => {
      b.clearDay()
      const half = Math.ceil(categoryIds.length / 2)
      const sessions = [
        { name: 'Morning', time: '9:00 am', categoryIds: categoryIds.slice(0, half) },
        { name: 'Afternoon', time: '1:00 pm', categoryIds: categoryIds.slice(half) },
      ].filter((s) => s.categoryIds.length)
      for (const s of sessions) {
        const blockId = b.addBlock(s.name)
        b.addEvent(blockId, 'Registration', s.time)
        const name = s.categoryIds
          .map((id) => b.categories.value.find((c) => c.id === id)?.label)
          .join(' / ')
        const eventId = b.addEvent(blockId, name)
        const set = new Set(s.categoryIds)
        placeDances(blockId, eventId, set)
        fillGroups(blockId, eventId, set)
        cycleJudges(blockId, eventId)
        b.addEvent(blockId, 'Results')
      }
    })
  }

  const run = (label: string, fn: () => void) => b.edit(label, fn)

  return {
    placeDances: (blockId: string, eventId: string, categoryIds?: Set<string>) =>
      run('Placed dances', () => placeDances(blockId, eventId, categoryIds)),
    fillGroups: (blockId: string, eventId: string) =>
      run('Assigned age groups', () => fillGroups(blockId, eventId)),
    cycleJudges: (blockId: string, eventId: string) =>
      run('Assigned judges', () => cycleJudges(blockId, eventId)),
    fillSchedule,
  }
}
