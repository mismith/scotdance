import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

// The venue's name box, which also searches. Each search waits for the test
// to answer it, so answers can arrive out of order.

type Suggestion = { placeId: string; primaryText: string; secondaryText: string }
const pending: Array<{ q: string; resolve: (v: Suggestion[]) => void; reject: (e: unknown) => void }> = []
vi.mock('@/lib/maps', () => ({
  fetchVenueSuggestions: (q: string) => new Promise((resolve, reject) => pending.push({ q, resolve, reject })),
  resolveVenue: async (placeId: string) => ({ venue: placeId, address: '1 Main St', location: 'Calgary, AB', lat: 51, lng: -114, country: 'CA', region: 'AB', locality: 'Calgary' }),
}))

vi.mock('@/lib/admin/write', async () => {
  const { computed } = await import('vue')
  return { canEdit: computed(() => true), friendlyError: () => 'That change didn’t save.' }
})

const { default: VenueField } = await import('@/components/admin/VenueField.vue')

const answer = (q: string, names: string[]) => pending.find((p) => p.q === q)!.resolve(names.map((n) => ({ placeId: n, primaryText: n, secondaryText: 'Calgary, AB' })))
const shown = (w: ReturnType<typeof mount>) => w.findAll('[role=option]').map((o) => o.text().replace('Calgary, AB', '').trim())

function render(modelValue = '') {
  const w = mount(VenueField, { props: { modelValue, 'onUpdate:modelValue': (v: string) => w.setProps({ modelValue: v }) } })
  return w
}
async function type(w: ReturnType<typeof mount>, text: string) {
  await w.find('input').setValue(text)
  await vi.advanceTimersByTimeAsync(350)
}

afterEach(() => {
  pending.length = 0
  vi.useRealTimers()
})

describe('VenueField', () => {
  it('suggests places as you type; choosing one hands back its details and closes the list', async () => {
    vi.useFakeTimers()
    const w = render()
    await type(w, 'spruce')
    answer('spruce', ['Spruce Meadows', 'Spruce Grove Arena'])
    await flushPromises()
    expect(shown(w)).toEqual(['Spruce Meadows', 'Spruce Grove Arena'])
    await w.findAll('[role=option] button')[1].trigger('click')
    await flushPromises()
    expect(w.emitted('pick')?.[0]?.[0]).toMatchObject({ venue: 'Spruce Grove Arena', address: '1 Main St', location: 'Calgary, AB' })
    expect(shown(w)).toEqual([])
  })

  it('without choosing, what’s typed stays as the name', async () => {
    vi.useFakeTimers()
    const w = render()
    await type(w, 'Glenmore Hall')
    answer('Glenmore Hall', ['Glenmore Athletic Park'])
    await flushPromises()
    // Enter keeps what's typed and closes the list.
    await w.find('input').trigger('keydown', { key: 'Enter' })
    expect(shown(w)).toEqual([])
    expect(w.props('modelValue')).toBe('Glenmore Hall')
    expect(w.emitted('pick')).toBeUndefined()
  })

  it('picks with the keyboard', async () => {
    vi.useFakeTimers()
    const w = render()
    const input = w.find('input')
    await type(w, 'spruce')
    answer('spruce', ['Spruce Meadows', 'Spruce Grove Arena'])
    await flushPromises()
    await input.trigger('keydown', { key: 'ArrowDown' })
    await input.trigger('keydown', { key: 'ArrowDown' })
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(w.emitted('pick')?.[0]?.[0]).toMatchObject({ venue: 'Spruce Grove Arena' })
  })

  it('shows the answer to what’s typed now, even when an older search answers last', async () => {
    vi.useFakeTimers()
    const w = render()
    await type(w, 'spr')
    await type(w, 'spruce meadows')
    answer('spruce meadows', ['Spruce Meadows'])
    await flushPromises()
    answer('spr', ['Sprague Hall', 'Spring Bank'])
    await flushPromises()
    expect(shown(w)).toEqual(['Spruce Meadows'])
  })

  it('a search still waiting when one’s chosen doesn’t reopen the list', async () => {
    vi.useFakeTimers()
    const w = render()
    await type(w, 'spruce')
    answer('spruce', ['Spruce Meadows'])
    await flushPromises()
    await w.find('input').setValue('spruce m')
    await w.find('[role=option] button').trigger('click')
    await vi.advanceTimersByTimeAsync(350)
    await flushPromises()
    expect(pending.map((p) => p.q)).toEqual(['spruce'])
    expect(shown(w)).toEqual([])
  })

  it('says so when search isn’t working, and keeps what’s typed', async () => {
    vi.useFakeTimers()
    const w = render()
    await type(w, 'spruce')
    pending[0].reject(new Error('offline'))
    await flushPromises()
    expect(w.text()).toContain('Search isn’t working right now.')
    expect(w.props('modelValue')).toBe('spruce')
  })

  it('with save, what’s typed saves itself; choosing a place replaces the search instead', async () => {
    vi.useFakeTimers()
    const save = vi.fn()
    const w = mount(VenueField, { props: { modelValue: 'Old Hall', save } })
    await type(w, 'spruce')
    answer('spruce', ['Spruce Meadows'])
    await flushPromises()
    await w.find('[role=option] button').trigger('click')
    await flushPromises()
    expect(w.emitted('pick')?.[0]?.[0]).toMatchObject({ venue: 'Spruce Meadows' })
    await vi.advanceTimersByTimeAsync(1000)
    expect(save).not.toHaveBeenCalled()
    expect((w.find('input').element as HTMLInputElement).value).toBe('Spruce Meadows')

    await w.find('input').setValue('Glenmore Hall')
    await vi.advanceTimersByTimeAsync(1000)
    expect(save).toHaveBeenCalledWith('Glenmore Hall')
  })
})
