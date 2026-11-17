import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, expect, it, vi } from 'vitest'
import InvitationPage from '../InvitationPage.vue'
import { useConnectAccount } from '../account'
const { replace, toast } = vi.hoisted(() => ({ replace: vi.fn(), toast: vi.fn() }))
vi.mock('vue-router', () => ({ useRouter: () => ({ replace }) }))
vi.mock('@/lib/admin/feedback', () => ({ toast }))
beforeEach(() => vi.clearAllMocks())
function setup() {
  const pinia = createPinia(); setActivePinia(pinia)
  const store = useConnectAccount()
  store.account = { uid: 'parent', name: 'Parent', email: 'parent@example.test', emailVerified: false }
  const request = vi.spyOn(store, 'request').mockResolvedValue({ accepted: true, dancers: [{ id: 'dancer' }] })
  const load = vi.spyOn(store, 'load').mockImplementation(async () => { store.account = { ...store.account! } })
  return { store, request, load, mountPage: () => mount(InvitationPage, { props: { token: 'invitation' }, global: { plugins: [pinia], stubs: { Button: { template: '<button><slot /></button>' } } } }) }
}
it('accepts once despite account refresh and goes directly to dancers', async () => {
  const { request, load, mountPage } = setup(); const wrapper = mountPage()
  await flushPromises()
  expect(request).toHaveBeenCalledExactlyOnceWith('invitation', { token: 'invitation', operation: 'accept' })
  expect(load).toHaveBeenCalledOnce()
  expect(toast).toHaveBeenCalledWith('Dancer added')
  expect(replace).toHaveBeenCalledExactlyOnceWith('/dancers')
  wrapper.unmount()
})
it('keeps failed invitations on screen and permits retry', async () => {
  const { request, mountPage } = setup(); request.mockRejectedValueOnce(new Error('Invitation expired'))
  const wrapper = mountPage(); await flushPromises()
  expect(wrapper.get('[role="alert"]').text()).toBe('Invitation expired')
  expect(replace).not.toHaveBeenCalled()
  await wrapper.get('button').trigger('click'); await flushPromises()
  expect(replace).toHaveBeenCalledWith('/dancers'); wrapper.unmount()
})
it('ignores a response after the invitation screen is closed', async () => {
  const { request, load, mountPage } = setup()
  let finish!: (value: unknown) => void
  request.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const wrapper = mountPage(); wrapper.unmount()
  finish({ accepted: true, dancers: [{ id: 'dancer' }] }); await flushPromises()
  expect(load).not.toHaveBeenCalled(); expect(replace).not.toHaveBeenCalled()
})
