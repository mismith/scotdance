import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import PlacedList from '../PlacedList.vue'
import type { MDancer } from '@/composables/admin/useManagedCompetition'
import type { Placings } from '@/lib/admin/results'

vi.mock('@/lib/admin/write', async () => {
  const { computed } = await import('vue')
  return { canEdit: computed(() => true) }
})

// The placed order from the keyboard: a row's handle picks it up (Space or
// Enter), the arrows move it, Space drops it and saves; Escape (or leaving
// it) puts it back without saving.

const dancer = (id: string, num: string) => [id, { id, num, label: `Dancer ${num}` } as MDancer] as const
const dancersById = new Map([dancer('d1', '101'), dancer('d2', '102'), dancer('d3', '103')])
const entries = (ids: string[]) => ids.map((id) => ({ id, tie: false }))

let wrapper: VueWrapper | null = null
function setup(placings: Placings) {
  // Dragging itself is Sortable's: here it's the rows and their handles.
  const VueDraggable = defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) })
  wrapper = mount(PlacedList, {
    props: { placings, dancersById, kind: 'dance' },
    global: { stubs: { VueDraggable } },
    attachTo: document.body,
  })
  const w = wrapper
  return {
    w,
    handle: (num: string) => w.find(`button[aria-label="Move Dancer ${num}"]`),
    order: () => w.findAll('button[aria-label^="Take out"]').map((b) => b.attributes('aria-label')!.slice(-3)),
  }
}
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('reordering from the keyboard', () => {
  it('moves a row with the arrows and saves where it’s dropped, saying who moved', async () => {
    const t = setup({ reverseFrom: null, entries: entries(['d1', 'd2', 'd3']) })
    await t.handle('103').trigger('keydown', { key: ' ' })
    await t.handle('103').trigger('keydown', { key: 'ArrowUp' })
    await t.handle('103').trigger('keydown', { key: 'ArrowUp' })
    expect(t.order()).toEqual(['103', '101', '102'])
    expect(t.w.emitted('reorder')).toBeUndefined()
    await t.handle('103').trigger('keydown', { key: ' ' })
    expect(t.w.emitted('reorder')).toEqual([[entries(['d3', 'd1', 'd2']), 'd3']])
  })

  it('saves in stored order for Championship, which shows 1st at the top', async () => {
    // Entered 6th, 5th, 4th: shown 103, 102, 101.
    const t = setup({ reverseFrom: 6, entries: entries(['d1', 'd2', 'd3']) })
    expect(t.order()).toEqual(['103', '102', '101'])
    await t.handle('101').trigger('keydown', { key: 'Enter' })
    await t.handle('101').trigger('keydown', { key: 'ArrowUp' })
    await t.handle('101').trigger('keydown', { key: 'Enter' })
    expect(t.w.emitted('reorder')).toEqual([[entries(['d2', 'd1', 'd3']), 'd1']])
  })

  it('puts a row back with Escape, saving nothing', async () => {
    const t = setup({ reverseFrom: null, entries: entries(['d1', 'd2', 'd3']) })
    await t.handle('101').trigger('keydown', { key: ' ' })
    await t.handle('101').trigger('keydown', { key: 'ArrowDown' })
    expect(t.order()).toEqual(['102', '101', '103'])
    await t.handle('101').trigger('keydown', { key: 'Escape' })
    expect(t.order()).toEqual(['101', '102', '103'])
    expect(t.w.emitted('reorder')).toBeUndefined()
  })

  it('saves nothing when dropped where it started', async () => {
    const t = setup({ reverseFrom: null, entries: entries(['d1', 'd2', 'd3']) })
    await t.handle('102').trigger('keydown', { key: ' ' })
    await t.handle('102').trigger('keydown', { key: ' ' })
    expect(t.w.emitted('reorder')).toBeUndefined()
  })
})

describe('taking out', () => {
  it('says who as well as where, so a stale position can’t take out someone else', async () => {
    const t = setup({ reverseFrom: null, entries: entries(['d1', 'd2']) })
    await t.w.find('button[aria-label="Take out Dancer 102"]').trigger('click')
    expect(t.w.emitted('remove')).toEqual([[1, 'd2']])
  })
})
