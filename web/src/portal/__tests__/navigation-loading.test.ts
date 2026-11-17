import { afterEach, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { useConnectAccount } from '../account'
import App from '../App.vue'
vi.mock('../support', () => ({ openSupport: vi.fn() }))
let wrapper: VueWrapper | undefined
afterEach(() => { wrapper?.unmount(); vi.restoreAllMocks() })
async function open(ready = true) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useConnectAccount()
  store.ready = ready
  store.account = ready ? { uid: 'test-owner', name: 'Test', email: 'test@example.test', emailVerified: true } : null
  vi.spyOn(store, 'initialize').mockResolvedValue()
  vi.spyOn(store, 'load').mockResolvedValue()
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/dancers', component: defineComponent({ template: '<p>Dancers content</p>' }) },
    { path: '/account', component: defineComponent({ template: '<p>Account content</p>' }) },
    { path: '/privacy', component: defineComponent({ template: '<p>Privacy</p>' }) },
  ] })
  await router.push('/dancers')
  wrapper = mount(App, { global: { plugins: [pinia, router] } })
  await flushPromises()
  return { store, router, w: wrapper }
}
it('keeps the painted header visible and usable while another tab loads', async () => {
  const { store, router, w } = await open()
  const nav = w.get('nav')
  const signout = w.findAll('button').find(b => b.text().includes('Sign out'))!
  expect(nav.classes()).not.toContain('invisible')
  await router.push('/account')
  await flushPromises()
  expect(store.pageReady).toBe(false)
  expect(w.get('nav').element).toBe(nav.element)
  expect(nav.classes()).not.toContain('invisible')
  expect(nav.attributes('aria-hidden')).toBeUndefined()
  expect(nav.attributes('inert')).toBeUndefined()
  expect(signout.isVisible()).toBe(true)
  expect(signout.attributes('disabled')).toBeUndefined()
  await w.get('nav a[href="/dancers"]').trigger('click')
  await flushPromises()
  expect(router.currentRoute.value.path).toBe('/dancers')
  expect(w.text()).toContain('Dancers content')
  store.pageReady = true
  await router.push('/account')
  await flushPromises()
  expect(w.text()).toContain('Account content')
  expect(nav.classes()).not.toContain('invisible')
})
it('reserves navigation space during initial session loading and removes it on sign-out', async () => {
  const { store, w } = await open(false)
  expect(w.get('nav').classes()).toContain('invisible')
  store.ready = true
  await flushPromises()
  expect(w.find('nav').exists()).toBe(false)
  expect(w.text()).not.toContain('Sign out')
})
