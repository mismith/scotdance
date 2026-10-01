import type { Schedule, ScheduleDance } from '@/types/competition'

// The schedule is a tree: days › sessions (blocks) › events › items (a
// dance, or "Registration", "Results"…). Siblings are ordered by `order`,
// falling back to their key, the same way the public pages sort them.

export type Level = 'day' | 'block' | 'event' | 'item'
export const LEVELS: Level[] = ['day', 'block', 'event', 'item']
export const CHILD_KEY: Record<Level, 'days' | 'blocks' | 'events' | 'dances'> = {
  day: 'days',
  block: 'blocks',
  event: 'events',
  item: 'dances',
}

export interface Node {
  id: string
  level: Level
  /** Path under competitions:data/{id}, e.g. schedule/days/x/blocks/y. */
  path: string
  /** Route params down to this node. */
  params: { dayId?: string; blockId?: string; eventId?: string; itemId?: string }
  name?: string
  description?: string
  date?: string
  order?: number
  danceId?: string
  platforms?: ScheduleDance['platforms']
  children: Node[]
}

type RawNode = { name?: string; description?: string; date?: string; order?: number; danceId?: string; platforms?: ScheduleDance['platforms'] } & Record<string, unknown>

function ordered(rec: Record<string, RawNode> | undefined): Array<[string, RawNode]> {
  return Object.entries(rec ?? {})
    .filter(([, v]) => v && typeof v === 'object')
    .sort(([ak, a], [bk, b]) =>
      Number.isInteger(a.order) && Number.isInteger(b.order) ? (a.order as number) - (b.order as number) : ak.localeCompare(bk),
    )
}

const PARAM: Record<Level, keyof Node['params']> = { day: 'dayId', block: 'blockId', event: 'eventId', item: 'itemId' }

function build(rec: Record<string, RawNode> | undefined, level: Level, basePath: string, baseParams: Node['params']): Node[] {
  const childLevel = LEVELS[LEVELS.indexOf(level) + 1] as Level | undefined
  return ordered(rec).map(([id, raw]) => {
    const path = `${basePath}/${CHILD_KEY[level]}/${id}`
    const params = { ...baseParams, [PARAM[level]]: id }
    return {
      id,
      level,
      path,
      params,
      name: raw.name,
      description: raw.description,
      date: raw.date,
      order: raw.order,
      danceId: raw.danceId,
      platforms: raw.platforms,
      children: childLevel ? build(raw[CHILD_KEY[childLevel]] as Record<string, RawNode> | undefined, childLevel, path, params) : [],
    }
  })
}

export function scheduleTree(schedule: Schedule | null | undefined): Node[] {
  return build(schedule?.days as Record<string, RawNode> | undefined, 'day', 'schedule', {})
}

export function findNode(tree: Node[], params: Node['params']): Node | null {
  let level: Node[] = tree
  let found: Node | null = null
  for (const key of ['dayId', 'blockId', 'eventId', 'itemId'] as const) {
    const id = params[key]
    if (!id) break
    found = level.find((n) => n.id === id) ?? null
    if (!found) return null
    level = found.children
  }
  return found
}

/** Visit every dance item in the schedule with its path under competitions:data/{id}. */
export function forEachScheduleDance(
  schedule: Schedule | null | undefined,
  visit: (path: string, item: Omit<ScheduleDance, 'id'>) => void,
) {
  for (const [dayId, day] of Object.entries(schedule?.days ?? {}))
    for (const [blockId, block] of Object.entries(day?.blocks ?? {}))
      for (const [eventId, event] of Object.entries(block?.events ?? {}))
        for (const [itemId, item] of Object.entries(event?.dances ?? {}))
          if (item) visit(`schedule/days/${dayId}/blocks/${blockId}/events/${eventId}/dances/${itemId}`, item)
}

export const LEVEL_NAME: Record<Level, { one: string; many: string }> = {
  day: { one: 'day', many: 'days' },
  block: { one: 'session', many: 'sessions' },
  event: { one: 'event', many: 'events' },
  item: { one: 'dance', many: 'dances' },
}

export function countDescendants(n: Node): number {
  return n.children.reduce((sum, c) => sum + 1 + countDescendants(c), 0)
}
