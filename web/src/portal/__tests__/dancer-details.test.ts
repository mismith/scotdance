import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import type { Dancer } from '../account'
const maps = vi.hoisted(() => ({ search: vi.fn(), resolve: vi.fn() }))
vi.mock('@/lib/maps', () => ({ placesAvailable: true, fetchTownSuggestions: maps.search, resolveTown: maps.resolve }))
import DancerDetails from '../DancerDetails.vue'
function setup() {
  const dancer: Dancer = { id: 'test', revision: 0, firstName: 'Test', lastName: 'Dancer', birthday: '', category: '', studio: 'Original studio', registrationNumber: '', location: { town: 'Calgary', province: 'AB', country: 'Canada' } }
  return { dancer, w: mount(DancerDetails, { props: { modelValue: dancer } }) }
}
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })
describe('optional dancer details', () => {
  it('keeps optional fields collapsed and discards cancelled studio changes', async () => {
    const { w, dancer } = setup()
    expect(w.findAll('input')).toHaveLength(0)
    await w.get('[aria-label^="Edit studio"]').trigger('click')
    await w.get('input').setValue('Changed studio')
    await w.get('[aria-label="Cancel detail changes"]').trigger('click')
    expect(dancer.studio).toBe('Original studio')
    w.unmount()
  })
  it('flushes pending manual details when the parent saves the dancer', async () => {
    const { w, dancer } = setup()
    await w.get('[aria-label^="Edit city"]').trigger('click')
    await w.findAll('button').find(b => b.text() === 'Enter city manually')!.trigger('click')
    await w.findAll('input')[0].setValue('Canmore')
    w.vm.commitPending()
    expect(dancer.location).toEqual({ town: 'Canmore', province: 'AB', country: 'Canada' })
    w.unmount()
  })
  it('ignores old city results and supports choosing a suggestion with the keyboard', async () => {
    vi.useFakeTimers()
    let finish!: (value: unknown[]) => void
    maps.search.mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockResolvedValueOnce([{ placeId: 'new', primaryText: 'Glasgow', secondaryText: 'Scotland' }])
    maps.resolve.mockResolvedValue({ town: 'Glasgow', province: 'Scotland', country: 'United Kingdom' })
    const { w, dancer } = setup()
    await w.get('[aria-label^="Edit city"]').trigger('click')
    await w.get('input').setValue('Cal')
    await vi.advanceTimersByTimeAsync(250)
    await w.get('input').setValue('Glas')
    await vi.advanceTimersByTimeAsync(250)
    finish([{ placeId: 'old', primaryText: 'Calgary', secondaryText: 'Canada' }])
    await flushPromises()
    expect(w.get('[role="listbox"]').text()).toContain('Glasgow')
    expect(w.get('[role="listbox"]').text()).not.toContain('Calgary')
    await w.get('input').trigger('keydown', { key: 'ArrowDown' })
    await w.get('input').trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(dancer.location?.town).toBe('Glasgow')
    expect(w.find('input').exists()).toBe(false)
    w.unmount()
  })
})
