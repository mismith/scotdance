/* eslint-disable vue/one-component-per-file -- a parent to provide the competition */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import * as fakeDb from '../schedule/__tests__/fakeDb'
import { NS } from '../schedule/__tests__/fakeDb'
import PlacedList from '../PlacedList.vue'
import ResultsEntry from '../ResultsEntry.vue'
import { provideManagedCompetition, type RawData } from '@/composables/admin/useManagedCompetition'
import { confirmRequest, toasts } from '@/lib/admin/feedback'

vi.mock('firebase/database', async () => (await import('../schedule/__tests__/fakeDb')).firebaseDatabase)
vi.mock('@/firebase', async () => (await import('../schedule/__tests__/fakeDb')).firebaseMock)
vi.mock('@/lib/offline', async () => (await import('../schedule/__tests__/fakeDb')).offlineMock)
vi.mock('@/lib/competitionMeta', () => ({ forgetCompetitionMeta: () => {} }))
vi.mock('@/composables/useCompetitions', () => ({ forgetCompetitionsList: () => {} }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ uid: 'u1' }) }))
vi.mock('@/stores/me', () => ({ useMeStore: () => ({ hasCompetitionPerm: () => true }) }))

// Results entry's guards, over a fake database: a quick second tap is the
// same tap, a take-out (or move, or "?" replaced, or Lowest place first
// changed) can be undone, Lowest place first asks before renumbering anyone
// placed, and a dance waiting on callbacks can say there wasn't a callback
// round. None of it changes what's stored for the same taps.

const DATA = `${NS}/competitions:data/c1`

function sample(results: RawData['results'] = { gB8: { callbacks: false } }): RawData {
  return {
    categories: { cBeg: { name: 'Beginner', _order: 0 } },
    groups: { gB8: { name: '8 & Under', categoryId: 'cBeg', _order: 0 } },
    dances: { dFling: { name: 'Highland Fling', _order: 0, groupIds: { gB8: true } } },
    dancers: {
      d1: { number: '101', firstName: 'Isla', lastName: 'Grant', groupId: 'gB8' },
      d2: { number: '102', firstName: 'Mairi', lastName: 'Ross', groupId: 'gB8' },
      d3: { number: '103', firstName: 'Skye', lastName: 'Munro', groupId: 'gB8' },
      d4: { number: '104', firstName: 'Eilidh', lastName: 'Shaw', groupId: 'gB8' },
      d5: { number: '105', firstName: 'Ailsa', lastName: 'Reid', groupId: 'gB8' },
      d6: { number: '106', firstName: 'Fiona', lastName: 'Bain', groupId: 'gB8' },
    },
    ...(results ? { results } : {}),
  }
}

let now = 0
let wrapper: VueWrapper | null = null

function setup(data: RawData, danceId = 'dFling', groupId = 'gB8') {
  wrapper?.unmount()
  fakeDb.reset({ [NS]: { competitions: { c1: { name: 'Test' } }, 'competitions:data': { c1: data } } })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { render: () => null } },
      { path: '/manage/:competitionId/results/:groupId?/:danceId?', name: 'manage.results', component: { render: () => null } },
      { path: '/manage/:competitionId/dancers', name: 'manage.dancers', component: { render: () => null } },
      { path: '/manage/:competitionId/aggregates/:itemId?', name: 'manage.aggregates', component: { render: () => null } },
    ],
  })
  const Parent = defineComponent({
    setup() {
      provideManagedCompetition(ref('c1'))
      return () => h(ResultsEntry, { groupId, danceId })
    },
  })
  // Dragging itself is Sortable's (and the browser's): the list's own rows are what's tested.
  const VueDraggable = defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) })
  wrapper = mount(Parent, { global: { plugins: [router], stubs: { VueDraggable }, directives: { proximity: {} } }, attachTo: document.body })
  const w = wrapper
  const buttons = () => w.findAll('button')
  return {
    w,
    stored: (dance = danceId) => fakeDb.read(`${DATA}/results/${groupId}/${dance}`),
    /** A dancer's row in the list to tap, by number. */
    candidate: (num: string) => buttons().find((b) => b.attributes('aria-pressed') !== undefined && b.text().startsWith(num))!,
    button: (text: string) => buttons().find((b) => b.text().trim() === text)!,
    placed: () => w.findComponent(PlacedList),
    lastToast: () => toasts.at(-1),
  }
}

beforeEach(() => {
  now = 0
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  toasts.splice(0)
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  confirmRequest.value?.resolve(false)
  vi.restoreAllMocks()
})

describe('a second tap on the same dancer', () => {
  it('within half a second is ignored, so a lost haptic doesn’t place and then take out', async () => {
    const t = setup(sample())
    await t.candidate('101').trigger('click')
    now = 200
    await t.candidate('101').trigger('click')
    await flushPromises()
    expect(t.stored()).toEqual(['d1'])
  })

  it('after that, takes them out as before', async () => {
    const t = setup(sample())
    await t.candidate('101').trigger('click')
    now = 800
    await t.candidate('101').trigger('click')
    await flushPromises()
    expect(t.stored()).toBeNull()
  })

  it('never holds up a tap on someone else', async () => {
    const t = setup(sample())
    await t.candidate('101').trigger('click')
    await t.candidate('102').trigger('click')
    await t.candidate('103').trigger('click')
    await flushPromises()
    expect(t.stored()).toEqual(['d1', 'd2', 'd3'])
  })

  it('adds one "?" for a double tap on Missed number, and another for a later tap', async () => {
    const t = setup(sample())
    await t.button('?Missed number').trigger('click')
    now = 100
    await t.button('?Missed number').trigger('click')
    await flushPromises()
    expect(t.stored()).toHaveLength(1)
    now = 900
    await t.button('?Missed number').trigger('click')
    await flushPromises()
    expect(t.stored()).toHaveLength(2)
  })

  it('on a placed row takes out only that dancer, not whoever moved up into its place', async () => {
    const t = setup(sample({ gB8: { callbacks: false, dFling: ['d1', 'd2', 'd3'] } }))
    t.placed().vm.$emit('remove', 1, 'd2')
    await flushPromises()
    expect(t.stored()).toEqual(['d1', 'd3'])
    // The same row again, as it leaves: index 1 is 103's now.
    t.placed().vm.$emit('remove', 1, 'd2')
    now = 2000
    t.placed().vm.$emit('remove', 1, 'd2')
    await flushPromises()
    expect(t.stored()).toEqual(['d1', 'd3'])
  })
})

describe('Undo', () => {
  it('puts a dancer taken out back in their place', async () => {
    const t = setup(sample({ gB8: { callbacks: false, dFling: ['d1', 'd2:tie', 'd3'] } }))
    t.placed().vm.$emit('remove', 0, 'd1')
    await flushPromises()
    expect(t.stored()).toEqual(['d2', 'd3'])
    expect(t.lastToast()?.message).toBe('Took out 101')
    await t.lastToast()!.action!.run()
    expect(t.stored()).toEqual(['d1', 'd2:tie', 'd3'])
  })

  it('is offered for a take-out from the list too, but not for placing', async () => {
    const t = setup(sample())
    await t.candidate('101').trigger('click')
    await flushPromises()
    expect(toasts).toHaveLength(0)
    now = 1000
    await t.candidate('101').trigger('click')
    await flushPromises()
    expect(t.lastToast()).toMatchObject({ message: 'Took out 101', action: { label: 'Undo' } })
  })

  it('says where a moved dancer went, and moves them back', async () => {
    const t = setup(sample({ gB8: { callbacks: false, dFling: ['d1', 'd2', 'd3'] } }))
    t.placed().vm.$emit('reorder', [{ id: 'd3', tie: false }, { id: 'd1', tie: false }, { id: 'd2', tie: false }], 'd3')
    await flushPromises()
    expect(t.stored()).toEqual(['d3', 'd1', 'd2'])
    expect(t.lastToast()?.message).toBe('Moved 103 to 1st')
    await t.lastToast()!.action!.run()
    expect(t.stored()).toEqual(['d1', 'd2', 'd3'])
  })

  it('takes back a "?" replaced with a dancer', async () => {
    const t = setup(sample({ gB8: { callbacks: false, dFling: ['d1', '1700000000000'] } }))
    t.placed().vm.$emit('fix', 1)
    await flushPromises()
    await t.w.findAll('dialog button').find((b) => b.text().includes('102'))!.trigger('click')
    await flushPromises()
    expect(t.stored()).toEqual(['d1', 'd2'])
    expect(t.lastToast()?.message).toBe('Replaced ? with 102')
    await t.lastToast()!.action!.run()
    expect(t.stored()).toEqual(['d1', '1700000000000'])
  })
})

describe('Lowest place first', () => {
  const championshipSwitch = (t: ReturnType<typeof setup>) =>
    t.w.findAll('[role="switch"]').find((x) => x.element.closest('label')?.textContent?.includes('Lowest place first'))!

  it('is the switch it was: on asks how many places, and saves at once with nobody placed yet', async () => {
    const t = setup(sample())
    await championshipSwitch(t).trigger('click')
    await t.button('6').trigger('click')
    await flushPromises()
    expect(confirmRequest.value).toBeNull()
    expect(t.stored()).toEqual(['reverse:6'])
    expect(t.lastToast()?.message).toBe('Entering from 6th')
  })

  it('asks before renumbering anyone placed, and leaves them be if not', async () => {
    const t = setup(sample({ gB8: { callbacks: false, dFling: ['d1', 'd2', 'd3'] } }))
    await championshipSwitch(t).trigger('click')
    await t.button('6').trigger('click')
    expect(confirmRequest.value).toMatchObject({
      title: 'Renumber the 3 dancers already placed?',
      message: 'The first one entered (101) becomes 6th.',
      confirmLabel: 'Renumber',
    })
    confirmRequest.value!.resolve(false)
    await flushPromises()
    expect(t.stored()).toEqual(['d1', 'd2', 'd3'])
  })

  it('renumbers once confirmed, with Undo', async () => {
    const t = setup(sample({ gB8: { callbacks: false, dFling: ['d1', 'd2', 'd3'] } }))
    await championshipSwitch(t).trigger('click')
    await t.button('6').trigger('click')
    confirmRequest.value!.resolve(true)
    await flushPromises()
    expect(t.stored()).toEqual(['reverse:6', 'd1', 'd2', 'd3'])
    await t.lastToast()!.action!.run()
    expect(t.stored()).toEqual(['d1', 'd2', 'd3'])
  })

  it('asks before turning off, too, as that renumbers them from 1st', async () => {
    const t = setup(sample({ gB8: { callbacks: false, dFling: ['reverse:6', 'd1', 'd2'] } }))
    await championshipSwitch(t).trigger('click')
    expect(confirmRequest.value).toMatchObject({ title: 'Renumber the 2 dancers already placed?', message: 'The first one entered (101) becomes 1st.' })
    confirmRequest.value!.resolve(true)
    await flushPromises()
    expect(t.stored()).toEqual(['d1', 'd2'])
    expect(t.lastToast()?.message).toBe('Lowest place first off')
  })
})

describe('a dance waiting on callbacks', () => {
  it('can mark the callbacks "none" and carry on with everyone', async () => {
    const t = setup(sample(null))
    expect(t.w.text()).toContain('Enter the callbacks first')
    await t.button('No callback round').trigger('click')
    await flushPromises()
    // What the Callbacks page's own "No callbacks" switch stores.
    expect(t.stored('callbacks')).toBe(false)
    expect(t.w.text()).not.toContain('Enter the callbacks first')
    expect(t.candidate('101').exists()).toBe(true)
    expect(t.lastToast()?.action?.label).toBe('Undo')
  })
})

describe('an aggregate', () => {
  // Dancer of the Day is open to two of three age groups; the third's dancer isn't on the list.
  function withAggregate(results: RawData['results'] = {}): RawData {
    const base = sample(null)
    return {
      ...base,
      groups: { ...base.groups, gB10: { name: '10 & Under', categoryId: 'cBeg', _order: 1 }, gNov: { name: '12 & Under', categoryId: 'cBeg', _order: 2 } },
      dancers: {
        ...base.dancers,
        d7: { number: '201', firstName: 'Catriona', lastName: 'Lamont', groupId: 'gB10' },
        d8: { number: '301', firstName: 'Morag', lastName: 'Fraser', groupId: 'gNov' },
      },
      aggregates: { aDay: { name: 'Dancer of the Day', trophy: 'Quaich', groupIds: { gB8: true, gB10: true } } },
      results,
    }
  }
  const open = (results?: RawData['results']) => setup(withAggregate(results), 'overall', 'aDay')

  it('lists the dancers of the age groups it is open to, each with their age group', () => {
    const t = open()
    expect(t.candidate('101').text()).toContain('Beginner 8 & Under')
    expect(t.candidate('201').text()).toContain('Beginner 10 & Under')
    expect(t.candidate('301')).toBeUndefined()
  })

  it('is headed by its name and who can win it', () => {
    const t = open()
    expect(t.w.find('h1').text()).toBe('Dancer of the Day')
    expect(t.w.text()).toContain('Beginner 8 & Under, 10 & Under')
  })

  it('places dancers at once, with no callbacks first, and stores them with the others', async () => {
    const t = open()
    expect(t.w.text()).not.toContain('Enter the callbacks first')
    await t.candidate('201').trigger('click')
    await t.candidate('101').trigger('click')
    await flushPromises()
    expect(t.stored()).toEqual(['d7', 'd1'])
    expect(t.lastToast()).toBeUndefined()
  })

  it('takes a placed dancer out again, with Undo, and keeps Lowest place first', async () => {
    const t = open({ aDay: { overall: ['d7', 'd1'] } })
    t.placed().vm.$emit('remove', 0, 'd7')
    await flushPromises()
    expect(t.stored()).toEqual(['d1'])
    expect(t.lastToast()?.action?.label).toBe('Undo')
    expect(t.w.text()).toContain('Lowest place first')
  })

  it('has no Points, judges’ sheet or callbacks, and no championship switch', () => {
    const t = open()
    const text = t.w.text()
    expect(text).not.toContain('Points')
    expect(text).not.toContain('judges’ sheet')
    expect(text).not.toContain('Not run as a championship')
    expect(text).not.toContain('Called back')
  })

  it('says to choose age groups when none are on', () => {
    const data = withAggregate()
    data.aggregates = { aDay: { name: 'Dancer of the Day' } }
    const t = setup(data, 'overall', 'aDay')
    expect(t.w.text()).toContain('Choose the age groups whose dancers can win it.')
  })
})
