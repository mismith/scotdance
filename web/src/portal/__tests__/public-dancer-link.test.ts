import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
const search = vi.hoisted(() => vi.fn())
vi.mock('../publicDancers', () => ({ findPublicDancers: search }))
import PublicDancerLink from '../PublicDancerLink.vue'
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })
describe('private public-profile reference', () => {
  it('automatically links exact names, and persists an explicitly cleared profile', async () => {
    vi.useFakeTimers()
    const match = { id: 'abcdefghijklmnopqrst', name: 'Demo Dancer' }
    search.mockResolvedValue([match])
    const w = mount(PublicDancerLink, { props: { firstName: 'Demo', lastName: 'Dancer', 'onUpdate:modelValue': value => w.setProps({ modelValue: value }) } })
    await vi.advanceTimersByTimeAsync(400)
    expect(search.mock.calls[0][0]).toBe('Demo Dancer')
    expect(w.props('modelValue')).toEqual(match)
    await w.get('[aria-label="Edit dancer profile"]').trigger('click')
    await w.get('[aria-label="Clear dancer profile"]').trigger('click')
    expect(w.props('modelValue')).toBeNull()
    await vi.advanceTimersByTimeAsync(500)
    expect(search).toHaveBeenCalledTimes(1)
    w.unmount()
    const reopened = mount(PublicDancerLink, { props: { firstName: 'Demo', lastName: 'Dancer', modelValue: null } })
    await vi.advanceTimersByTimeAsync(500)
    expect(search).toHaveBeenCalledTimes(1)
    reopened.unmount()
  })
  it('does not show an outdated match after the name changes', async () => {
    vi.useFakeTimers()
    let finish!: (value: unknown[]) => void
    search.mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockResolvedValueOnce([])
    const w = mount(PublicDancerLink, { props: { firstName: 'Old', lastName: 'Name' } })
    await vi.advanceTimersByTimeAsync(400)
    await w.setProps({ firstName: 'New' })
    await vi.advanceTimersByTimeAsync(400)
    finish([{ id: 'abcdefghijklmnopqrst', name: 'Old Name' }])
    await flushPromises()
    expect(w.text()).not.toContain('Old Name')
    w.unmount()
  })
  it('flushes a pending exact match when saving immediately, then clears it after a name edit', async () => {
    vi.useFakeTimers()
    const match = { id: 'abcdefghijklmnopqrst', name: 'Genevieve Dancer' }
    search.mockResolvedValueOnce([match]).mockResolvedValueOnce([])
    const w = mount(PublicDancerLink, { props: { firstName: 'GENEVIÈVE', lastName: 'Dancer', 'onUpdate:modelValue': value => w.setProps({ modelValue: value }) } })
    await w.vm.finishMatching()
    await flushPromises()
    expect(w.props('modelValue')).toEqual(match)
    await w.setProps({ firstName: 'Another' })
    await vi.advanceTimersByTimeAsync(400)
    expect(w.props('modelValue')).toBeUndefined()
    expect(w.text()).not.toContain('Genevieve Dancer')
    w.unmount()
  })
  it('leaves approximate matches unlinked and allows a manual choice', async () => {
    vi.useFakeTimers()
    const match = { id: 'abcdefghijklmnopqrst', name: 'Demo Dancers' }
    search.mockResolvedValue([match])
    const w = mount(PublicDancerLink, { props: { firstName: 'Demo', lastName: 'Dancer', 'onUpdate:modelValue': value => w.setProps({ modelValue: value }) } })
    await vi.advanceTimersByTimeAsync(400)
    expect(w.props('modelValue')).toBeUndefined()
    await w.findAll('button').find(b => b.text() === 'Find a dancer profile')!.trigger('click')
    await vi.advanceTimersByTimeAsync(400)
    await w.findAll('button').find(b => b.text() === 'Link')!.trigger('click')
    expect(w.props('modelValue')).toEqual(match)
    w.unmount()
  })

})
