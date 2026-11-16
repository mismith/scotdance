import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/stores/auth', async () => {
  const { reactive } = await import('vue')
  const state = reactive({
    isSignedIn: false,
    signInWithEmail: vi.fn(),
    registerWithEmail: vi.fn(),
    resetPassword: vi.fn(),
  })
  return { useAuthStore: () => state }
})
import { useAuthStore } from '@/stores/auth'
import LoginForm from '../LoginForm.vue'
const auth = useAuthStore()
const render = () =>
  mount(LoginForm, {
    props: { holding: true },
    global: { stubs: { Button: { template: '<button><slot /></button>' } } },
  })
beforeEach(() => {
  auth.isSignedIn = false
  vi.mocked(auth.signInWithEmail).mockReset()
})
describe('password-manager sign-in', () => {
  it('keeps the password while successful sign-in hands control to the embedding tool', async () => {
    const w = render()
    await w.get('input[name=email]').setValue('demo@example.com')
    await w.get('input[name=password]').setValue('example-password')
    vi.mocked(auth.signInWithEmail).mockImplementation(async () => {
      auth.isSignedIn = true
    })
    await w.get('form').trigger('submit')
    await flushPromises()
    expect((w.get('input[name=password]').element as HTMLInputElement).value).toBe(
      'example-password',
    )
    expect(
      (w.get('input[name=password]').element as HTMLInputElement).validity.valueMissing,
    ).toBe(false)
    w.unmount()
  })
  it('reads autofilled DOM values even when the password manager emits no input event', async () => {
    const w = render()
    ;(w.get('input[name=email]').element as HTMLInputElement).value = 'demo@example.com'
    ;(w.get('input[name=password]').element as HTMLInputElement).value =
      'autofilled-password'
    await w.get('form').trigger('submit')
    await nextTick()
    expect(auth.signInWithEmail).toHaveBeenCalledWith(
      'demo@example.com',
      'autofilled-password',
    )
    w.unmount()
  })
  it('keeps the password on a rejected sign-in but clears it when the form is reset', async () => {
    const w = render()
    await w.get('input[name=email]').setValue('demo@example.com')
    await w.get('input[name=password]').setValue('retry-password')
    vi.mocked(auth.signInWithEmail).mockRejectedValue({ code: 'auth/invalid-credential' })
    await w.get('form').trigger('submit')
    await flushPromises()
    expect((w.get('input[name=password]').element as HTMLInputElement).value).toBe(
      'retry-password',
    )
    ;(w.vm as unknown as { reset(): void }).reset()
    await nextTick()
    expect((w.get('input[name=password]').element as HTMLInputElement).value).toBe('')
    w.unmount()
  })
})
