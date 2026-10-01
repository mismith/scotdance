/* eslint-disable vue/one-component-per-file -- a parent and child to provide the builder */
import { defineComponent, h, ref } from 'vue'
import { mount } from '@vue/test-utils'
import * as fakeDb from './fakeDb'
import { NS } from './fakeDb'
import { provideBuilder, useBuilder, type SSchedule } from '../builder'
import { useAutoFill } from '../autofill'
import { createManagedCompetition, type RawData } from '@/composables/admin/useManagedCompetition'

// Mounts the schedule builder over a fake database holding one competition
// (id "c1"). Test files mock these modules first (vi.mock is hoisted):
//
//   vi.mock('firebase/database', async () => (await import('./fakeDb')).firebaseDatabase)
//   vi.mock('@/firebase', async () => (await import('./fakeDb')).firebaseMock)
//   vi.mock('@/lib/offline', async () => (await import('./fakeDb')).offlineMock)
//   vi.mock('@/lib/competitionMeta', () => ({ forgetCompetitionMeta: () => {} }))
//   vi.mock('@/composables/useCompetitions', () => ({ forgetCompetitionsList: () => {} }))
//   vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ uid: 'u1' }) }))
//   vi.mock('@/stores/me', () => ({ useMeStore: () => ({ hasCompetitionPerm: () => true }) }))

export const DATA = `${NS}/competitions:data/c1`

/** A small competition: two categories, four age groups, three dances, two platforms, three judges. */
export function sampleData(schedule?: SSchedule | false): RawData {
  return {
    categories: { cPri: { name: 'Primary', _order: 0 }, cBeg: { name: 'Beginner', _order: 1 } },
    groups: {
      gP6: { name: '6 & Under', categoryId: 'cPri', _order: 0 },
      gP7: { name: '7 & Over', categoryId: 'cPri', _order: 1 },
      gB8: { name: '8 & Under', categoryId: 'cBeg', _order: 2 },
      gB9: { name: '9 & Over', categoryId: 'cBeg', _order: 3 },
    },
    dances: {
      dFling: { name: 'Highland Fling', steps: '4', _order: 0 },
      dSword: { name: 'Sword Dance', shortName: 'Sword', _order: 1, groupIds: { gB8: true, gB9: true } },
      dPas: { name: 'Pas de Basque', _order: 2, groupIds: { gP6: true, gP7: true } },
    },
    platforms: { pA: { name: 'A', _order: 0 }, pB: { name: 'B', _order: 1 } },
    staff: {
      jRob: { firstName: 'Aileen', lastName: 'Robertson', type: 'Judge', _order: 0 },
      jWar: { firstName: 'Deborah', lastName: 'Wardrope', type: 'Judge', _order: 1 },
      jFra: { firstName: 'Iain', lastName: 'Fraser', type: 'Judge', _order: 2 },
      piper: { firstName: 'Alasdair', lastName: 'Gillies', type: 'Piper', _order: 3 },
    },
    ...(schedule === undefined ? {} : { schedule }),
  }
}

export function setup(data: RawData, opts: { dayId?: string } = {}) {
  fakeDb.reset({ [NS]: { competitions: { c1: { name: 'Test' } }, 'competitions:data': { c1: data } } })
  const dayParam = ref<string | undefined>(opts.dayId)
  let api!: { b: ReturnType<typeof useBuilder>; auto: ReturnType<typeof useAutoFill> }
  const Child = defineComponent({
    setup() {
      api = { b: useBuilder(), auto: useAutoFill() }
      return () => null
    },
  })
  const Parent = defineComponent({
    setup() {
      provideBuilder(createManagedCompetition(ref('c1')), dayParam)
      return () => h(Child)
    },
  })
  const wrapper = mount(Parent)
  return {
    ...api,
    m: api.b.m,
    dayParam,
    wrapper,
    /** The stored schedule, as the database gives it back. */
    stored: () => fakeDb.read(`${DATA}/schedule`) as SSchedule | false | null,
    /** Paths (relative to the competition's data) written since the start. */
    writtenPaths: () =>
      fakeDb.writes().flatMap((w) => Object.keys(w).map((p) => p.slice(DATA.length + 1))),
  }
}

/** Wait for queued writes and toasts to settle. */
export const flush = () => new Promise((r) => setTimeout(r, 0))
