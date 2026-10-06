import { expect, test } from '@playwright/test'
import { dbGet, dbRemove, dbSet, uid } from './support/emulator'
import { account, as, callFunction, indexKey, type Account } from './support/backend'

// The Cloud Functions behind profiles, Follow and search, driven the way v4
// Manage drives them (an organiser's field-level writes): the aggregates
// (/dancers, /judges, /pipers, /venues and their :index), the back-pointers
// Follow reads (dancerId, judgeId, piperId, venueId), searchAll's
// permissions, and who may run the backfills. No browser needed, so it runs
// once (desktop project).

test.skip(({ isMobile }) => isMobile, 'Functions only: no need to run per device')
test.describe.configure({ mode: 'serial' })

const POLL = { timeout: 60_000 }
let tag: string
let comp: string
let org: Account

// Unique surnames, so nothing here meets an existing aggregate.
const surname = (s: string) => `${s}${tag}`
const index = (ns: string, key: string) => dbGet<{ id: string; appearanceCount: number } | null>(`${ns}:index/${encodeURIComponent(key)}`)
const dancerPath = (id: string) => `competitions:data/${comp}/dancers/${id}`
const write = (updates: Record<string, unknown>) => as(org, 'PATCH', '', updates)

test.beforeAll(async () => {
  tag = Math.random().toString(36).slice(2, 7)
  comp = uid('fn')
  org = await account(`${uid('fn-org')}@example.test`)
  await dbSet(`users:permissions/${org.uid}/competitions/${comp}`, true)
  await dbSet(`competitions:permissions/${comp}/users/${org.uid}`, true)
})

test.afterAll(async () => {
  await dbRemove(`competitions:data/${comp}`)
  await dbRemove(`competitions/${comp}`)
  await dbRemove(`competitions:permissions/${comp}`)
  await dbRemove(`users:permissions/${org.uid}`)
})

test('Manage edits keep profiles and back-pointers in step', async () => {
  await dbSet(`competitions/${comp}`, { name: 'Functions run', date: '2026-10-03', published: true, listed: true, venue: `Hall ${tag}`, locality: 'Calgary' })
  await dbSet(`competitions:data/${comp}`, {
    dancers: {
      [`${comp}-a`]: { firstName: 'Isla', lastName: surname('Qa'), number: '1', groupId: 'g1' },
      // The same person in a second age group (an import writes both at once).
      [`${comp}-b`]: { firstName: ' ISLA ', lastName: surname('Qa'), number: '1', groupId: 'g2' },
      [`${comp}-c`]: { firstName: 'Eilidh', lastName: surname('Qb'), number: '2', groupId: 'g1' },
    },
    staff: {
      [`${comp}-j`]: { type: 'Judge', firstName: 'Aileen', lastName: surname('Qj') },
      [`${comp}-s`]: { type: 'Sponsor', firstName: 'Highland', lastName: surname('Qs') },
    },
  })
  const isla = indexKey(`Isla ${surname('Qa')}`)
  await expect.poll(async () => (await index('dancers', isla))?.appearanceCount, POLL).toBe(2)
  const islaId = (await index('dancers', isla))!.id
  await expect.poll(() => dbGet(`${dancerPath(`${comp}-a`)}/dancerId`), POLL).toBe(islaId)
  await expect.poll(() => dbGet(`${dancerPath(`${comp}-b`)}/dancerId`), POLL).toBe(islaId)
  await expect.poll(() => dbGet(`competitions:data/${comp}/staff/${comp}-j/judgeId`), POLL).toBeTruthy()
  await expect.poll(() => dbGet(`competitions/${comp}/venueId`), POLL).toBeTruthy()
  expect(await dbGet(`competitions:data/${comp}/staff/${comp}-s`)).toEqual({ type: 'Sponsor', firstName: 'Highland', lastName: surname('Qs') })

  // Rename (fixing a typo): the entry moves, the old name goes.
  await write({ [`${dancerPath(`${comp}-c`)}/lastName`]: surname('Qc') })
  await expect.poll(() => index('dancers', indexKey(`Eilidh ${surname('Qb')}`)), POLL).toBeNull()
  const eilidh = indexKey(`Eilidh ${surname('Qc')}`)
  await expect.poll(async () => (await index('dancers', eilidh))?.id ?? null, POLL).not.toBeNull()
  await expect.poll(async () => (await dbGet(`${dancerPath(`${comp}-c`)}/dancerId`)) === (await index('dancers', eilidh))?.id, POLL).toBe(true)

  // Add, then Undo straight away: nothing is left behind.
  await write({ [dancerPath(`${comp}-undo`)]: { firstName: 'Undo', lastName: surname('Qu'), number: '9' } })
  await write({ [dancerPath(`${comp}-undo`)]: null })

  // A judge who turns out to be the piper.
  await write({ [`competitions:data/${comp}/staff/${comp}-j/type`]: 'Piper' })
  await expect.poll(() => dbGet(`competitions:data/${comp}/staff/${comp}-j/piperId`), POLL).toBeTruthy()
  expect(await dbGet(`competitions:data/${comp}/staff/${comp}-j/judgeId`)).toBeNull()
  await expect.poll(() => index('judges', indexKey(`Aileen ${surname('Qj')}`)), POLL).toBeNull()

  // The venue's town changes (picking it again in Details).
  await write({ [`competitions/${comp}/locality`]: 'Okotoks' })
  const okotoks = `${indexKey(`Hall ${tag}`)}|okotoks`
  await expect.poll(async () => (await index('venues', okotoks))?.id ?? null, POLL).not.toBeNull()
  await expect.poll(async () => (await dbGet(`competitions/${comp}/venueId`)) === (await index('venues', okotoks))?.id, POLL).toBe(true)
  expect(await index('venues', `${indexKey(`Hall ${tag}`)}|calgary`)).toBeNull()

  expect(await dbGet(dancerPath(`${comp}-undo`))).toBeNull()
  expect(await index('dancers', indexKey(`Undo ${surname('Qu')}`))).toBeNull()
})

test('profiles show what Manage says is public: listed shows staff and venue, published adds dancers', async () => {
  const isla = indexKey(`Isla ${surname('Qa')}`)
  const piper = indexKey(`Aileen ${surname('Qj')}`)
  const venue = `${indexKey(`Hall ${tag}`)}|okotoks`
  const islaId = (await index('dancers', isla))!.id
  // Listed only: dancers come off; staff and venue stay.
  await write({ [`competitions/${comp}/published`]: false })
  await expect.poll(() => index('dancers', isla), POLL).toBeNull()
  await expect.poll(() => dbGet(`${dancerPath(`${comp}-a`)}/dancerId`), POLL).toBeNull()
  expect(await index('pipers', piper)).not.toBeNull()
  expect(await index('venues', venue)).not.toBeNull()

  // Unlisted (Manage's Unlist switch writes both): nothing shows.
  await write({ [`competitions/${comp}/listed`]: false, [`competitions/${comp}/published`]: false })
  await expect.poll(() => index('pipers', piper), POLL).toBeNull()
  await expect.poll(() => index('venues', venue), POLL).toBeNull()
  await expect.poll(() => dbGet(`competitions:data/${comp}/staff/${comp}-j/piperId`), POLL).toBeNull()

  // Published (the Publish switch lists it too): everything's back, under the
  // same ids, so anyone following still is.
  await write({ [`competitions/${comp}/published`]: true, [`competitions/${comp}/listed`]: true })
  await expect.poll(async () => (await index('dancers', isla))?.appearanceCount, POLL).toBe(2)
  expect((await index('dancers', isla))?.id).toBe(islaId)
  await expect.poll(() => dbGet(`${dancerPath(`${comp}-b`)}/dancerId`), POLL).toBeTruthy()
  await expect.poll(() => dbGet(`competitions:data/${comp}/staff/${comp}-j/piperId`), POLL).toBeTruthy()
  await expect.poll(async () => (await index('venues', venue))?.id ?? null, POLL).not.toBeNull()
})

test('searchAll shows each person only what they may see', async () => {
  const priv = uid('fn-priv')
  const owner = await account(`${uid('fn-owner')}@example.test`)
  const parent = await account(`${uid('fn-parent')}@example.test`)
  const admin = await account(`${uid('fn-admin')}@example.test`)
  await dbSet(`users:permissions/${owner.uid}/competitions/${priv}`, true)
  await dbSet(`users:permissions/${admin.uid}/admin`, true)
  const hidden = surname('Hidden')
  await dbSet(`competitions/${priv}`, { name: `Private ${hidden}`, date: '2026-10-05', published: false, listed: false, organisations: { [`${priv}-org`]: true, [`${priv}-off`]: false } })
  await dbSet(`competitions:data/${priv}`, {
    dancers: { [`${priv}-d`]: { firstName: 'Dancer', lastName: hidden, number: '1' } },
    staff: { [`${priv}-j`]: { type: 'Judge', firstName: 'Judge', lastName: hidden } },
  })
  type Found = { grouped_hits?: unknown[]; hits?: unknown[] } | null
  const seen = async (who: Account | null) => {
    const r = await callFunction<Record<'dancers' | 'judges' | 'competitions', Found>>('searchAll', { q: hidden }, who)
    expect(r.status).toBe(200)
    return {
      dancers: r.result?.dancers?.grouped_hits?.length ?? 0,
      judges: r.result?.judges?.grouped_hits?.length ?? 0,
      competitions: r.result?.competitions?.hits?.length ?? 0,
    }
  }
  try {
    // Indexed by the triggers a moment after the write.
    await expect.poll(async () => (await seen(admin)).dancers, POLL).toBe(1)
    expect(await seen(admin)).toEqual({ dancers: 1, judges: 1, competitions: 1 })
    expect(await seen(owner)).toEqual({ dancers: 1, judges: 1, competitions: 1 })
    expect(await seen(parent)).toEqual({ dancers: 0, judges: 0, competitions: 0 })
    expect(await seen(null)).toEqual({ dancers: 0, judges: 0, competitions: 0 })
    // A hit carries the competition's organisations, so it leads with them.
    type Hits = { hits?: Array<{ document?: { organisations?: string[] } }> }
    const r = await callFunction<Record<'competitions', Hits>>('searchAll', { q: hidden, types: ['competitions'] }, admin)
    expect(r.result?.competitions?.hits?.[0]?.document?.organisations).toEqual([`${priv}-org`])

    // Odd input from anyone answers cleanly (it's callable without signing in).
    for (const data of [{ q: '' }, { q: '*' }, { q: 'a'.repeat(5000) }, { q: 42 }, { q: 'x', types: 'dancers' }, { q: 'x', perGroup: 'lots' }, { q: 'x', perGroup: 1e6 }, null]) {
      expect((await callFunction('searchAll', data, null)).status, JSON.stringify(data)?.slice(0, 40)).toBe(200)
    }
  } finally {
    await dbRemove(`competitions:data/${priv}`)
    await dbRemove(`competitions/${priv}`)
    await dbRemove(`users:permissions/${owner.uid}`)
    await dbRemove(`users:permissions/${admin.uid}`)
  }
})

test('only a system admin can run a backfill or reindex', async () => {
  const someone = await account(`${uid('fn-someone')}@example.test`)
  for (const name of ['backfillDancerAggregates', 'backfillDancerBackPointers', 'backfillVenueAggregates', 'reindexCompetitions', 'reindexJudges', 'reindexDancers', 'reindexCompetitionsPublished', 'backfillCoords']) {
    expect((await callFunction(name, { dryRun: true }, null)).status, `${name} signed out`).toBe(401)
    expect((await callFunction(name, { dryRun: true }, someone)).status, `${name} as a non-admin`).toBe(403)
    expect((await callFunction(name, { dryRun: true }, org)).status, `${name} as an organiser`).toBe(403)
  }
})

test('deleting a competition removes what it contributed', async () => {
  await write({ [`competitions/${comp}`]: null, [`competitions:data/${comp}`]: null })
  await expect.poll(() => index('dancers', indexKey(`Isla ${surname('Qa')}`)), POLL).toBeNull()
  await expect.poll(() => index('pipers', indexKey(`Aileen ${surname('Qj')}`)), POLL).toBeNull()
  await expect.poll(() => index('venues', `${indexKey(`Hall ${tag}`)}|okotoks`), POLL).toBeNull()
  // …without bringing any of it back as an empty shell.
  expect(await dbGet(`competitions/${comp}`)).toBeNull()
  expect(await dbGet(`competitions:data/${comp}`)).toBeNull()
})
