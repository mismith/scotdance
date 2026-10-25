// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  collapseId,
  competitionMessage,
  fcmMessage,
  getOnBackfillFollowers,
  getOnCompetitionFavoriteWritten,
  dateSpan,
  getOnCompetitionPublished,
  getOnFavoriteWritten,
  getOnLinkPublishedSettled,
  getOnResultsSettled,
  getOnResultsWritten,
  isDeadToken,
  isMorningOf,
  ordinal,
  parsePlacings,
  resultMessage,
  linkedPublishedMessage,
  sendMorningSummaries,
  type LinkPublishedTask,
  type SettleTask,
} from '../../../../functions/src/notifications'
import { FakeRtdb, snap, type TriggerEvent } from './fakeRtdb'

// Push alerts for followers (functions/src/notifications.ts). In the emulator
// nothing reaches FCM: each would-be message goes to notifications:log, which
// is what these read.

/** Database values: untyped JSON. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any

const RESULTS = 'competitions:data/{competitionId}/results/{groupId}/{danceId}'
const PUBLISHED = 'competitions/{competitionId}/published'
const DANCER_FAVORITES = 'users:favorites/{uid}/dancers/{aggregateId}'
const COMPETITION_FAVORITES = 'users:favorites/{uid}/competitions/{competitionId}'
/** FCM is never called in the emulator, so no app is needed. */
const app = null as never

const CALGARY = { lat: 51.0447, lng: -114.0719 }
const VANCOUVER = { lat: 49.2827, lng: -123.1207 }
const GLASGOW = { lat: 55.8642, lng: -4.2518 }

const on = { enabled: true }

function seed(): Json {
  return {
    competitions: {
      c1: { name: 'Calgary Highland Games', date: '2026-07-04', published: true, ...CALGARY },
    },
    'competitions:data': {
      c1: {
        categories: { pre: { name: 'Premier' } },
        groups: { g1: { name: '12 & Under', categoryId: 'pre' }, g2: { name: '13 & Over', categoryId: 'pre' } },
        dances: { fling: { name: 'Highland Fling' }, sword: { name: 'Sword Dance' } },
        dancers: {
          e1: { firstName: 'Ailsa', lastName: 'Grant', groupId: 'g1', dancerId: 'p1' },
          e2: { firstName: 'Mairi', lastName: 'Ross', groupId: 'g1', dancerId: 'p2' },
          e3: { firstName: 'Iona', lastName: 'Fraser', groupId: 'g1', dancerId: 'p3' },
          e4: { firstName: 'Kirsty', lastName: 'Bain', groupId: 'g2', dancerId: 'p4' },
          // Not linked to a person yet: nobody can follow it.
          e5: { firstName: 'Skye', lastName: 'Munro', groupId: 'g1' },
        },
      },
    },
    'dancers:followers': {
      p1: { u1: true },
      p2: { u2: true },
      p3: { u3: true, u4: true, u5: true },
      p4: { u1: true },
    },
    users: {
      u1: { alerts: on },
      u2: { alerts: on },
      // Live results off.
      u3: { alerts: { enabled: true, results: false } },
      u4: { alerts: on },
      // Alerts off altogether.
      u5: { alerts: { enabled: false } },
    },
    'users:tokens': {
      u1: { k1: { token: 'fcm-1', platform: 'ios', updatedAt: 1 }, k2: { token: 'fcm-2', platform: 'android', updatedAt: 2 } },
    },
  }
}

function setup(data: Json = seed()) {
  const rtdb = new FakeRtdb()
  rtdb.data = data
  rtdb.patterns = [RESULTS, PUBLISHED, DANCER_FAVORITES, COMPETITION_FAVORITES]
  const db = rtdb.ref() as never
  const change = (e: TriggerEvent) => ({ before: snap(e.before), after: snap(e.after) }) as never
  /** Write, then run the trigger for each event the write caused. */
  async function save(updates: Record<string, Json>, handler: (change: never, ctx: { params: Record<string, string> }) => Promise<unknown>) {
    rtdb.write(updates)
    for (const e of rtdb.events.splice(0)) await handler(change(e), { params: e.params })
  }
  /**
   * The results trigger. Its minute's pause (a Cloud Task) runs straight
   * away, or with `queue`, waits there to be run by hand.
   */
  const settled = getOnResultsSettled(db, app, true)
  const results = (emulated = true, queue?: SettleTask[]) => {
    const send = getOnResultsSettled(db, app, emulated)
    return getOnResultsWritten(db, emulated, async (task) => (queue ? queue.push(task) : send(task)))
  }
  const log = (): Json[] => Object.values(rtdb.read('notifications:log') ?? {})
  // Who heard what: the title, and for results which dance (or age group) it was.
  const said = () =>
    log()
      .map((m) => `${m.uid}: ${m.title}${m.kind === 'results' && m.body ? ` (${String(m.body).split(' · ')[0]})` : ''}`)
      .sort()
  return { rtdb, db, change, save, results, settled, log, said }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('parsePlacings', () => {
  it('places in order, with ties sharing a place', () => {
    expect(Object.fromEntries(parsePlacings(['a', 'b:tie', 'c', 'd']))).toEqual({ a: 1, b: 1, c: 3, d: 4 })
  })

  it('reads championship order, entered from Nth up to 1st', () => {
    expect(Object.fromEntries(parsePlacings(['reverse:6', 'a', 'b', 'c']))).toEqual({ a: 6, b: 5, c: 4 })
    expect(Object.fromEntries(parsePlacings(['reverse:3', 'a', 'b:tie', 'c']))).toEqual({ a: 2, b: 2, c: 1 })
  })

  it('places nobody before the first championship placing', () => {
    expect(parsePlacings(['reverse:6']).size).toBe(0)
    expect(parsePlacings(false).size).toBe(0)
    expect(parsePlacings(null).size).toBe(0)
  })

  it('skips what the app skips', () => {
    expect(Object.fromEntries(parsePlacings(['a', null, '', 'b']))).toEqual({ a: 1, b: 2 })
    expect(Object.fromEntries(parsePlacings(['reverse:0', 'a', 'b']))).toEqual({ a: 1, b: 2 })
  })
})

describe('messages', () => {
  const fling = { competitionName: 'Calgary Highland Games', groupName: 'Premier 12 & Under', danceName: 'Highland Fling', overall: false }

  it('says where a dancer placed', () => {
    expect(resultMessage(fling, 'Ailsa', 2)).toEqual({
      title: 'Ailsa placed 2nd',
      body: 'Highland Fling · Premier 12 & Under · Calgary Highland Games',
    })
    expect(resultMessage({ ...fling, overall: true, danceName: null }, 'Ailsa', 1).title).toBe('Ailsa placed 1st overall')
  })

  it('says results are in for a dancer not placed', () => {
    expect(resultMessage(fling, 'Iona')).toEqual({ title: 'Highland Fling results are in', body: 'Premier 12 & Under · Calgary Highland Games' })
    expect(resultMessage({ ...fling, overall: true }, 'Iona').title).toBe('Overall results are in')
  })

  it('copes with missing names', () => {
    expect(resultMessage({ ...fling, danceName: 'The Lilt' }, '  ', 3)).toEqual({ title: 'Your dancer placed 3rd', body: 'Lilt · Premier 12 & Under · Calgary Highland Games' })
    expect(resultMessage({ overall: false }, 'Ailsa').title).toBe('Dance results are in')
    expect(resultMessage({ overall: false }, 'Ailsa').body).toBe('')
  })

  it('writes ordinals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(ordinal)).toEqual(
      ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '101st', '111th'],
    )
  })

  it('says a competition is live', () => {
    expect(competitionMessage('published', 'Calgary Highland Games', ['Ailsa', 'Mairi', 'Iona'])).toEqual({
      title: 'Calgary Highland Games is live',
      body: 'Ailsa, Mairi and Iona are on the dancer list. See platforms and dancing order.',
    })
    expect(competitionMessage('published', 'Calgary Highland Games', ['Ailsa']).body).toBe('Ailsa is on the dancer list. See platforms and dancing order.')
    expect(competitionMessage('published', 'Calgary Highland Games', []).body).toBe('The dancer list and schedule are up.')
  })

  it('says good morning on competition day', () => {
    expect(competitionMessage('morning', 'Calgary Highland Games', ['Ailsa', 'Mairi'])).toEqual({
      title: 'Calgary Highland Games is today',
      body: 'Ailsa and Mairi are dancing. Tap for platforms and dancing order.',
    })
    expect(competitionMessage('morning', 'Calgary Highland Games', []).title).toBe('Calgary Highland Games is today')
  })

  it('sends FCM a notification with its link, grouped by competition, replacing what it corrects', () => {
    const key = 'c1/g1/fling/u1_e1'
    expect(fcmMessage({ title: 'T', body: 'B', link: '/competitions/c1/results/g1', competitionId: 'c1', kind: 'results', key }, ['fcm-1'])).toEqual({
      tokens: ['fcm-1'],
      notification: { title: 'T', body: 'B' },
      data: { link: '/competitions/c1/results/g1' },
      apns: {
        headers: { 'apns-collapse-id': collapseId(key) },
        payload: { aps: { sound: 'default', threadId: 'c1', 'interruption-level': 'time-sensitive', 'relevance-score': 1 } },
      },
      android: { notification: { channelId: 'results', tag: collapseId(key), icon: 'ic_stat_scott', color: '#0065bd' } },
      fcmOptions: { analyticsLabel: 'results' },
    })
    // Short enough for APNs (64 bytes), and the same every time.
    expect(collapseId(key)).toHaveLength(43)
    expect(collapseId(key)).toBe(collapseId(key))
  })

  it('lets a dancer list going up wait quietly, on its own Android channel', () => {
    const m = fcmMessage({ title: 'T', body: 'B', link: '/competitions/c1/info', competitionId: 'c1', kind: 'published', key: 'c1/published/u1' }, ['fcm-1'])
    expect(m.apns?.payload?.aps).toEqual({ threadId: 'c1', 'interruption-level': 'passive', 'relevance-score': 0.4 })
    expect(m.android?.notification?.channelId).toBe('published')
  })

  it('forgets only tokens FCM says will never work', () => {
    expect(isDeadToken({ code: 'messaging/registration-token-not-registered' })).toBe(true)
    expect(isDeadToken({ code: 'messaging/invalid-registration-token' })).toBe(true)
    expect(isDeadToken({ code: 'messaging/invalid-argument', message: 'The registration token is not a valid FCM registration token' })).toBe(true)
    // A bad message isn't a bad token.
    expect(isDeadToken({ code: 'messaging/invalid-argument', message: 'Invalid APNs payload' })).toBe(false)
    expect(isDeadToken({ code: 'messaging/internal-error' })).toBe(false)
    expect(isDeadToken(undefined)).toBe(false)
  })
})

describe('result alerts', () => {
  const fling = 'competitions:data/c1/results/g1/fling'

  it('tells followers where their dancer placed, and the rest that results are in', async () => {
    const { save, results, log, said } = setup()
    await save({ [fling]: ['e2', 'e1'] }, results())
    expect(said()).toEqual([
      'u1: Ailsa placed 2nd (Highland Fling)',
      'u2: Mairi placed 1st (Highland Fling)',
      // u3 has live results off, u5 all alerts.
      'u4: Highland Fling results are in (Premier 12 & Under)',
    ])
    const ailsa = log().find((m) => m.uid === 'u1')
    expect(ailsa).toMatchObject({
      body: 'Highland Fling · Premier 12 & Under · Calgary Highland Games',
      link: '/competitions/c1/results/g1#dance-fling',
      kind: 'results',
      competitionId: 'c1',
      tokens: 2,
    })
    expect(typeof ailsa.at).toBe('number')
  })

  it('says overall placings, and skips callbacks', async () => {
    const { save, results, said } = setup()
    const handler = results()
    await save({ 'competitions:data/c1/results/g1/callbacks': ['e1', 'e2'] }, handler)
    expect(said()).toEqual([])
    await save({ 'competitions:data/c1/results/g1/overall': ['e1'] }, handler)
    expect(said()).toEqual(['u1: Ailsa placed 1st overall (Premier 12 & Under)', 'u2: Overall results are in (Premier 12 & Under)', 'u4: Overall results are in (Premier 12 & Under)'])
  })

  it('sends each placing once, however often it is saved', async () => {
    const { rtdb, save, results, said } = setup()
    const handler = results()
    await save({ [fling]: ['e2', 'e1'] }, handler)
    // A "?" added below: nobody's place changes.
    await save({ [fling]: ['e2', 'e1', '1751600000000'] }, handler)
    expect(said()).toHaveLength(3)
    // The same event twice (events can arrive more than once).
    rtdb.write({ [fling]: ['e1', 'e2'] })
    const [swap] = rtdb.events.splice(0)
    await handler({ before: snap(swap.before), after: snap(swap.after) } as never, { params: swap.params })
    await handler({ before: snap(swap.before), after: snap(swap.after) } as never, { params: swap.params })
    // A correction: both places changed, so both are told again.
    expect(said()).toEqual([
      'u1: Ailsa placed 1st (Highland Fling)',
      'u1: Ailsa placed 2nd (Highland Fling)',
      'u2: Mairi placed 1st (Highland Fling)',
      'u2: Mairi placed 2nd (Highland Fling)',
      'u4: Highland Fling results are in (Premier 12 & Under)',
    ])
  })

  it('says nothing until someone is placed', async () => {
    const { save, results, said } = setup()
    const handler = results()
    await save({ [fling]: ['reverse:6'] }, handler)
    await save({ [fling]: false }, handler)
    expect(said()).toEqual([])
  })

  it('waits for the organiser to pause, then sends what stands', async () => {
    const { save, results, settled, said } = setup()
    const queue: SettleTask[] = []
    const handler = results(true, queue)
    await save({ [fling]: ['e1'] }, handler)
    await save({ [fling]: ['e2', 'e1'] }, handler)
    expect(queue).toHaveLength(2)
    expect(said()).toEqual([])
    // A minute on: the first save was changed since, so only the second sends.
    await settled(queue[0])
    expect(said()).toEqual([])
    await settled(queue[1])
    expect(said()).toEqual([
      'u1: Ailsa placed 2nd (Highland Fling)',
      'u2: Mairi placed 1st (Highland Fling)',
      'u4: Highland Fling results are in (Premier 12 & Under)',
    ])
  })

  it('queues nothing when nobody follows anyone in the age group', async () => {
    const { rtdb, save, results, said } = setup()
    rtdb.data['dancers:followers'] = {}
    const queue: SettleTask[] = []
    await save({ [fling]: ['e1'] }, results(true, queue))
    expect(queue).toEqual([])
    expect(said()).toEqual([])
  })

  // ADR 0008: a favourite with alerts turned off stays a favourite, silently.
  it('skips a favourite dancer whose alerts are turned off', async () => {
    const data = seed()
    data['users:alertsOff'] = { u1: { dancers: { p1: true } }, u4: { dancers: { p3: true } } }
    const { save, results, said } = setup(data)
    await save({ [fling]: ['e2', 'e1'] }, results())
    expect(said()).toEqual(['u2: Mairi placed 1st (Highland Fling)'])
  })

  it('queues nothing when every favourite in the age group has alerts off', async () => {
    const data = seed()
    data['users:alertsOff'] = { u1: { dancers: { p1: true } }, u2: { dancers: { p2: true } }, u3: { dancers: { p3: true } }, u4: { dancers: { p3: true } }, u5: { dancers: { p3: true } } }
    const { save, results, said } = setup(data)
    const queue: SettleTask[] = []
    await save({ [fling]: ['e1'] }, results(true, queue))
    expect(queue).toEqual([])
    expect(said()).toEqual([])
  })

  it('says nothing for unpublished or (outside the emulator) old competitions', async () => {
    const hidden = setup()
    hidden.rtdb.data.competitions.c1.published = false
    await hidden.save({ [fling]: ['e1'] }, hidden.results())
    expect(hidden.said()).toEqual([])

    const old = setup()
    old.rtdb.data.competitions.c1.date = '2019-07-04'
    await old.save({ [fling]: ['e1'] }, old.results(false))
    expect(old.said()).toEqual([])
    expect(old.rtdb.read('notifications:sent')).toBeNull()
  })
})

describe('competition alerts', () => {
  it('tells followers when a competition goes live, once', async () => {
    const data = seed()
    data.competitions.c1.published = false
    data['competitions:followers'] = { c1: { u2: true, u6: true } }
    data.users.u6 = { alerts: on }
    const { db, save, log, said } = setup(data)
    const handler = getOnCompetitionPublished(db, app, true)
    await save({ 'competitions/c1/published': true }, handler)
    // u3 has live results off, which doesn't stop this; u5 has alerts off.
    expect(said()).toEqual([
      'u1: Calgary Highland Games is live',
      'u2: Calgary Highland Games is live',
      'u3: Calgary Highland Games is live',
      'u4: Calgary Highland Games is live',
      'u6: Calgary Highland Games is live',
    ])
    const body = (uid: string) => log().find((m) => m.uid === uid)?.body
    expect(body('u1')).toBe('Ailsa and Kirsty are on the dancer list. See platforms and dancing order.')
    expect(body('u2')).toBe('Mairi is on the dancer list. See platforms and dancing order.')
    expect(body('u6')).toBe('The dancer list and schedule are up.')
    expect(log()[0]).toMatchObject({ kind: 'published', competitionId: 'c1', link: '/competitions/c1/info' })

    // Unpublished and published again: nobody hears twice.
    await save({ 'competitions/c1/published': false }, handler)
    await save({ 'competitions/c1/published': true }, handler)
    expect(log()).toHaveLength(5)
  })

  it('leaves out favourites with alerts off, unless the competition’s own alerts are on', async () => {
    const data = seed()
    data.competitions.c1.published = false
    // u1: Ailsa's alerts off, Kirsty's on. u2: Mairi's off, but the competition's on.
    // u4: Iona's off and nothing else, so nothing.
    data['users:alertsOff'] = { u1: { dancers: { p1: true } }, u2: { dancers: { p2: true } }, u4: { dancers: { p3: true } } }
    data['competitions:followers'] = { c1: { u2: true } }
    const { db, save, log, said } = setup(data)
    await save({ 'competitions/c1/published': true }, getOnCompetitionPublished(db, app, true))
    expect(said()).toEqual([
      'u1: Calgary Highland Games is live',
      'u2: Calgary Highland Games is live',
      'u3: Calgary Highland Games is live',
    ])
    const body = (uid: string) => log().find((m) => m.uid === uid)?.body
    expect(body('u1')).toBe('Kirsty is on the dancer list. See platforms and dancing order.')
    expect(body('u2')).toBe('The dancer list and schedule are up.')
  })

  it('says nothing when an old competition is published (outside the emulator)', async () => {
    const data = seed()
    data.competitions.c1 = { ...data.competitions.c1, published: false, date: '2019-07-04' }
    const { db, save, said } = setup(data)
    await save({ 'competitions/c1/published': true }, getOnCompetitionPublished(db, app, false))
    expect(said()).toEqual([])
  })
})

describe('morning summaries', () => {
  const at = (iso: string) => Date.parse(iso)

  it('knows when it is 6am on competition day where the competition is', () => {
    const day = '2026-07-04'
    // Calgary: MDT, UTC−6.
    expect(isMorningOf({ date: day, ...CALGARY }, at('2026-07-04T12:30:00Z'))).toBe(true)
    expect(isMorningOf({ date: day, ...CALGARY }, at('2026-07-04T11:30:00Z'))).toBe(false)
    expect(isMorningOf({ date: day, ...CALGARY }, at('2026-07-04T13:30:00Z'))).toBe(false)
    expect(isMorningOf({ date: day, ...CALGARY }, at('2026-07-05T12:30:00Z'))).toBe(false)
    // Vancouver: PDT, UTC−7.
    expect(isMorningOf({ date: day, ...VANCOUVER }, at('2026-07-04T13:30:00Z'))).toBe(true)
    expect(isMorningOf({ date: day, ...VANCOUVER }, at('2026-07-04T12:30:00Z'))).toBe(false)
    // Glasgow: BST (UTC+1) in summer, GMT in winter.
    expect(isMorningOf({ date: day, ...GLASGOW }, at('2026-07-04T05:30:00Z'))).toBe(true)
    expect(isMorningOf({ date: day, ...GLASGOW }, at('2026-07-04T06:30:00Z'))).toBe(false)
    expect(isMorningOf({ date: '2026-01-10', ...GLASGOW }, at('2026-01-10T06:30:00Z'))).toBe(true)
  })

  it('reads ISO and ms dates as the day where the competition is', () => {
    // Midnight in Calgary, stored as an instant.
    const midnight = '2026-07-04T06:00:00.000Z'
    expect(isMorningOf({ date: midnight, ...CALGARY }, at('2026-07-04T12:30:00Z'))).toBe(true)
    expect(isMorningOf({ date: Date.parse(midnight), ...CALGARY }, at('2026-07-04T12:30:00Z'))).toBe(true)
  })

  it('never fires without coordinates or a date', () => {
    expect(isMorningOf({ date: '2026-07-04' }, at('2026-07-04T12:30:00Z'))).toBe(false)
    expect(isMorningOf({ ...CALGARY }, at('2026-07-04T12:30:00Z'))).toBe(false)
    expect(isMorningOf({ date: '2026-07-04', lat: 200, lng: 0 }, at('2026-07-04T12:30:00Z'))).toBe(false)
  })

  function morningData(): Json {
    const data = seed()
    const comp = (name: string, extra: Json) => ({ name, date: '2026-07-04', published: true, ...extra })
    data.competitions = {
      c1: data.competitions.c1,
      iso: comp('Banff Games', { ...CALGARY, date: '2026-07-04T06:00:00.000Z' }),
      ms: comp('Canmore Games', { ...CALGARY, date: Date.parse('2026-07-04T06:00:00.000Z') }),
      van: comp('Vancouver Games', VANCOUVER),
      gla: comp('Glasgow Games', GLASGOW),
      nowhere: comp('Somewhere Games', {}),
      hidden: comp('Hidden Games', { ...CALGARY, published: false }),
      past: comp('Past Games', { ...CALGARY, date: '2026-06-01' }),
    }
    data['competitions:followers'] = Object.fromEntries(Object.keys(data.competitions).map((id) => [id, { u6: true }]))
    data.users.u6 = { alerts: on }
    return data
  }

  it('sends each competition its summary at 6am local, once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { rtdb, db, log, said } = setup(morningData())
    const calgary6am = at('2026-07-04T12:30:00Z')
    // Calgary, and Banff and Canmore (in Calgary's zone, dated as an instant).
    expect(await sendMorningSummaries(db, app, true, calgary6am)).toEqual({ competitions: 3, messages: 7 })
    expect(said()).toEqual([
      'u1: Calgary Highland Games is today',
      'u2: Calgary Highland Games is today',
      // Live results off, but the morning summary on.
      'u3: Calgary Highland Games is today',
      'u4: Calgary Highland Games is today',
      'u6: Banff Games is today',
      'u6: Calgary Highland Games is today',
      'u6: Canmore Games is today',
    ])
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toMatch(/\b1 published competition/)
    expect(log()[0]).toMatchObject({ kind: 'morning', body: 'Tap for platforms and dancing order.', link: expect.stringMatching(/^\/competitions\/\w+\/info$/) })

    // A second run in the same hour sends nothing new.
    await sendMorningSummaries(db, app, true, calgary6am)
    expect(log()).toHaveLength(7)

    // An hour later it's Vancouver's turn.
    await sendMorningSummaries(db, app, true, at('2026-07-04T13:30:00Z'))
    expect(said().filter((line) => line.includes('Vancouver'))).toEqual(['u6: Vancouver Games is today'])
    expect(rtdb.read('notifications:sent/van/morning/u6')).toBe('morning:2026-07-04')
  })

  it('leaves out favourites with alerts off', async () => {
    const data = morningData()
    data['users:alertsOff'] = { u1: { dancers: { p1: true, p4: true } }, u2: { dancers: { p2: true } } }
    const { db, said } = setup(data)
    await sendMorningSummaries(db, app, true, at('2026-07-04T12:30:00Z'))
    expect(said().filter((line) => line.includes('Calgary'))).toEqual([
      'u3: Calgary Highland Games is today',
      'u4: Calgary Highland Games is today',
      'u6: Calgary Highland Games is today',
    ])
  })
})

describe('follower indexes', () => {
  it('follow and unfollow keep the reverse indexes in step', async () => {
    const { rtdb, db, save } = setup({})
    const dancers = getOnFavoriteWritten(db)
    const competitions = getOnCompetitionFavoriteWritten(db)
    await save({ 'users:favorites/u1/dancers/p1': 'Ailsa Grant' }, dancers)
    await save({ 'users:favorites/u1/competitions/c1': true }, competitions)
    expect(rtdb.read('dancers:followers')).toEqual({ p1: { u1: true } })
    expect(rtdb.read('competitions:followers')).toEqual({ c1: { u1: true } })
    await save({ 'users:favorites/u1/dancers/p1': null }, dancers)
    await save({ 'users:favorites/u1/competitions/c1': null }, competitions)
    expect(rtdb.read('dancers:followers')).toBeNull()
    expect(rtdb.read('competitions:followers')).toBeNull()
  })

  it('leaves out the old app’s per-competition dancer keys', async () => {
    const { rtdb, db, save } = setup({ 'users:favorites': { u1: { oldDancers: { e9: 'p1' } } } })
    const dancers = getOnFavoriteWritten(db)
    // The old app's unnamed key, and a named one already copied to its person.
    await save({ 'users:favorites/u1/dancers/e8': true }, dancers)
    await save({ 'users:favorites/u1/dancers/e9': 'Ailsa Grant' }, dancers)
    expect(rtdb.read('dancers:followers')).toBeNull()
  })

  it('backfill builds them from existing favourites, repeatably', async () => {
    const { rtdb, db } = setup({
      'users:favorites': {
        // e1 and e2 are the old app's per-competition keys: e2's copied to p2.
        u1: { dancers: { p1: 'Ailsa Grant', e1: true, e2: 'Mairi Ross', p2: 'Mairi Ross' }, oldDancers: { e2: 'p2' }, competitions: { c1: true }, judges: { j1: true } },
        u2: { dancers: { p1: 'Ailsa Grant' } },
      },
    })
    const backfill = getOnBackfillFollowers(db)
    expect(await backfill()).toEqual({ dancerFollows: 3, competitionFollows: 1 })
    expect(await backfill()).toEqual({ dancerFollows: 3, competitionFollows: 1 })
    expect(rtdb.read('dancers:followers')).toEqual({ p1: { u1: true, u2: true }, p2: { u1: true } })
    expect(rtdb.read('competitions:followers')).toEqual({ c1: { u1: true } })
  })
})

describe('linked competitions going live (ADR 0007)', () => {
  /** c1 and c2 linked, both unpublished; u1 and u2 follow dancers in each, u3 and u4 only in c1, u6 the competition c1. */
  function linkedSet() {
    const data = seed()
    data.competitions.c1.published = false
    data.competitions.c2 = { name: 'Calgary Closed Championship', date: '2026-07-05', published: false, ...CALGARY }
    data['competitions:data'].c2 = {
      dancers: {
        f1: { firstName: 'Ailsa', lastName: 'Grant', groupId: 'g1', dancerId: 'p1' },
        f6: { firstName: 'Fiona', lastName: 'Baird', groupId: 'g1', dancerId: 'p6' },
      },
    }
    data['dancers:followers'].p6 = { u2: true }
    data['competitions:followers'] = { c1: { u6: true } }
    data.users.u6 = { alerts: on }
    data.competitionLinks = { L1: { primary: 'c1', competitions: { c1: true, c2: true } } }
    data['competitionLinks:of'] = { c1: 'L1', c2: 'L1' }
    return setup(data)
  }

  it('waits for the set, then tells each person once about all of theirs', async () => {
    const { db, rtdb, save, log, said } = linkedSet()
    const queue: LinkPublishedTask[] = []
    const handler = getOnCompetitionPublished(db, app, true, async (task) => { queue.push(task) })
    await save({ 'competitions/c1/published': true, 'competitions/c2/published': true }, handler)
    expect(log()).toEqual([])
    expect(queue).toEqual([{ linkId: 'L1' }, { linkId: 'L1' }])
    rtdb.write({ 'notifications:live/c1': { since: 0, ready: true }, 'notifications:live/c2': { since: 0, ready: true } })
    const settled = getOnLinkPublishedSettled(db, app, true, () => 1000)
    // Both tasks run side by side; one held back throws, and Cloud Tasks runs it again.
    let pending = queue
    for (let round = 0; round < 5 && pending.length; round += 1) {
      const outcomes = await Promise.allSettled(pending.map(settled))
      pending = pending.filter((_, i) => outcomes[i].status === 'rejected')
    }
    expect(pending).toEqual([])
    expect(said()).toEqual([
      'u1: 2 competitions are live, Jul 4–5',
      'u2: 2 competitions are live, Jul 4–5',
      'u3: Calgary Highland Games is live',
      'u4: Calgary Highland Games is live',
      'u6: Calgary Highland Games is live',
    ])
    const body = (uid: string) => log().find((m) => m.uid === uid)?.body
    expect(body('u1')).toBe('Ailsa and Kirsty are on the dancer lists. See platforms and dancing order.')
    expect(body('u2')).toBe('Mairi and Fiona are on the dancer lists. See platforms and dancing order.')
    expect(body('u3')).toBe('Iona is on the dancer list. See platforms and dancing order.')
    expect(log().find((m) => m.uid === 'u1')).toMatchObject({ competitionId: 'c1', link: '/competitions/c1/info' })
  })

  it('sends each competition once, even when one goes live after the rest', async () => {
    const { db, rtdb, log, said } = linkedSet()
    rtdb.write({ 'competitions/c1/published': true, 'notifications:live/c1': { since: 0, ready: true } })
    const clock = 5 * 60_000
    const settled = getOnLinkPublishedSettled(db, app, true, () => clock)
    await settled({ linkId: 'L1' })
    await settled({ linkId: 'L1' })
    expect(said()).toEqual([
      'u1: Calgary Highland Games is live',
      'u2: Calgary Highland Games is live',
      'u3: Calgary Highland Games is live',
      'u4: Calgary Highland Games is live',
      'u6: Calgary Highland Games is live',
    ])
    // Five minutes later, the other one: its own alert, at once.
    rtdb.write({ 'competitions/c2/published': true, 'notifications:live/c2': { since: clock, ready: true } })
    await settled({ linkId: 'L1' })
    expect(log()).toHaveLength(7)
    expect(said()).toContain('u1: Calgary Closed Championship is live')
    expect(said()).toContain('u2: Calgary Closed Championship is live')
  })

  it('has a task wait while another is sending the same person’s alert, then sends nothing twice', async () => {
    const { db, rtdb, said } = linkedSet()
    rtdb.write({ 'competitions/c1/published': true, 'competitions/c2/published': true })
    rtdb.write({ 'notifications:live/c1': { since: 0, ready: true }, 'notifications:live/c2': { since: 0, ready: true } })
    // Another task is mid-send for u1.
    rtdb.write({ 'notifications:sent/link:L1/published/u1': 1000 })
    const settled = getOnLinkPublishedSettled(db, app, true, () => 2000)
    await expect(settled({ linkId: 'L1' })).rejects.toThrow(/trying again/)
    expect(said()).not.toContain('u1: 2 competitions are live, Jul 4–5')
    // That one finishes (the lock goes); the retry sends u1's, and no one else's again.
    rtdb.write({ 'notifications:sent/link:L1/published/u1': null })
    await settled({ linkId: 'L1' })
    expect(said().filter((x) => x.startsWith('u1:'))).toEqual(['u1: 2 competitions are live, Jul 4–5'])
    expect(said().filter((x) => x.startsWith('u2:'))).toHaveLength(1)
  })

  it('waits while one of the set is still syncing its dancers, then sends once', async () => {
    const { db, rtdb, said } = linkedSet()
    rtdb.write({ 'competitions/c1/published': true, 'competitions/c2/published': true })
    rtdb.write({ 'notifications:live/c1': { since: 0, ready: true }, 'notifications:live/c2': { since: 0, ready: false } })
    const settled = getOnLinkPublishedSettled(db, app, true, () => 60_000)
    await expect(settled({ linkId: 'L1' })).rejects.toThrow(/finish going live/)
    expect(said()).toEqual([])
    rtdb.write({ 'notifications:live/c2/ready': true })
    await settled({ linkId: 'L1' })
    expect(said()).toContain('u1: 2 competitions are live, Jul 4–5')
  })

  it('goes without one whose sync never finished', async () => {
    const { db, rtdb, said } = linkedSet()
    rtdb.write({ 'competitions/c1/published': true, 'competitions/c2/published': true })
    rtdb.write({ 'notifications:live/c1': { since: 0, ready: true }, 'notifications:live/c2': { since: 0, ready: false } })
    await getOnLinkPublishedSettled(db, app, true, () => 11 * 60_000)({ linkId: 'L1' })
    expect(said()).toContain('u1: Calgary Highland Games is live')
    expect(said().some((x) => x.includes('Calgary Closed Championship'))).toBe(false)
  })

  it('doesn’t announce again one that went live earlier', async () => {
    const { db, rtdb, said } = linkedSet()
    // c1 went live (and was announced) an hour ago; c2 just now.
    rtdb.write({ 'competitions/c1/published': true, 'competitions/c2/published': true })
    rtdb.write({ 'notifications:live/c1': { since: 0, ready: true }, 'notifications:live/c2': { since: 60 * 60_000, ready: true } })
    await getOnLinkPublishedSettled(db, app, true, () => 61 * 60_000)({ linkId: 'L1' })
    expect(said()).toContain('u1: Calgary Closed Championship is live')
    expect(said().some((x) => x.includes('Calgary Highland Games') || x.includes('2 competitions'))).toBe(false)
  })

  it('words a set by its first competition, and spans months', () => {
    expect(linkedPublishedMessage([{ name: 'SDCCS Pre-Premier Open', date: '2027-07-05' }, { name: 'B', date: '2027-07-06' }, { name: 'C', date: '2027-07-11' }], [])).toEqual({
      title: '3 competitions are live, Jul 5–11',
      body: 'SDCCS Pre-Premier Open and 2 others: dancer lists and schedules are up.',
    })
    expect(dateSpan(['2027-07-02', '2027-06-30'])).toBe('Jun 30–Jul 2')
    expect(dateSpan(['2027-07-02'])).toBe('Jul 2')
  })
})
