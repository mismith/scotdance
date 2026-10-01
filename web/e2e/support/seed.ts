import { dbGet, dbRemove, dbSet, uid } from './emulator'

// A realistic two-day competition, dated relative to today so the
// competition-day screens light up without `?now=`. Shapes match what the
// old admin wrote (string dates and numbers), not just what v4 writes.

const pad = (n: number) => String(n).padStart(2, '0')
export const isoDay = (offsetDays = 0) => {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const FIRST = ['Isla', 'Ava', 'Olivia', 'Emily', 'Sophie', 'Grace', 'Mia', 'Ella', 'Lucy', 'Freya', 'Hannah', 'Ruby', 'Chloe', 'Amelia', 'Lily', 'Eilidh', 'Morag', 'Kirsty', 'Callum', 'Fraser']
const LAST = ['MacDonald', 'Campbell', 'Stewart', 'Robertson', 'Thomson', 'Anderson', 'Murray', 'Fraser', 'Reid', 'Ross', 'Grant', 'Kerr', 'Mackenzie', 'Sinclair', 'O’Neill', 'Ó Briain']
const TOWNS = ['Calgary, AB', 'Edmonton, AB', 'Vancouver, BC', 'Ottawa, ON', 'Halifax, NS', 'Glasgow']

export interface SeededCompetition {
  id: string
  name: string
  categories: Record<string, string>
  groups: { id: string; name: string; categoryId: string }[]
  dances: { id: string; name: string }[]
  dancers: { id: string; firstName: string; lastName: string; number: string; groupId: string }[]
  platforms: string[]
  judges: string[]
  days: string[]
}

export interface SeedOptions {
  id?: string
  name?: string
  /** Day offset of the first day from today (0 = today). */
  startOffset?: number
  dancersPerGroup?: number
  published?: boolean
  /** Shows in the list (its overview and staff) even before it's published. Default true. */
  listed?: boolean
  /** Fill results for the first N groups' dances. */
  resultsForGroups?: number
  /**
   * Give dancers names no other seed shares. The aggregator merges dancers by
   * name across competitions, so tests that follow someone need this, or
   * Home may show that person's day at another test's competition.
   */
  uniqueNames?: boolean
}

export async function seedCompetition(opts: SeedOptions = {}): Promise<SeededCompetition> {
  const id = opts.id ?? uid('comp')
  const name = opts.name ?? `E2E Highland Games ${id.slice(-5)}`
  const per = opts.dancersPerGroup ?? 6
  const start = opts.startOffset ?? 0

  const categories: Record<string, string> = {
    [`${id}-cat-pri`]: 'Primary',
    [`${id}-cat-beg`]: 'Beginner',
    [`${id}-cat-nov`]: 'Novice',
    [`${id}-cat-pre`]: 'Premier',
  }
  const catIds = Object.keys(categories)
  const groupNames = ['Under 7', '7 & 8 Years', '9 & 10 Years', '12 & Over']
  const groups = catIds.flatMap((categoryId, ci) =>
    groupNames.slice(0, ci === 0 ? 2 : 3).map((g, gi) => ({ id: `${id}-grp-${ci}${gi}`, name: g, categoryId })),
  )
  const dances = [
    ['Highland Fling', '4'],
    ['Sword Dance', '2&1'],
    ['Seann Triubhas', '3&1'],
    ['Reel', ''],
  ].map(([n, steps], i) => ({ id: `${id}-dance-${i}`, name: n, steps }))
  const platforms = ['A', 'B'].map((p) => `${id}-plat-${p}`)
  const judges = ['Aileen Robertson', 'Deborah Wardrope', 'Iain Fraser'].map((_, i) => `${id}-judge-${i}`)

  let n = 100
  const dancers = groups.flatMap((g, gi) =>
    Array.from({ length: per }, (_, i) => {
      n += 1
      return {
        id: `${id}-dancer-${gi}-${i}`,
        firstName: FIRST[(gi * per + i) % FIRST.length],
        lastName: opts.uniqueNames ? `${LAST[(gi + i * 3) % LAST.length]} ${id.slice(-5).toUpperCase()}` : LAST[(gi + i * 3) % LAST.length],
        number: String(n),
        groupId: g.id,
        location: TOWNS[(gi + i) % TOWNS.length],
      }
    }),
  )

  const days = [isoDay(start), isoDay(start + 1)]

  const results: Record<string, Record<string, string[]>> = {}
  for (const g of groups.slice(0, opts.resultsForGroups ?? 2)) {
    const inGroup = dancers.filter((d) => d.groupId === g.id)
    results[g.id] = Object.fromEntries(
      dances.map((d, di) => [d.id, inGroup.slice(0, 4).map((x, i) => (i === 1 && di === 0 ? `${x.id}:tie` : x.id))]),
    )
  }

  const draws: Record<string, Record<string, string[]>> = {}
  for (const g of groups.slice(0, 3)) {
    draws[g.id] = Object.fromEntries(
      dances.map((d, di) => [d.id, dancers.filter((x) => x.groupId === g.id).map((x) => x.number).reverse().slice(di % 2)]),
    )
  }

  // Day 1: morning block with Primary and Beginner, afternoon with Novice.
  // Day 2: Premier.
  const event = (eventId: string, eventName: string, groupIds: string[], time: string) => ({
    name: eventName,
    description: time,
    dances: Object.fromEntries(
      dances.slice(0, groupIds.length > 1 ? 3 : 4).map((d, i) => [
        `${eventId}-d${i}`,
        {
          danceId: d.id,
          order: i,
          platforms: {
            [platforms[0]]: { orderedGroupIds: groupIds.slice(0, Math.ceil(groupIds.length / 2)), orderedJudgeIds: [judges[0]] },
            [platforms[1]]: { orderedGroupIds: groupIds.slice(Math.ceil(groupIds.length / 2)), orderedJudgeIds: [judges[1]] },
          },
        },
      ]),
    ),
  })
  const byCat = (ci: number) => groups.filter((g) => g.categoryId === catIds[ci]).map((g) => g.id)
  const schedule = {
    days: {
      [`${id}-day1`]: {
        order: 0,
        date: days[0],
        name: 'Saturday',
        blocks: {
          [`${id}-b1`]: {
            order: 0,
            name: 'Morning',
            description: '8:30 am',
            events: {
              [`${id}-e1`]: { order: 0, ...event(`${id}-e1`, 'Primary', byCat(0), '8:30 am') },
              [`${id}-e2`]: { order: 1, ...event(`${id}-e2`, 'Beginner', byCat(1), '9:45 am') },
            },
          },
          [`${id}-b2`]: {
            order: 1,
            name: 'Afternoon',
            description: '1:00 pm',
            events: { [`${id}-e3`]: { order: 0, ...event(`${id}-e3`, 'Novice', byCat(2), '1:00 pm') } },
          },
        },
      },
      [`${id}-day2`]: {
        order: 1,
        date: days[1],
        name: 'Sunday',
        blocks: {
          [`${id}-b3`]: {
            order: 0,
            name: 'Championship',
            description: '9:00 am',
            events: { [`${id}-e4`]: { order: 0, ...event(`${id}-e4`, 'Premier', byCat(3), '9:00 am') } },
          },
        },
      },
    },
  }

  const staff = {
    ...Object.fromEntries(
      ['Aileen Robertson', 'Deborah Wardrope', 'Iain Fraser'].map((full, i) => {
        const [firstName, lastName] = full.split(' ')
        return [judges[i], { firstName, lastName, type: 'Judge', location: TOWNS[i], _order: i }]
      }),
    ),
    [`${id}-piper`]: { firstName: 'Alasdair', lastName: 'Gillies', type: 'Piper', _order: 3 },
    [`${id}-sponsor`]: { firstName: 'Calgary Highland', lastName: 'Society', type: 'Sponsor', _order: 4 },
  }

  await dbSet(`competitions/${id}`, {
    name,
    date: days[0],
    venue: 'Spruce Meadows',
    address: '18011 Spruce Meadows Way SW',
    location: 'Calgary, AB',
    country: 'CA',
    lat: 50.9,
    lng: -114.1,
    description: 'Two days of dancing.\n\nEntries close a week before.',
    sobhd: 'C-AB-CO-26-0001',
    published: opts.published ?? true,
    listed: opts.listed ?? true,
  })
  if (opts.published ?? true) await dbSet(`competitions:published/${id}`, true)
  await dbSet(`competitions:data/${id}`, {
    categories: Object.fromEntries(Object.entries(categories).map(([k, v], i) => [k, { name: v, _order: i }])),
    groups: Object.fromEntries(groups.map((g, i) => [g.id, { name: g.name, categoryId: g.categoryId, _order: i }])),
    dances: Object.fromEntries(
      dances.map((d, i) => [d.id, { name: d.name, steps: d.steps || null, _order: i, groupIds: Object.fromEntries(groups.map((g) => [g.id, true])) }]),
    ),
    dancers: Object.fromEntries(dancers.map(({ id: did, ...rest }) => [did, rest])),
    platforms: Object.fromEntries(platforms.map((p, i) => [p, { name: `Platform ${p.slice(-1)}`, _order: i }])),
    staff,
    schedule,
    draws,
    results,
  })

  return { id, name, categories, groups, dances, dancers, platforms, judges, days }
}

export async function removeCompetition(id: string) {
  // Take the access off each organiser here: the competitionDeleted trigger
  // would, but it reads competitions:permissions, which goes below.
  const perms = await dbGet<{ users?: Record<string, true> } | null>(`competitions:permissions/${id}`)
  for (const userId of Object.keys(perms?.users ?? {})) {
    await dbRemove(`users:permissions/${userId}/competitions/${id}`)
  }
  await dbRemove(`competitions/${id}`)
  await dbRemove(`competitions:published/${id}`)
  await dbRemove(`competitions:data/${id}`)
  await dbRemove(`competitions:permissions/${id}`)
}
