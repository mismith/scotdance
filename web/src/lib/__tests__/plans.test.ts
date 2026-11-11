// The shared plans (shared/plans): what each Manage action writes, above all what a removal takes with it.
import { describe, expect, it } from 'vitest'
import {
  planAdd,
  planAddPresets,
  planRemove,
  planReorder,
  planSetField,
  planSetFieldOn,
} from '@shared/plans/collection'
import {
  planSameDancesAs,
  planSetDanceGroup,
  planSetNotChampionship,
  planSetTrophyEventBlock,
  planSetTrophyEventGroup,
} from '@shared/plans/membership'
import {
  planAddLink,
  planHideTab,
  planListed,
  planPublished,
  planRemoveLink,
  planSetVenue,
  tabHasContent,
} from '@shared/plans/details'
import {
  missingFromDraw,
  planAddMissingToDraw,
  planClearAllDraws,
  planNumberOrder,
  planRemoveStraysFromDraw,
  planShuffleAll,
  strayInDraw,
} from '@shared/plans/draws'
import { planSetDancers, planTakeOffTeam, dancerRecord } from '@shared/plans/dancers'
import * as sched from '@shared/plans/schedule'
import {
  planNoCallbackRound,
  planNoResults,
  planPlace,
  planPoint,
  planReorderPlacings,
  planReplacePlaceholder,
  planReverse,
  planTakeOut,
  planTie,
} from '@shared/plans/results'
import type { CompetitionState, RawData } from '@shared/plans/types'

// Two categories, two age groups (g1 Premier 12 & Under 14, g2 Primary), a trophy event, three dances, a schedule.
const data = (): RawData => ({
  categories: { c1: { name: 'Premier', _order: 0 }, c2: { name: 'Primary', _order: 1 } },
  groups: {
    g1: { name: '12 & Under 14', categoryId: 'c1', sponsor: 's1', _order: 0 },
    g2: { categoryId: 'c2', _order: 1 },
  },
  dances: {
    d1: { name: 'Highland Fling', steps: 4, groupIds: { g1: true, g2: true }, _order: 0 },
    d2: { name: 'Sword Dance', groupIds: { g1: true }, _order: 1 },
    d3: { name: 'Seann Triubhas', _order: 2 },
  },
  trophyEvents: {
    t1: {
      name: 'Dancer of the Day',
      groupIds: { g1: true, g2: true },
      sponsor: 's1',
      _order: 0,
    },
    t2: { name: 'Trophy Fling', groupIds: { g1: true }, danceId: 'd1', _order: 1 },
  },
  dancers: {
    p1: {
      number: '101',
      firstName: 'Ava',
      lastName: 'Reid',
      groupId: 'g1',
      categoryId: 'c1',
    },
    p2: {
      number: '102',
      firstName: 'Isla',
      lastName: 'Grant',
      groupId: 'g1',
      categoryId: 'c1',
    },
    p3: {
      number: '101',
      firstName: 'Mia',
      lastName: 'Shaw',
      groupId: 'g2',
      categoryId: 'c2',
    },
  },
  staff: {
    s1: { type: 'Judge', firstName: 'Jean', lastName: 'Brown' },
    s2: { type: 'Judge', firstName: 'Ian', lastName: 'Ross' },
  },
  platforms: { pl1: { name: 'A', _order: 0 }, pl2: { name: 'B', _order: 1 } },
  schedule: {
    days: {
      day1: {
        order: 0,
        name: 'Saturday',
        blocks: {
          b1: {
            order: 0,
            name: 'Morning',
            events: {
              e1: {
                order: 0,
                name: 'Premier',
                dances: {
                  r1: {
                    order: 0,
                    danceId: 'd1',
                    platforms: {
                      pl1: {
                        orderedGroupIds: ['g1', 'g2', '100', 't2'],
                        orderedJudgeIds: ['s1', 's2'],
                      },
                      pl2: { orderedGroupIds: ['g2'] },
                    },
                  },
                  r2: {
                    order: 1,
                    danceId: 'd2',
                    platforms: { pl1: { orderedGroupIds: ['g1'] } },
                  },
                  r3: { order: 2, name: 'Break' },
                },
              },
            },
          },
        },
      },
    },
  },
  results: {
    g1: { d1: ['p1', 'p2:tie'], d2: false, callbacks: ['p1', 'p2'], overall: ['p1'] },
    g2: { d1: ['p3'] },
    t1: { overall: ['p1'] },
  },
  points: { g1: { d1: { combined: ['p1'] } }, g2: { d1: { combined: ['p3'] } } },
  sheets: { g1: { d1: { pg1: { url: 'x' } } }, g2: { d1: { pg2: { url: 'y' } } } },
  draws: { g1: { d1: ['101', '102'], d2: ['102', '101'] }, g2: { d1: ['101'] } },
})
const state = (d: RawData = data()): CompetitionState => ({
  info: {
    name: 'Cowal',
    date: '2026-08-29',
    links: { l1: { name: 'Rules', url: 'a.com', _order: 0 } },
  },
  data: d,
})
const keys = (o: object) => Object.keys(o).sort()
const nulled = (o: Record<string, unknown>) =>
  keys(Object.fromEntries(Object.entries(o).filter(([, v]) => v === null)))

describe('removing an age group', () => {
  const p = planRemove(state(), 'groups', ['g1'])
  it('takes its dances, trophy events, results, points, draws and schedule places with it', () => {
    expect(p.data).toEqual({
      'dances/d1/groupIds/g1': null,
      'dances/d2/groupIds/g1': null,
      'trophyEvents/t1/groupIds/g1': null,
      'trophyEvents/t2/groupIds/g1': null,
      'results/g1': null,
      'points/g1': null,
      'draws/g1': null,
      'schedule/days/day1/blocks/b1/events/e1/dances/r1/platforms/pl1/orderedGroupIds': [
        'g2',
        '100',
        't2',
      ],
      'schedule/days/day1/blocks/b1/events/e1/dances/r2/platforms/pl1/orderedGroupIds':
        null,
      'groups/g1': null,
    })
  })
  it('deletes its judges’ sheets for good, kept out of Undo', () => {
    expect(p.lasting).toEqual({ 'sheets/g1': null })
  })
  it('says what else goes', () => {
    expect(p.summary).toBe('Deleted Premier 12 & Under 14')
    expect(p.warnings).toEqual([
      '2 dancers are in it and will need another age group.',
      'Its results and draws will be deleted too.',
      'Also removes it from the schedule.',
      'Its judges’ sheets go for good: Undo won’t bring them back.',
    ])
  })
  it('several at once', () => {
    const both = planRemove(state(), 'groups', ['g1', 'g2'])
    expect(nulled(both.data)).toEqual(
      keys({
        'dances/d1/groupIds/g1': 1,
        'dances/d1/groupIds/g2': 1,
        'dances/d2/groupIds/g1': 1,
        'trophyEvents/t1/groupIds/g1': 1,
        'trophyEvents/t1/groupIds/g2': 1,
        'trophyEvents/t2/groupIds/g1': 1,
        'results/g1': 1,
        'results/g2': 1,
        'points/g1': 1,
        'points/g2': 1,
        'draws/g1': 1,
        'draws/g2': 1,
        'groups/g1': 1,
        'groups/g2': 1,
        'schedule/days/day1/blocks/b1/events/e1/dances/r1/platforms/pl2/orderedGroupIds': 1,
        'schedule/days/day1/blocks/b1/events/e1/dances/r2/platforms/pl1/orderedGroupIds': 1,
      }),
    )
    expect(
      both.data[
        'schedule/days/day1/blocks/b1/events/e1/dances/r1/platforms/pl1/orderedGroupIds'
      ],
    ).toEqual(['100', 't2'])
    expect(keys(both.lasting)).toEqual(['sheets/g1', 'sheets/g2'])
    expect(both.summary).toBe('Deleted 2 age groups')
  })
})

describe('removing a dance', () => {
  it('takes its results, points, draws, sheets, schedule rows and danced trophy events', () => {
    const p = planRemove(state(), 'dances', ['d1'])
    expect(p.data).toEqual({
      'results/g1/d1': null,
      'results/g2/d1': null,
      'points/g1/d1': null,
      'points/g2/d1': null,
      'draws/g1/d1': null,
      'draws/g2/d1': null,
      'schedule/days/day1/blocks/b1/events/e1/dances/r1': null,
      'trophyEvents/t2/danceId': null,
      'dances/d1': null,
    })
    expect(keys(p.lasting)).toEqual(['sheets/g1/d1', 'sheets/g2/d1'])
    expect(p.warnings).toEqual([
      'Its results will be deleted too.',
      'Trophy Fling won’t be danced any more.',
      'Also removes it from the schedule.',
      'Its judges’ sheets go for good: Undo won’t bring them back.',
    ])
    expect(p.summary).toBe('Deleted Highland Fling (4)')
  })
  it('a "no results" mark counts as results', () => {
    expect(planRemove(state(), 'dances', ['d2']).data['results/g1/d2']).toBeNull()
  })
})

describe('removing other things', () => {
  it('a category only warns', () => {
    const p = planRemove(state(), 'categories', ['c1'])
    expect(p.data).toEqual({ 'categories/c1': null })
    expect(p.warnings).toEqual(['1 age group uses it and will need another category.'])
  })
  it('a platform takes its assignments in the schedule', () => {
    const p = planRemove(state(), 'platforms', ['pl2'])
    expect(p.data).toEqual({
      'schedule/days/day1/blocks/b1/events/e1/dances/r1/platforms/pl2': null,
      'platforms/pl2': null,
    })
    expect(p.warnings).toEqual([
      'The schedule puts age groups on it in 1 place; those assignments will be removed.',
    ])
  })
  it('a staff member comes off the judges, and off the trophies they sponsor', () => {
    const p = planRemove(state(), 'staff', ['s1'])
    expect(p.data).toEqual({
      'schedule/days/day1/blocks/b1/events/e1/dances/r1/platforms/pl1/orderedJudgeIds': [
        's2',
      ],
      'groups/g1/sponsor': null,
      'trophyEvents/t1/sponsor': null,
      'staff/s1': null,
    })
    expect(p.warnings).toEqual([
      'They’re judging in 1 part of the schedule and will be taken off.',
      'They sponsor 2 trophies, which will show no sponsor.',
    ])
  })
  it('a trophy event takes its placings and its place on the schedule', () => {
    const p = planRemove(state(), 'trophyEvents', ['t1', 't2'])
    expect(p.data).toEqual({
      'schedule/days/day1/blocks/b1/events/e1/dances/r1/platforms/pl1/orderedGroupIds': [
        'g1',
        'g2',
        '100',
      ],
      'results/t1': null,
      'trophyEvents/t1': null,
      'trophyEvents/t2': null,
    })
    expect(p.warnings).toEqual([
      'Their placings will be deleted too.',
      'Also removes them from the schedule.',
    ])
  })
  it('a dancer comes out of their age group’s draws only', () => {
    const p = planRemove(state(), 'dancers', ['p1'])
    expect(p.data).toEqual({
      'draws/g1/d1': ['102'],
      'draws/g1/d2': ['102'],
      'dancers/p1': null,
    })
    expect(p.warnings).toEqual([
      'They have results entered. Those places will show as an unknown dancer (?) until changed.',
    ])
  })
  it('the last number out of a draw clears it', () => {
    const d = data()
    d.draws = { g2: { d1: ['101'] } }
    expect(planRemove(state(d), 'dancers', ['p3']).data).toEqual({
      'draws/g2/d1': null,
      'dancers/p3': null,
    })
  })
})

describe('adding, changing and ordering', () => {
  it('adds a sortable record last, with what follows from its fields', () => {
    const p = planAdd(
      state(),
      'groups',
      'gNew',
      { categoryId: 'c1', name: '14 & Under 16' },
      { categoryId: 'c1', name: '14 & Under 16' },
    )
    expect(p.data).toEqual({
      'groups/gNew': { categoryId: 'c1', name: '14 & Under 16', _order: 2 },
    })
    expect(p.summary).toBe('Added 14 & Under 16')
  })
  it('a new dancer’s category follows their age group, inside the record', () => {
    const p = planAdd(
      state(),
      'dancers',
      'pNew',
      { number: '103', groupId: 'g1', firstName: 'Skye' },
      { number: '103', groupId: 'g1' },
    )
    expect(p.data).toEqual({
      'dancers/pNew': {
        number: '103',
        groupId: 'g1',
        firstName: 'Skye',
        categoryId: 'c1',
      },
    })
    expect(p.summary).toBe('Added Skye')
  })
  it('a new team gets v3’s names too', () => {
    const rec = dancerRecord(
      {
        number: '105',
        groupId: 'g1',
        title: 'Ghillies Up',
        studio: 'Thistle',
        dancers: [
          { firstName: 'Ava', lastName: 'Reid' },
          { firstName: 'Isla', lastName: 'Grant' },
        ],
      },
      (() => {
        let n = 0
        return () => `m${n++}`
      })(),
    )
    expect(rec).toMatchObject({
      team: true,
      title: 'Ghillies Up',
      firstName: 'Ghillies Up',
      lastName: 'Thistle',
      members: {
        m0: { firstName: 'Ava', lastName: 'Reid', _order: 0 },
        m1: { firstName: 'Isla', lastName: 'Grant', _order: 1 },
      },
    })
    const p = planAdd(state(), 'dancers', 'tNew', rec, {
      number: '105',
      groupId: 'g1',
      title: 'Ghillies Up',
      studio: 'Thistle',
    })
    expect(p.summary).toBe('Added Ghillies Up')
    expect((p.data['dancers/tNew'] as Record<string, unknown>).categoryId).toBe('c1')
  })
  it('changing a dancer’s age group moves their category', () => {
    const p = planSetField(state(), 'dancers', 'p1', 'groupId', 'g2', 'Age group')
    expect(p.data).toEqual({ 'dancers/p1/groupId': 'g2', 'dancers/p1/categoryId': 'c2' })
    expect(p.summary).toBe('Age group of Ava Reid')
    expect(planSetField(state(), 'dancers', 'p1', 'groupId', null).data).toEqual({
      'dancers/p1/groupId': null,
      'dancers/p1/categoryId': null,
    })
  })
  it('changing a team’s title follows in v3’s names', () => {
    const d = data()
    d.dancers!.t1 = {
      number: '110',
      team: true,
      title: 'Old',
      studio: 'Thistle',
      groupId: 'g1',
      members: {
        a: { firstName: 'Ava', _order: 0 },
        b: { firstName: 'Isla', _order: 1 },
      },
    }
    const p = planSetField(state(d), 'dancers', 't1', 'title', 'New')
    expect(p.data).toEqual({
      'dancers/t1/title': 'New',
      'dancers/t1/firstName': 'New',
      'dancers/t1/lastName': 'Thistle',
    })
  })
  it('giving a trophy event another dance takes it off the schedule', () => {
    const p = planSetField(state(), 'trophyEvents', 't2', 'danceId', 'd2')
    expect(p.data).toEqual({
      'trophyEvents/t2/danceId': 'd2',
      'schedule/days/day1/blocks/b1/events/e1/dances/r1/platforms/pl1/orderedGroupIds': [
        'g1',
        'g2',
        '100',
      ],
    })
    expect(planSetField(state(), 'trophyEvents', 't2', 'danceId', 'd1').data).toEqual({
      'trophyEvents/t2/danceId': 'd1',
    })
  })
  it('sets one field on several', () => {
    const p = planSetFieldOn(state(), 'dancers', ['p1', 'p3'], 'groupId', 'g2')
    expect(p.data).toEqual({
      'dancers/p1/groupId': 'g2',
      'dancers/p1/categoryId': 'c2',
      'dancers/p3/groupId': 'g2',
      'dancers/p3/categoryId': 'c2',
    })
    expect(p.summary).toBe('Updated 2 dancers')
  })
  it('reorders only what moved', () => {
    expect(
      planReorder('groups', [
        { id: 'g2', _order: 1 },
        { id: 'g1', _order: 0 },
      ]).data,
    ).toEqual({ 'groups/g2/_order': 0, 'groups/g1/_order': 1 })
    expect(
      planReorder('groups', [
        { id: 'g1', _order: 0 },
        { id: 'g2', _order: 1 },
      ]).data,
    ).toEqual({})
  })
  it('adds presets one after another', () => {
    let n = 0
    const p = planAddPresets(
      state(),
      'groups',
      [{ name: 'A' }, { name: 'B' }],
      { categoryId: 'c1' },
      () => `n${n++}`,
    )
    expect(p.data).toEqual({
      'groups/n0': { name: 'A', categoryId: 'c1', _order: 2 },
      'groups/n1': { name: 'B', categoryId: 'c1', _order: 3 },
    })
    expect(p.summary).toBe('Added 2 age groups')
  })
})

describe('memberships', () => {
  it('a dance on or off an age group', () => {
    expect(planSetDanceGroup(state(), 'd3', 'g1', true)).toMatchObject({
      data: { 'dances/d3/groupIds/g1': true },
      summary: 'Added Seann Triubhas to Premier 12 & Under 14',
    })
    expect(planSetDanceGroup(state(), 'd1', 'g2', false).data).toEqual({
      'dances/d1/groupIds/g2': null,
    })
  })
  it('the same dances as another age group', () => {
    const p = planSameDancesAs(state(), 'g2', 'g1')!
    expect(p.data).toEqual({ 'dances/d2/groupIds/g2': true })
    expect(planSameDancesAs(state(), 'g1', 'g1')).toBeNull()
  })
  it('championship, and who can win a trophy event', () => {
    expect(planSetNotChampionship(state(), 'g1', true).data).toEqual({
      'groups/g1/notChampionship': true,
    })
    expect(planSetNotChampionship(state(), 'g1', false).data).toEqual({
      'groups/g1/notChampionship': null,
    })
    expect(planSetTrophyEventGroup(state(), 't1', 'g2', false).data).toEqual({
      'trophyEvents/t1/groupIds/g2': null,
    })
    expect(
      planSetTrophyEventBlock(state(), 't2', ['g1', 'g2'], 'Premier', true),
    ).toMatchObject({
      data: { 'trophyEvents/t2/groupIds/g1': true, 'trophyEvents/t2/groupIds/g2': true },
      summary: 'Added all Premier to Trophy Fling',
    })
  })
})

describe('details', () => {
  it('unlisting also unpublishes; publishing also lists', () => {
    expect(planListed(false).info).toEqual({ listed: false, published: false })
    expect(planListed(true).info).toEqual({ listed: true })
    expect(planPublished(true).info).toEqual({ published: true, listed: true })
    expect(planPublished(false).info).toEqual({ published: false })
    expect(planListed(false).data).toEqual({})
  })
  it('links go last, and come off', () => {
    expect(planAddLink(state(), 'l2', ' Program ', 'b.com').info).toEqual({
      'links/l2': { name: 'Program', url: 'b.com', _order: 1 },
    })
    expect(planAddLink(state(), 'l2', '', 'b.com').info['links/l2']).toMatchObject({
      name: null,
    })
    expect(planRemoveLink('l1', 'Rules')).toMatchObject({
      info: { 'links/l1': null },
      summary: 'Removed Rules',
    })
  })
  it('the venue as one set', () => {
    expect(planSetVenue({ venue: 'Hall', address: '1 Main St' })).toMatchObject({
      info: { venue: 'Hall', address: '1 Main St' },
      summary: 'Venue set to Hall',
    })
  })
  it('hiding a tab', () => {
    expect(planHideTab('schedule', true)).toMatchObject({
      data: { schedule: false },
      summary: 'Hid the Schedule tab',
    })
    expect(planHideTab('results', false)).toMatchObject({
      data: { results: null },
      summary: 'Showed the Results tab',
    })
    expect(tabHasContent(state(), 'schedule')).toBe(true)
    expect(tabHasContent(state({}), 'results')).toBe(false)
  })
})

describe('draws', () => {
  it('numbers missing and stray', () => {
    const d = data()
    d.draws = { g1: { d1: ['102', '999'] } }
    expect(missingFromDraw(state(d), 'g1', 'd1')).toEqual(['101'])
    expect(strayInDraw(state(d), 'g1', 'd1')).toEqual(['999'])
    expect(planAddMissingToDraw(state(d), 'g1', 'd1').data).toEqual({
      'draws/g1/d1': ['102', '101'],
    })
    expect(planRemoveStraysFromDraw(state(d), 'g1', 'd1').data).toEqual({
      'draws/g1/d1': ['102'],
    })
  })
  it('number order, clearing, and shuffling every dance (a reel stays in order)', () => {
    expect(planNumberOrder(state(), 'g1', 'd2').data).toEqual({
      'draws/g1/d2': ['101', '102'],
    })
    expect(nulled(planClearAllDraws(state(), 'g1').data)).toEqual([
      'draws/g1/d1',
      'draws/g1/d2',
    ])
    const d = data()
    d.dances!.d2.name = 'Reel o’ Tulloch'
    const p = planShuffleAll(state(d), 'g1', () => 0)
    expect(p.data['draws/g1/d1']).toEqual(['102', '101'])
    expect(p.data['draws/g1/d2']).toEqual(['101', '102'])
  })
})

describe('an entry’s dancers', () => {
  const key = () => {
    let n = 0
    return () => `k${n++}`
  }
  it('a lone dancer’s new row empty stays one dancer', () => {
    const r = planSetDancers(
      state(),
      'p1',
      [
        { firstName: 'Ava', lastName: 'Reid' },
        { firstName: '', lastName: '' },
      ],
      key(),
    )
    expect(r.outcome).toBe('name')
    expect(r.plan.data).toEqual({
      'dancers/p1/firstName': 'Ava',
      'dancers/p1/lastName': 'Reid',
    })
  })
  it('two make a duet, with v3’s names', () => {
    const r = planSetDancers(
      state(),
      'p1',
      [
        { firstName: 'Ava', lastName: 'Reid' },
        { firstName: 'Isla', lastName: 'Grant' },
      ],
      key(),
    )
    expect(r.outcome).toBe('became')
    expect(r.ensemble).toBe('duet')
    expect(r.plan.data).toEqual({
      'dancers/p1/team': true,
      'dancers/p1/members': {
        k0: { firstName: 'Ava', lastName: 'Reid', _order: 0 },
        k1: { firstName: 'Isla', lastName: 'Grant', _order: 1 },
      },
      'dancers/p1/firstName': 'Ava Reid & Isla Grant',
      'dancers/p1/lastName': null,
      'dancers/p1/dancerId': null,
    })
  })
  it('one left is a dancer again', () => {
    const d = data()
    d.dancers!.t1 = {
      number: '110',
      team: true,
      groupId: 'g1',
      members: {
        a: { firstName: 'Ava', lastName: 'Reid', _order: 0 },
        b: { firstName: 'Isla', lastName: 'Grant', _order: 1 },
      },
    }
    const r = planTakeOffTeam(state(d), 't1', 1, key())
    expect(r.outcome).toBe('one')
    expect(r.alone).toBe('Ava Reid')
    expect(r.plan.data).toEqual({
      'dancers/t1/team': null,
      'dancers/t1/members': null,
      'dancers/t1/firstName': 'Ava',
      'dancers/t1/lastName': 'Reid',
    })
    expect(r.plan.summary).toBe('Made Ava Reid & Isla Grant one dancer')
  })
})

describe('the schedule', () => {
  const env = (o: Partial<sched.ScheduleEnv> = {}): sched.ScheduleEnv => ({
    dayId: 'day1',
    newId: () => 'new1',
    competitionDate: '2026-08-29',
    ...o,
  })
  it('writes only the difference', () => {
    const p = sched.planScheduleEdit(state(), 'Added a session', (s) =>
      sched.addBlock(s, env(), 'b2', 'Afternoon'),
    )
    expect(p.data).toEqual({
      'schedule/days/day1/blocks/b2': { name: 'Afternoon', order: 1 },
    })
  })
  it('a group added to a cell, moved and removed', () => {
    const loc = { blockId: 'b1', eventId: 'e1', danceId: 'r2', platformId: 'pl2' }
    const p = sched.planScheduleEdit(state(), 'x', (s) =>
      sched.addToCell(s, env(), 'group', loc, 'g2'),
    )
    expect(p.data).toEqual({
      'schedule/days/day1/blocks/b1/events/e1/dances/r2/platforms/pl2': {
        orderedGroupIds: ['g2'],
      },
    })
    const from = { ...loc, platformId: 'pl1' }
    const moved = sched.planScheduleEdit(state(), 'x', (s) =>
      sched.moveBetweenCells(s, env(), 'group', from, loc, 'g1'),
    )
    expect(moved.data).toEqual({
      'schedule/days/day1/blocks/b1/events/e1/dances/r2/platforms/pl1': null,
      'schedule/days/day1/blocks/b1/events/e1/dances/r2/platforms/pl2': {
        orderedGroupIds: ['g1'],
      },
    })
  })
  it('the first session makes the first day, named for the competition’s weekday', () => {
    const p = sched.planScheduleEdit({ info: null, data: {} }, 'x', (s) =>
      sched.addBlock(s, env({ dayId: undefined }), 'b1', 'Morning'),
    )
    // (Nothing was saved before, so the whole schedule is the difference.)
    expect(p.data).toEqual({
      schedule: {
        days: {
          new1: {
            order: 0,
            name: 'Saturday',
            date: '2026-08-29',
            blocks: { b1: { name: 'Morning', order: 0 } },
          },
        },
      },
    })
  })
  it('deleting a day, reordering, and a date renames a weekday-named day', () => {
    expect(
      sched.planScheduleEdit(state(), 'x', (s) => sched.removeDay(s, 'day1')).data,
    ).toEqual({ schedule: null })
    const d = data()
    d.schedule!.days!.day2 = { order: 1, name: 'Sunday' }
    expect(
      sched.planScheduleEdit(state(d), 'x', (s) => sched.removeDay(s, 'day1')).data,
    ).toEqual({
      'schedule/days/day1': null,
    })
    const two = sched.planScheduleEdit(state(), 'x', (s) =>
      sched.addEvent(s, env(), 'b1', 'e2', 'Open'),
    ).data
    expect(two).toEqual({
      'schedule/days/day1/blocks/b1/events/e2': { name: 'Open', order: 1 },
    })
    const date = sched.planScheduleEdit(state(), 'x', (s) => {
      s.days!.day1.date = '2026-08-29'
      sched.setDayDate(s, 'day1', '2026-08-30')
    })
    expect(date.data).toEqual({
      'schedule/days/day1/date': '2026-08-30',
      'schedule/days/day1/name': 'Sunday',
    })
  })
  it('nothing changed, nothing to write', () => {
    expect(
      sched.planScheduleEdit(state(), 'x', (s) => sched.moveWithin(s.days, 0, 0)).data,
    ).toEqual({})
  })
})

describe('results', () => {
  const s = () => state()
  it('placing a dancer adds them last; again takes them out', () => {
    const add = planPlace(s(), 'g1', 'd3', 'p2')
    expect(add.added).toBe(true)
    expect(add.plan.data).toEqual({ 'results/g1/d3': ['p2'] })
    expect(add.plan.summary).toBe('Placed 102 in Seann Triubhas')
    const out = planPlace(s(), 'g1', 'd1', 'p1')
    expect(out.added).toBe(false)
    expect(out.plan.data).toEqual({ 'results/g1/d1': ['p2'] })
    expect(out.plan.summary).toBe('Took out 101 in Highland Fling (4)')
    expect(planPlace(s(), 'g1', 'd1', 'p2').plan.data).toEqual({
      'results/g1/d1': ['p1'],
    })
  })
  it('taking out the only one clears the result', () => {
    expect(planTakeOut(s(), 'g1', 'overall', 0, 'p1')!.plan.data).toEqual({
      'results/g1/overall': null,
    })
    expect(planTakeOut(s(), 'g1', 'overall', 0, 'zzz')).toBeNull()
  })
  it('ties, order, lowest place first', () => {
    expect(planTie(s(), 'g1', 'callbacks', 1, true)!.plan.data).toEqual({
      'results/g1/callbacks': ['p1', 'p2:tie'],
    })
    expect(planTie(s(), 'g1', 'callbacks', 5, true)).toBeNull()
    expect(
      planReorderPlacings(
        s(),
        'g1',
        'callbacks',
        [
          { id: 'p2', tie: false },
          { id: 'p1', tie: false },
        ],
        'p2',
      ).plan,
    ).toMatchObject({
      data: { 'results/g1/callbacks': ['p2', 'p1'] },
      summary: 'Moved 102 to 1st in Callbacks',
    })
    expect(planReverse(s(), 'g1', 'callbacks', 6).plan.data).toEqual({
      'results/g1/callbacks': ['reverse:6', 'p1', 'p2'],
    })
    expect(planReverse(s(), 'g1', 'callbacks', null).plan.data).toEqual({
      'results/g1/callbacks': ['p1', 'p2'],
    })
  })
  it('a "?" is replaced by the dancer', () => {
    const d = data()
    d.results!.g1.d3 = ['1700000000000', 'p1']
    expect(
      planReplacePlaceholder(state(d), 'g1', 'd3', '1700000000000', 'p2')!.plan.data,
    ).toEqual({ 'results/g1/d3': ['p2', 'p1'] })
    expect(planReplacePlaceholder(state(d), 'g1', 'd3', 'nope', 'p2')).toBeNull()
  })
  it('no results, no callback round, and the mark cleared', () => {
    expect(planNoResults(s(), 'g1', 'd3', true)).toMatchObject({
      data: { 'results/g1/d3': false },
      summary: 'No results in Seann Triubhas',
    })
    expect(planNoResults(s(), 'g1', 'callbacks', false)).toMatchObject({
      data: { 'results/g1/callbacks': null },
      summary: 'Cleared “No callbacks” in Callbacks',
    })
    expect(planNoResults(s(), 't1', 'overall', true).summary).toBe(
      'No results in Dancer of the Day',
    )
    expect(planNoCallbackRound(s(), 'g2')).toMatchObject({
      data: { 'results/g2/callbacks': false },
      summary: 'No callback round in Primary',
    })
  })
  it('a championship point given and taken back', () => {
    const give = planPoint(s(), 'g1', 'd2', 'p2')
    expect(give.gave).toBe(true)
    expect(give.data).toEqual({ 'points/g1/d2/combined': ['p2'] })
    const take = planPoint(s(), 'g1', 'd1', 'p1')
    expect(take.gave).toBe(false)
    expect(take.data).toEqual({ 'points/g1/d1/combined': null })
    expect(take.summary).toBe('Took a point from 101 in Highland Fling (4)')
  })
})
