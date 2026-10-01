import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, reactive, ref } from 'vue'
import { mount } from '@vue/test-utils'

// A competition's screens: what's visible to whom, and how its sections
// load: read once, or streamed live on competition day.

const meta: Record<string, unknown> = {}
const me = reactive({
  accessKnown: true,
  perms: {} as Record<string, boolean>,
  hasCompetitionPerm: (id: string) => !!me.perms[id],
})
const calls: string[] = []
const streams = new Map<string, (v: unknown) => void>()
let failNext: string | null = null

vi.mock('@/firebase', () => ({ dataRef: (path: string) => ({ path }) }))
vi.mock('firebase/database', () => ({ child: (p: { path: string }, k: string) => ({ path: `${p.path}/${k}` }) }))
vi.mock('@/lib/offline', () => ({
  getSaved: async (r: { path: string }) => ({ val: () => meta[r.path.split('/').at(-1)!] ?? null }),
}))
vi.mock('@/stores/me', () => ({ useMeStore: () => me }))
vi.mock('@/composables/useCompetitions', () => ({ peekCompetition: () => null }))
vi.mock('@/lib/competitionData', () => {
  const once = (name: string, value: () => unknown) => async () => {
    calls.push(`read ${name}`)
    if (failNext === name) {
      failNext = null
      throw new Error('permission_denied')
    }
    return value()
  }
  const live = (name: string) => (_id: string, cb: (v: unknown) => void) => {
    calls.push(`stream ${name}`)
    streams.set(name, cb)
    return () => {
      calls.push(`stop ${name}`)
      streams.delete(name)
    }
  }
  return {
    fetchStaff: once('staff', () => []),
    fetchDancers: once('dancers', () => ({ dancers: [{ id: 'd1', fullName: 'Isla Ross' }], groups: [], categories: [] })),
    fetchResults: once('results', () => ({ dances: [], results: {}, points: {}, hidden: false })),
    fetchSchedule: once('schedule', () => ({ schedule: null, platforms: [], draws: {}, hidden: true })),
    watchStaff: live('staff'),
    watchDancers: live('dancers'),
    watchResults: live('results'),
    watchSchedule: live('schedule'),
  }
})

const { provideCompetition } = await import('@/composables/useCompetition')

const pad = (n: number) => String(n).padStart(2, '0')
const day = (offset: number) => {
  const d = new Date(2026, 9, 3 + offset)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const flush = async () => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0))
}

function open(id = 'c1') {
  let ctx!: ReturnType<typeof provideCompetition>
  const competitionId = ref(id)
  mount(
    defineComponent({
      setup() {
        ctx = provideCompetition(competitionId)
        return () => h('div')
      },
    }),
  )
  return { ctx, competitionId }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 3, 10, 30))
  for (const k of Object.keys(meta)) delete meta[k]
  me.accessKnown = true
  me.perms = {}
  calls.length = 0
  streams.clear()
  failNext = null
})
afterEach(() => vi.useRealTimers())

describe('who can see it', () => {
  it('shows a published competition to everyone', async () => {
    meta.c1 = { name: 'Games', published: true, date: day(10) }
    const { ctx } = open()
    await flush()
    expect(ctx.competition.value?.name).toBe('Games')
    expect(ctx.notFound.value).toBe(false)
  })

  it('hides a private one (neither listed nor published), except from its organisers', async () => {
    meta.c1 = { name: 'Games', published: false, listed: false, date: day(10) }
    const { ctx } = open()
    await flush()
    expect(ctx.competition.value).toBeNull()
    expect(ctx.notFound.value).toBe(true)
    me.perms = { c1: true }
    expect(ctx.competition.value?.name).toBe('Games')
    expect(ctx.notFound.value).toBe(false)
  })

  it('shows a listed one to everyone, restricted to its overview until it’s published', async () => {
    meta.c1 = { name: 'Games', published: false, listed: true, date: day(10) }
    const { ctx } = open()
    await flush()
    expect(ctx.competition.value?.name).toBe('Games')
    expect(ctx.notFound.value).toBe(false)
    expect(ctx.restricted.value).toBe(true)
    // Its organisers see everything.
    me.perms = { c1: true }
    expect(ctx.restricted.value).toBe(false)
  })

  it('waits for your permissions before calling an unpublished competition not found', async () => {
    meta.c1 = { name: 'Games', published: false, date: day(10) }
    me.accessKnown = false
    const { ctx } = open()
    await flush()
    expect(ctx.loading.value).toBe(true)
    expect(ctx.notFound.value).toBe(false)
    me.perms = { c1: true }
    me.accessKnown = true
    expect(ctx.loading.value).toBe(false)
    expect(ctx.competition.value?.name).toBe('Games')
  })

  it('says not found for a competition that doesn’t exist', async () => {
    const { ctx } = open('nope')
    await flush()
    expect(ctx.notFound.value).toBe(true)
  })
})

describe('sections', () => {
  it('reads each section once when it isn’t competition day', async () => {
    meta.c1 = { published: true, date: day(10) }
    const { ctx } = open()
    await flush()
    await Promise.all([ctx.loadDancers(), ctx.loadDancers(), ctx.loadSchedule()])
    expect(calls).toEqual(['read dancers', 'read schedule'])
    expect(ctx.dancers.value.map((d) => d.fullName)).toEqual(['Isla Ross'])
    expect(ctx.scheduleHidden.value).toBe(true)
    expect(ctx.hasSchedule.value).toBe(false)
    expect(ctx.isLive.value).toBe(false)
  })

  it('streams everything on competition day: late entries arrive', async () => {
    meta.c1 = { published: true, date: day(0) }
    const { ctx } = open()
    await flush()
    expect(ctx.isLive.value).toBe(true)
    const loaded = ctx.loadDancers()
    streams.get('dancers')!({ dancers: [{ id: 'd1', fullName: 'Isla Ross' }], groups: [], categories: [] })
    await loaded
    streams.get('dancers')!({
      dancers: [
        { id: 'd1', fullName: 'Isla Ross' },
        { id: 'd2', fullName: 'Late Entry' },
      ],
      groups: [],
      categories: [],
    })
    expect(ctx.dancers.value).toHaveLength(2)
    const results = ctx.loadResults()
    streams.get('results')!({ dances: [], results: { g1: { d1: ['d1'] } }, points: {}, hidden: false })
    await results
    expect(ctx.liveResultsAt.value).not.toBeNull()
    expect(calls).toEqual(['stream dancers', 'stream results'])
  })

  it('keeps streaming on day two of a two-day schedule, and the day after', async () => {
    meta.c1 = { published: true, date: day(-2) }
    const { ctx } = open()
    await flush()
    expect(ctx.isLive.value).toBe(false)
    await ctx.loadSchedule()
    expect(calls).toEqual(['read schedule'])
    // The schedule arrives with three days: today is the last.
    ctx.schedule.value = { days: { a: { order: 0 }, b: { order: 1 }, c: { order: 2 } } }
    await nextTick()
    expect(ctx.isLive.value).toBe(true)
    expect(calls).toEqual(['read schedule', 'stream schedule'])
  })

  it('shows a failure, and tries again next time it’s asked for', async () => {
    meta.c1 = { published: true, date: day(10) }
    const { ctx } = open()
    await flush()
    failNext = 'dancers'
    await ctx.loadDancers()
    expect(ctx.error.value?.message).toBe('permission_denied')
    await ctx.loadDancers()
    expect(calls).toEqual(['read dancers', 'read dancers'])
    expect(ctx.dancers.value).toHaveLength(1)
  })

  it('starts afresh for another competition', async () => {
    meta.c1 = { published: true, date: day(0) }
    meta.c2 = { published: true, date: day(10) }
    const { ctx, competitionId } = open()
    await flush()
    void ctx.loadDancers()
    competitionId.value = 'c2'
    await flush()
    expect(ctx.dancers.value).toEqual([])
    expect(calls).toContain('stop dancers')
    await ctx.loadDancers()
    expect(calls.at(-1)).toBe('read dancers')
  })
})
