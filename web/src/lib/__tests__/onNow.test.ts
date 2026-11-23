import { describe, expect, it } from 'vitest'
import { askIndex, FRESH_MS, lineIndex, platformTurns, turnKey, type Turn } from '../onNow'
import { FRESH_MS as SERVER_FRESH_MS, ORGANISER_WEIGHT, tally } from '../../../../functions/src/onNow'
import type { ScheduleDay } from '@/types/competition'

// On now (ADR 0020): where the pink line sits in a platform's running order,
// when it's no longer believable, which group gets asked about, and how
// everyone's answers settle the line.

const day = {
  id: 'sat',
  blocks: {
    am: {
      order: 0,
      events: {
        pre: {
          order: 0,
          dances: {
            fling: { order: 0, danceId: 'd-fling', platforms: { p1: { orderedGroupIds: ['nov', 'int', 'spacer', 'prem'] }, p2: { orderedGroupIds: ['beg'] } } },
            sword: { order: 1, danceId: 'd-sword', platforms: { p1: { orderedGroupIds: ['nov', 'int'] } } },
          },
        },
      },
    },
    pm: { order: 1, events: { champ: { order: 0, dances: { reel: { order: 0, danceId: 'd-reel', platforms: { p1: { orderedGroupIds: ['open'] } } } } } } },
  },
} as unknown as ScheduleDay

const known = (id: string) => id !== 'spacer'
const turns = platformTurns(day, 'p1', known)
const keys = turns.map((t) => t.key)
const postedOf = (...ids: string[]) => (t: Turn) => ids.includes(`${t.scheduleDanceId}:${t.id}`)
const none = () => false

describe('platformTurns', () => {
  it('runs through the day in order, skipping spacers and other platforms', () => {
    expect(keys).toEqual([
      'sat/am/pre/fling/nov',
      'sat/am/pre/fling/int',
      'sat/am/pre/fling/prem',
      'sat/am/pre/sword/nov',
      'sat/am/pre/sword/int',
      'sat/pm/champ/reel/open',
    ])
    expect(turnKey('sat', 'am', 'pre', 'fling', 'nov')).toBe(keys[0])
  })
})

describe('lineIndex', () => {
  const now = 1_000_000_000
  it('sits on the reported group while it is fresh', () => {
    expect(lineIndex({ turn: keys[1], at: now - 60_000 }, turns, none, now)).toBe(1)
  })
  it('goes once it is stale', () => {
    expect(lineIndex({ turn: keys[1], at: now - FRESH_MS - 1 }, turns, none, now)).toBeNull()
  })
  it('goes once results are in for its group or a later one', () => {
    expect(lineIndex({ turn: keys[1], at: now }, turns, postedOf('fling:int'), now)).toBeNull()
    expect(lineIndex({ turn: keys[1], at: now }, turns, postedOf('sword:nov'), now)).toBeNull()
    expect(lineIndex({ turn: keys[1], at: now }, turns, postedOf('fling:nov'), now)).toBe(1)
  })
  it('ignores a turn that is no longer in the schedule', () => {
    expect(lineIndex({ turn: 'sat/am/pre/fling/gone', at: now }, turns, none, now)).toBeNull()
  })
})

describe('askIndex', () => {
  it('asks about the group after the line', () => {
    expect(askIndex(1, turns, none)).toBe(2)
  })
  it('with no line, asks about the first group after the last with results', () => {
    expect(askIndex(null, turns, none)).toBe(0)
    expect(askIndex(null, turns, postedOf('fling:nov', 'fling:int'))).toBe(2)
  })
  it('asks nothing once the day is done', () => {
    expect(askIndex(5, turns, none)).toBeNull()
    expect(askIndex(null, turns, postedOf('reel:open'))).toBeNull()
  })
})

describe('tally (functions/src/onNow)', () => {
  const now = 2_000_000_000
  it('counts answers for as long as the app shows a line', () => {
    expect(SERVER_FRESH_MS).toBe(FRESH_MS)
  })
  it('puts the line on the newest Yes', () => {
    expect(tally([
      { turn: 'a', vote: 'yes', at: now - 5000 },
      { turn: 'b', vote: 'yes', at: now - 1000 },
    ], now)).toEqual({ turn: 'b', at: now - 1000 })
  })
  it('takes back a single stray Yes with one No, falling back to the one before', () => {
    expect(tally([
      { turn: 'a', vote: 'yes', at: now - 5000 },
      { turn: 'z', vote: 'yes', at: now - 1000 },
      { turn: 'z', vote: 'no', at: now - 500 },
    ], now)).toEqual({ turn: 'a', at: now - 5000 })
  })
  it('ignores taken-back and stale answers', () => {
    expect(tally([
      { turn: 'a', vote: 'undo', at: now },
      { turn: 'b', vote: 'yes', at: now - SERVER_FRESH_MS - 1 },
    ], now)).toBeNull()
  })
  it('counts an organiser three times', () => {
    expect(ORGANISER_WEIGHT).toBe(3)
    expect(tally([
      { turn: 'a', vote: 'yes', at: now - 1000, weight: ORGANISER_WEIGHT },
      { turn: 'a', vote: 'no', at: now - 500 },
      { turn: 'a', vote: 'no', at: now - 400 },
    ], now)).toEqual({ turn: 'a', at: now - 1000 })
  })
})
