import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, expect, it, vi } from 'vitest'
import AccountForm from '@/account/AccountForm.vue'
import AccountDefaults from '../AccountDefaults.vue'
import { useConnectAccount } from '../account'
vi.mock('../citySearch', () => ({ placesAvailable: true, fetchTownSuggestions: vi.fn(async () => []), resolveTown: vi.fn() }))
afterEach(() => vi.useRealTimers())
it('clears a populated full name for editing without saving an empty name', async () => {
  vi.useFakeTimers()
  const updateDisplayName = vi.fn(async () => {})
  const wrapper = mount(AccountForm, { props: { account: { user: { email: 'test@example.com' }, displayName: 'Test Parent', photoURL: null, hasPassword: true, updateDisplayName, updateUserEmail: vi.fn(), updateUserPassword: vi.fn(), resetPassword: vi.fn(), deleteAccount: vi.fn() } }, global: { stubs: { Avatar: true } } })
  await wrapper.get('[aria-label="Clear full name"]').trigger('click')
  expect(wrapper.find('[aria-label="Clear full name"]').exists()).toBe(false)
  await vi.advanceTimersByTimeAsync(700)
  expect(updateDisplayName).not.toHaveBeenCalled()
  await wrapper.get('input[autocomplete="name"]').setValue('New Name')
  expect(wrapper.find('[aria-label="Clear full name"]').exists()).toBe(true)
  await vi.advanceTimersByTimeAsync(700)
  expect(updateDisplayName).toHaveBeenCalledWith('New Name')
  wrapper.unmount()
})
it('clears studio and the complete selected city and hides their empty clear buttons', async () => {
  vi.useFakeTimers()
  const pinia=createPinia();setActivePinia(pinia)
  const store=useConnectAccount()
  store.defaults={studio:'Test Studio',location:{town:'Calgary',province:'AB',country:'Canada'}}
  const save=vi.spyOn(store,'saveDefaults').mockResolvedValue(undefined)
  const wrapper=mount(AccountDefaults,{global:{plugins:[pinia]}})
  await wrapper.get('[aria-label="Clear teacher studio"]').trigger('click')
  expect(wrapper.find('[aria-label="Clear teacher studio"]').exists()).toBe(false)
  await vi.advanceTimersByTimeAsync(700)
  expect(save).toHaveBeenCalledWith({studio:''})
  await wrapper.get('[aria-label="Clear city"]').trigger('click')
  await flushPromises()
  expect(wrapper.find('[aria-label="Clear city"]').exists()).toBe(false)
  expect(save).toHaveBeenCalledWith({location:{town:'',province:'',country:''}})
  wrapper.unmount()
})
