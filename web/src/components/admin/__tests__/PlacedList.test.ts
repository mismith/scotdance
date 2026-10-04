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

// The placed list says who a tap took out, not just where, so a list that
// changed under the tap can't take out someone else.

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
  }
}
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('taking out', () => {
  it('says who as well as where, so a stale position can’t take out someone else', async () => {
    const t = setup({ reverseFrom: null, entries: entries(['d1', 'd2']) })
    await t.w.find('button[aria-label="Take out Dancer 102"]').trigger('click')
    expect(t.w.emitted('remove')).toEqual([[1, 'd2']])
  })
})
