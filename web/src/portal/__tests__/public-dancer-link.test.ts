import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
const search = vi.hoisted(() => vi.fn())
vi.mock('../publicDancers', () => ({ findPublicDancers: search }))
import PublicDancerLink from '../PublicDancerLink.vue'
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })
describe('private public-profile reference', () => {
  it('suggests by name but links only on explicit confirmation, and unlinks', async () => {
    vi.useFakeTimers()
    const match = { id: 'abcdefghijklmnopqrst', name: 'Demo Dancer' }
    search.mockResolvedValue([match])
    const w = mount(PublicDancerLink, { props: { firstName: 'Demo', lastName: 'Dancer', 'onUpdate:modelValue': value => w.setProps({ modelValue: value }) } })
    await vi.advanceTimersByTimeAsync(400)
    expect(search.mock.calls[0][0]).toBe('Demo Dancer')
    expect(w.emitted('update:modelValue')).toBeUndefined()
    await w.get('[aria-label="Link Demo Dancer"]').trigger('click')
    expect(w.props('modelValue')).toEqual(match)
    await w.findAll('button').find(b => b.text() === 'Unlink')!.trigger('click')
    expect(w.props('modelValue')).toBeNull()
    await vi.advanceTimersByTimeAsync(500)
    expect(w.find('[aria-label="Link Demo Dancer"]').exists()).toBe(false)
    w.unmount()
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
})
