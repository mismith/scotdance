// The demo world the store shots show. "Today" is the Saturday of the 2026
// Cowal Highland Gathering in Dunoon, World Championship finals day, laid
// out as the real timetable has it. The dancers are made up, as are the
// other competitions (in real towns). A parent from Canmore follows three
// dancers: sisters Isla and Hazel Morrison, in the morning's Pre Premier, and
// their friend Freya Duncan, in the Juvenile World Championship final.
//
// DEMO_DAY is fixed so every run draws the same shots; the app is told it's
// that day with `?now=` (an emulator-build override, lib/now).
import { OFFSET } from './stack.ts'

export const DEMO_DAY = '2026-08-29' // Saturday at Cowal
export const DEMO_USER = {
  email: 'demo@scotdance.test',
  password: 'demo-password',
  name: 'Morag Morrison',
}
export const FOLLOWING = ['Isla Morrison', 'Hazel Morrison', 'Freya Duncan']
// Her colours for them (stores/dancerColors): teal, pink and orange.
const COLOURS = ['dancer-6', 'dancer-7', 'dancer-8']
export const TODAY_ID = 'cowal-2026'

const NS = 'development'
const DB = `http://127.0.0.1:${9009 + OFFSET}`
const AUTH = `http://127.0.0.1:${9099 + OFFSET}`

async function db<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${DB}/${NS}/${path}.json?ns=scotdance`, {
    method,
    // The emulator treats "owner" as an admin that bypasses the rules.
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`)
  return (await res.json()) as T
}
export const dbGet = <T = unknown>(path: string): Promise<T> => db<T>('GET', path)
export const dbSet = (path: string, value: unknown) => db('PUT', path, value)

const day = (offset: number) => {
  const d = new Date(`${DEMO_DAY}T12:00:00`)
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

// Mirror of normalizeName (functions/src/utility/normalize.ts).
const normalizeName = (name: string) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ')

// A small, seeded shuffle, so every run deals the same.
function random(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

// prettier-ignore
const FIRST = ['Ava', 'Olivia', 'Emily', 'Sophie', 'Grace', 'Mia', 'Ella', 'Lucy', 'Ruby', 'Chloe', 'Amelia', 'Lily', 'Eilidh', 'Kirsty', 'Maeve', 'Rowan', 'Ailsa', 'Niamh', 'Iona', 'Skye', 'Harper', 'Nora', 'Clara', 'Elise', 'Sadie', 'Callum', 'Ewan', 'Rory', 'Fiona', 'Tessa', 'Brynn', 'Leah', 'Abby', 'Zoe', 'Erin', 'Kate', 'Mairi', 'Jess', 'Molly', 'Anna', 'Isobel', 'Catriona', 'Morven', 'Heather', 'Kayleigh', 'Megan', 'Holly', 'Robyn']
// prettier-ignore
const LAST = ['MacLeod', 'Campbell', 'Stewart', 'Robertson', 'Thomson', 'Anderson', 'Fraser', 'Reid', 'Ross', 'Grant', 'Kerr', 'Mackenzie', 'Sinclair', 'Munro', 'Cameron', 'Wallace', 'Paterson', 'Gordon', 'Hamilton', 'Murdoch', 'Baird', 'Drummond', 'Ogilvie', 'Lindsay', 'Chen', 'Patel', 'Nguyen', 'Kowalski', 'Dubois', 'Okafor', 'Buchanan', 'McIntyre', 'Galbraith', 'Forsyth', 'Lamont', 'Sutherland']
// prettier-ignore
const TOWNS = ['Calgary, AB', 'Edmonton, AB', 'Canmore, AB', 'Red Deer, AB', 'Vancouver, BC', 'Kelowna, BC', 'Regina, SK', 'Winnipeg, MB']
// Worlds draws dancers from everywhere.
// prettier-ignore
const WORLD = ['Glasgow, Scotland', 'Edinburgh, Scotland', 'Aberdeen, Scotland', 'Inverness, Scotland', 'Stirling, Scotland', 'Belfast, N. Ireland', 'Toronto, ON', 'Calgary, AB', 'Halifax, NS', 'Vancouver, BC', 'Brisbane, QLD', 'Melbourne, VIC', 'Auckland, NZ', 'Christchurch, NZ', 'Cape Town, SA', 'Houston, TX', 'Boston, MA']

const DANCES: Record<string, string> = {
  pdb: 'Pas de Basque',
  pdbhc: 'Pas de Basque & High Cuts',
  fling: 'Highland Fling',
  sword: 'Sword Dance',
  seann: 'Seann Triubhas',
  reel: 'Highland Reel',
  flora: "Flora MacDonald's Fancy",
  jig: 'Irish Jig',
  hornpipe: "Sailor's Hornpipe",
}
const STEPS: Record<string, string> = { fling: '4', sword: '2&1', seann: '3&1', reel: '' }

interface GroupSpec {
  key: string
  name: string
  size: number
}
interface CategorySpec {
  key: string
  name: string
  groups: GroupSpec[]
  dances: string[]
}

/** An event on the schedule: a time, and the categories it runs (on one platform, or split across two). */
interface EventSpec {
  name: string
  time: string
  categories: string[]
  platforms: string[]
}
interface DaySpec {
  name: string
  /** Days from the competition's first day. */
  index: number
  blocks: { name: string; time: string; events: EventSpec[] }[]
}

/** What a competition runs: its categories, platforms and schedule, and where its dancers come from. */
interface Programme {
  categories: CategorySpec[]
  platforms: string[]
  days: DaySpec[]
  towns: string[]
}

const BOTH = ['Platform A', 'Platform B']

// A Canadian one-day competition: Primary to Premier, two platforms.
// prettier-ignore
const LOCAL: Programme = {
  categories: [
    { key: 'pri', name: 'Primary', dances: ['pdb', 'pdbhc', 'fling', 'sword'], groups: [{ key: 'u6', name: '6 & Under', size: 6 }, { key: '7', name: '7 & 8', size: 7 }] },
    { key: 'beg', name: 'Beginner', dances: ['fling', 'sword', 'seann', 'reel'], groups: [{ key: '9u', name: '9 & Under', size: 8 }, { key: '10', name: '10 & Over', size: 7 }] },
    { key: 'nov', name: 'Novice', dances: ['fling', 'sword', 'seann', 'flora'], groups: [{ key: '10', name: '10 & Under', size: 8 }, { key: '11', name: '11 & Over', size: 8 }] },
    { key: 'int', name: 'Intermediate', dances: ['fling', 'sword', 'seann', 'reel'], groups: [{ key: '11', name: '11 & 12', size: 9 }, { key: '13', name: '13 & Over', size: 8 }] },
    { key: 'pre', name: 'Premier', dances: ['fling', 'sword', 'seann', 'reel', 'jig', 'hornpipe'], groups: [{ key: '12', name: '12 & 13', size: 8 }, { key: '14', name: '14 & 15', size: 9 }, { key: '16', name: '16 & Over', size: 7 }] },
  ],
  platforms: BOTH,
  days: [
    {
      name: 'Saturday',
      index: 0,
      blocks: [
        { name: 'Morning', time: '8:30 am', events: [
          { name: 'Primary', time: '8:30 am', categories: ['pri'], platforms: BOTH },
          { name: 'Beginner', time: '9:15 am', categories: ['beg'], platforms: BOTH },
          { name: 'Novice', time: '10:00 am', categories: ['nov'], platforms: BOTH },
        ] },
        { name: 'Afternoon', time: '12:30 pm', events: [
          { name: 'Intermediate', time: '12:30 pm', categories: ['int'], platforms: BOTH },
          { name: 'Premier', time: '2:00 pm', categories: ['pre'], platforms: BOTH },
        ] },
      ],
    },
  ],
  towns: TOWNS,
}

// Cowal, as its 2026 timetable has it (cowalgathering.com): World
// Championship qualifiers on the Thursday, the Scottish National
// Championships on the Friday, and on Saturday the Argyllshire
// Championships and the Pre Premier in the morning, then the World
// Championship finals from 12:15. Its Main and East platforms are A and B
// here: the app shows "Main Platform" as "Platform Main Platform".
// prettier-ignore
const COWAL: Programme = {
  categories: [
    { key: 'arg', name: 'Argyllshire Championship', dances: ['fling', 'sword', 'seann', 'reel'], groups: [{ key: '12', name: '12 & 13', size: 9 }, { key: '14', name: '14 & 15', size: 9 }, { key: '16', name: '16 & Over', size: 8 }] },
    { key: 'pp', name: 'Pre Premier', dances: ['fling', 'sword', 'seann', 'reel'], groups: [{ key: '9u', name: '9 & Under', size: 10 }, { key: '10', name: '10 & 11', size: 10 }, { key: '12', name: '12 & Over', size: 10 }] },
    { key: 'world', name: 'World Championship', dances: ['fling', 'sword', 'seann', 'reel'], groups: [{ key: 'juv', name: 'Juvenile', size: 20 }, { key: 'jun', name: 'Junior', size: 20 }, { key: 'adult', name: 'Adult', size: 20 }] },
  ],
  platforms: ['Platform A', 'Platform B'],
  days: [
    { name: 'Thursday', index: 0, blocks: [{ name: 'World Championship qualifiers', time: '8:30 am', events: [
      { name: 'Adult qualifiers', time: '8:30 am', categories: [], platforms: ['Platform A'] },
      { name: 'Junior qualifiers', time: '8:30 am', categories: [], platforms: ['Platform B'] },
    ] }] },
    { name: 'Friday', index: 1, blocks: [{ name: 'Scottish National Championships', time: '8:30 am', events: [
      { name: 'Scottish National Championships', time: '8:30 am', categories: [], platforms: ['Platform A', 'Platform B'] },
    ] }] },
    { name: 'Saturday', index: 2, blocks: [
      { name: 'Morning', time: '8:30 am', events: [
        { name: 'Argyllshire Championship', time: '8:30 am', categories: ['arg'], platforms: ['Platform A'] },
        { name: 'Pre Premier', time: '10:30 am', categories: ['pp'], platforms: ['Platform B'] },
      ] },
      { name: 'World Championship finals', time: '12:15 pm', events: [
        { name: 'World Championship', time: '12:15 pm', categories: ['world'], platforms: ['Platform A'] },
      ] },
    ] },
  ],
  towns: WORLD,
}

/** Where each followed dancer dances: their group, number, and how they place (1-based) per dance, if known. */
interface Star {
  name: string
  group: string // `${category}-${group}`
  number?: number
  places?: Record<string, number>
  /** Where they dance in each dance's order (1-based). */
  draw?: number
}

interface CompetitionSpec {
  id: string
  name: string
  /** Days from DEMO_DAY to its first day. */
  offset: number
  venue: string
  address?: string
  location: string
  country?: string
  lat: number
  lng: number
  description?: string
  programme?: Programme
  /** Followed dancers entered here. */
  stars?: Star[]
  /** Which categories have every result in (the rest have none), or 'all'. */
  done?: string[] | 'all'
  /** Results in for only the first dances of these groups: group → dance count. */
  partly?: Record<string, number>
  /** Whether to fill dancers, schedule and results, or just the listing. */
  full?: boolean
}

// prettier-ignore
const COMPETITIONS: CompetitionSpec[] = [
  {
    id: TODAY_ID,
    name: 'Cowal Highland Gathering',
    offset: -2,
    venue: 'Dunoon Stadium',
    location: 'Dunoon, Scotland',
    country: 'GB',
    lat: 55.9496,
    lng: -4.9262,
    description: 'Home of the World Highland Dancing Championships, with pipe bands, heavy events and dancers from all over the world.',
    programme: COWAL,
    full: true,
    stars: [
      { name: 'Freya Duncan', group: 'world-juv', number: 170, draw: 6, places: { fling: 1, sword: 3 } },
      { name: 'Isla Morrison', group: 'pp-12', number: 145, places: { fling: 1, sword: 2, seann: 1, reel: 3, overall: 1 } },
      { name: 'Hazel Morrison', group: 'pp-9u', number: 114, places: { fling: 2, sword: 1, seann: 4, reel: 3, overall: 2 } },
    ],
    done: ['arg', 'pp'],
    partly: { 'world-juv': 2 },
  },
  {
    id: 'lochvale-2026', name: 'Lochvale Highland Gathering', offset: -28, venue: 'Lochvale Grounds', location: 'Calgary, AB', lat: 51.04, lng: -114.07, full: true, done: 'all',
    stars: [
      { name: 'Hazel Morrison', group: 'beg-9u', places: { fling: 3, sword: 2, seann: 1, reel: 2, overall: 2 } },
      { name: 'Isla Morrison', group: 'int-11', places: { fling: 2, sword: 1, seann: 1, reel: 4, overall: 1 } },
      { name: 'Freya Duncan', group: 'pre-14', places: { fling: 4, sword: 2, seann: 5, reel: 3, jig: 1, hornpipe: 2, overall: 3 } },
    ],
  },
  {
    id: 'prairie-thistle-2026', name: 'Prairie Thistle Open', offset: -42, venue: 'Westerner Park', location: 'Red Deer, AB', lat: 52.26, lng: -113.81, full: true, done: 'all',
    stars: [
      { name: 'Hazel Morrison', group: 'beg-9u', places: { fling: 5, sword: 4, seann: 2, reel: 6 } },
      { name: 'Isla Morrison', group: 'int-11', places: { fling: 1, sword: 2, seann: 3, reel: 2, overall: 2 } },
      { name: 'Freya Duncan', group: 'pre-14', places: { fling: 2, sword: 1, seann: 3, reel: 1, jig: 4, hornpipe: 3, overall: 1 } },
    ],
  },
  {
    id: 'bow-river-2026', name: 'Bow River Spring Championships', offset: -63, venue: 'Bow River Hall', location: 'Calgary, AB', lat: 51.05, lng: -114.06, full: true, done: 'all',
    stars: [
      { name: 'Hazel Morrison', group: 'beg-9u', places: { fling: 4, seann: 3 } },
      { name: 'Isla Morrison', group: 'int-11', places: { fling: 3, sword: 1, seann: 2, overall: 3 } },
      { name: 'Freya Duncan', group: 'pre-14', places: { sword: 3, reel: 2, hornpipe: 1, overall: 4 } },
    ],
  },
  { id: 'harbourside-2026', name: 'Harbourside Highland Games', offset: 7, venue: 'Harbourside Park', location: 'Victoria, BC', lat: 48.43, lng: -123.37, full: true, stars: [{ name: 'Isla Morrison', group: 'int-11' }] },
  { id: 'saltire-cup-2026', name: 'Saltire Cup', offset: 14, venue: 'Northlands Hall', location: 'Edmonton, AB', lat: 53.55, lng: -113.49, full: true, stars: [{ name: 'Hazel Morrison', group: 'beg-9u' }, { name: 'Isla Morrison', group: 'int-11' }] },
  { id: 'cedar-hills-2026', name: 'Cedar Hills Gathering', offset: 21, venue: 'Cedar Hills Fairgrounds', location: 'Kelowna, BC', lat: 49.89, lng: -119.5 },
  { id: 'kinloch-2026', name: 'Kinloch Highland Games', offset: 28, venue: 'Kinloch Park', location: 'Regina, SK', lat: 50.45, lng: -104.61 },
  { id: 'thistle-rose-2026', name: 'Thistle & Rose Championships', offset: 35, venue: 'Assiniboine Hall', location: 'Winnipeg, MB', lat: 49.9, lng: -97.14 },
  { id: 'coastal-open-2026', name: 'Coastal Open', offset: 42, venue: 'Seaside Pavilion', location: 'Vancouver, BC', lat: 49.28, lng: -123.12 },
]

const JUDGES = ['Catriona Bell', 'Morven Ellis', 'Alasdair Wyllie', 'Jean Lockhart']
const PIPERS = ['Duncan MacRae', 'Ishbel Forbes']

function build(spec: CompetitionSpec, n: number) {
  const id = spec.id
  const programme = spec.programme ?? LOCAL
  const rand = random(n * 7919 + 17)
  const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)]
  const k = (s: string) => `${id}-${s}`

  const categories: Record<string, object> = {}
  const groups: Record<string, { name: string; categoryId: string; _order: number }> = {}
  const dances: Record<
    string,
    { name: string; steps: string | null; _order: number; groupIds: Record<string, true> }
  > = {}
  const dancers: Record<
    string,
    {
      firstName: string
      lastName: string
      number: number
      groupId: string
      location: string
    }
  > = {}
  const results: Record<string, Record<string, string[]>> = {}
  const draws: Record<string, Record<string, string[]>> = {}

  let order = 0
  const danceKeys = [...new Set(programme.categories.flatMap((c) => c.dances))]
  danceKeys.forEach(
    (d, i) =>
      (dances[k(`dance-${d}`)] = {
        name: DANCES[d],
        steps: STEPS[d] || null,
        _order: i,
        groupIds: {},
      }),
  )

  // Numbers in order, skipping the ones the followed dancers wear.
  const taken = new Set((spec.stars ?? []).map((s) => s.number).filter(Boolean))
  let last = 100
  const nextNumber = () => {
    do last++
    while (taken.has(last))
    return last
  }
  const used = new Set(FOLLOWING)
  programme.categories.forEach((c, ci) => {
    categories[k(`cat-${c.key}`)] = { name: c.name, _order: ci }
    for (const g of c.groups) {
      const gid = k(`grp-${c.key}-${g.key}`)
      groups[gid] = { name: g.name, categoryId: k(`cat-${c.key}`), _order: order++ }
      for (const d of c.dances) dances[k(`dance-${d}`)].groupIds[gid] = true

      const ids: string[] = []
      const stars = (spec.stars ?? []).filter((s) => s.group === `${c.key}-${g.key}`)
      for (let i = 0; i < g.size; i++) {
        const star = stars[i]
        const number = star?.number ?? nextNumber()
        let first: string, surname: string
        if (star) [first, surname] = star.name.split(' ')
        else {
          do [first, surname] = [pick(FIRST), pick(LAST)]
          while (used.has(`${first} ${surname}`))
          used.add(`${first} ${surname}`)
        }
        const did = k(`dancer-${number}`)
        dancers[did] = {
          firstName: first,
          lastName: surname,
          number,
          groupId: gid,
          location: star ? 'Canmore, AB' : pick(programme.towns),
        }
        ids.push(did)
      }

      // Draws: each dance in a different order, a followed dancer where the spec puts them.
      draws[gid] = Object.fromEntries(
        c.dances.map((d) => {
          const order = [...ids].sort(() => rand() - 0.5)
          stars.forEach((s, si) => {
            if (!s.draw) return
            order.splice(order.indexOf(ids[si]), 1)
            order.splice(s.draw - 1, 0, ids[si])
          })
          return [k(`dance-${d}`), order.map((x) => String(dancers[x].number))]
        }),
      )

      // Results: the top six, with each followed dancer where the spec puts them.
      const doneAll = spec.done === 'all' || spec.done?.includes(c.key)
      const partly = spec.partly?.[`${c.key}-${g.key}`]
      if (!doneAll && !partly) continue
      const posted = [
        ...c.dances.slice(0, partly ?? c.dances.length),
        ...(doneAll && c.key !== 'pri' ? ['overall'] : []),
      ]
      results[gid] = {}
      for (const d of posted) {
        const placed: (string | undefined)[] = Array(Math.min(6, ids.length)).fill(
          undefined,
        )
        for (const s of stars) {
          const place = s.places?.[d]
          const sid = ids[stars.indexOf(s)]
          if (place && place <= placed.length) placed[place - 1] = sid
        }
        // Everyone else, at random; a followed dancer only places where the spec says.
        const rest = ids
          .filter((x, xi) => !placed.includes(x) && !stars[xi])
          .sort(() => rand() - 0.5)
        results[gid][d === 'overall' ? 'overall' : k(`dance-${d}`)] = placed
          .map((x) => x ?? rest.shift()!)
          .filter(Boolean)
      }
    }
  })

  const platformId = (name: string) => k(`plat-${programme.platforms.indexOf(name)}`)
  const platforms = Object.fromEntries(
    programme.platforms.map((name, i) => [k(`plat-${i}`), { name, _order: i }]),
  )
  const judges = JUDGES.map((_, i) => k(`judge-${i}`))
  const staff = {
    ...Object.fromEntries(
      JUDGES.map((full, i) => {
        const [firstName, lastName] = full.split(' ')
        return [
          judges[i],
          { firstName, lastName, type: 'Judge', location: TOWNS[i * 2], _order: i },
        ]
      }),
    ),
    ...Object.fromEntries(
      PIPERS.map((full, i) => {
        const [firstName, lastName] = full.split(' ')
        return [k(`piper-${i}`), { firstName, lastName, type: 'Piper', _order: 10 + i }]
      }),
    ),
  }

  // The schedule: each event runs its categories' dances, its groups split
  // across its platforms.
  const groupIdsOf = (ck: string) =>
    Object.keys(groups).filter((g) => g.includes(`-grp-${ck}-`))
  const event = (eid: string, e: EventSpec) => {
    const gids = e.categories.flatMap(groupIdsOf)
    const danceList = [
      ...new Set(
        programme.categories
          .filter((c) => e.categories.includes(c.key))
          .flatMap((c) => c.dances),
      ),
    ]
    const per = Math.ceil(gids.length / e.platforms.length)
    return {
      name: e.name,
      description: e.time,
      dances: Object.fromEntries(
        danceList.map((d, i) => [
          `${eid}-d${i}`,
          {
            danceId: k(`dance-${d}`),
            order: i,
            platforms: Object.fromEntries(
              e.platforms.map((p, pi) => [
                platformId(p),
                {
                  orderedGroupIds: gids.slice(pi * per, (pi + 1) * per),
                  orderedJudgeIds: [judges[pi % judges.length]],
                },
              ]),
            ),
          },
        ]),
      ),
    }
  }
  const schedule = {
    days: Object.fromEntries(
      programme.days.map((d, di) => {
        const dk = `day${di + 1}`
        return [
          k(dk),
          {
            order: di,
            date: day(spec.offset + d.index),
            name: d.name,
            blocks: Object.fromEntries(
              d.blocks.map((b, bi) => [
                k(`${dk}-b${bi + 1}`),
                {
                  order: bi,
                  name: b.name,
                  description: b.time,
                  events: Object.fromEntries(
                    b.events.map((e, ei) => [
                      k(`${dk}-b${bi + 1}-e${ei + 1}`),
                      { order: ei, ...event(k(`${dk}-b${bi + 1}-e${ei + 1}`), e) },
                    ]),
                  ),
                },
              ]),
            ),
          },
        ]
      }),
    ),
  }

  const competition = {
    name: spec.name,
    date: day(spec.offset),
    venue: spec.venue,
    address: spec.address ?? null,
    location: spec.location,
    country: spec.country ?? 'CA',
    lat: spec.lat,
    lng: spec.lng,
    description: spec.description ?? null,
    published: true,
    listed: true,
  }
  const data = spec.full
    ? { categories, groups, dances, dancers, platforms, staff, schedule, draws, results }
    : null
  return { competition, data }
}

async function waitUntil(what: string, check: () => Promise<boolean>, seconds = 180) {
  for (let i = 0; i < seconds * 2; i++) {
    if (await check()) return
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`Timed out waiting for ${what}`)
}

export async function ensureUser(email: string, password: string) {
  const call = (op: string) =>
    fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:${op}?key=fake`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }).then((r) => r.json() as Promise<{ localId?: string }>)
  const created = await call('signUp')
  if (created.localId) return created.localId
  const signedIn = await call('signInWithPassword')
  if (!signedIn.localId)
    throw new Error(`Couldn't make the demo account: ${JSON.stringify(signedIn)}`)
  return signedIn.localId
}

/** A followed dancer's profile id (the aggregator makes a new one each seed). */
export async function personId(name: string) {
  const entry = await dbGet<{ id: string } | null>(`dancers:index/${normalizeName(name)}`)
  if (!entry) throw new Error(`No profile for ${name}: is the demo seeded?`)
  return entry.id
}

export async function seedDemo() {
  if (await dbGet(`competitions/${TODAY_ID}`)) {
    console.log('Demo data already in.')
    return
  }
  console.log('Seeding the demo…')
  // Oldest first, so the aggregator meets the dancers in order. One at a
  // time: each fans out into dozens of triggers.
  const specs = [...COMPETITIONS].sort((a, b) => a.offset - b.offset)
  for (const [i, spec] of specs.entries()) {
    const { competition, data } = build(spec, i)
    await dbSet(`competitions/${spec.id}`, competition)
    await dbSet(`competitions:published/${spec.id}`, true)
    if (data) await dbSet(`competitions:data/${spec.id}`, data)
  }

  // The aggregator merges each followed dancer's entries into one person.
  const appearances = (name: string) =>
    COMPETITIONS.filter((c) => c.full && c.stars?.some((s) => s.name === name)).length
  const people: Record<string, string> = {}
  for (const name of FOLLOWING) {
    await waitUntil(`${name}'s profile`, async () => {
      const entry = await dbGet<{ id: string; appearanceCount?: number } | null>(
        `dancers:index/${normalizeName(name)}`,
      )
      if (entry?.appearanceCount !== appearances(name)) return false
      people[name] = entry.id
      return true
    })
  }

  const uid = await ensureUser(DEMO_USER.email, DEMO_USER.password)
  await dbSet(`users/${uid}/displayName`, DEMO_USER.name)
  await dbSet(`users:favorites/${uid}`, {
    dancers: Object.fromEntries(FOLLOWING.map((name) => [people[name], name])),
    competitions: { [TODAY_ID]: true },
  })
  await dbSet(
    `users:dancerColors/${uid}`,
    Object.fromEntries(FOLLOWING.map((name, i) => [people[name], COLOURS[i]])),
  )
  // She helps run Cowal, for the organiser shot.
  await dbSet(`users:permissions/${uid}/competitions/${TODAY_ID}`, true)
  await dbSet(`competitions:permissions/${TODAY_ID}/users/${uid}`, true)
  console.log('Demo seeded.')
}
