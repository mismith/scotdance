import { beforeEach, expect, it, vi } from 'vitest'
import type { User } from 'firebase/auth'
const api = vi.hoisted(() => ({ reload: vi.fn(), sendEmailVerification: vi.fn() }))
vi.mock('firebase/auth', () => api)
import { verifyEmailForOwner } from '../verifyEmail'
beforeEach(() => { vi.resetAllMocks() })
const user = (uid = 'owner', emailVerified = false) => ({ uid, emailVerified }) as User
it('sends only for the requested owner after refreshing the actual identity record', async () => {
  const owner = user()
  await verifyEmailForOwner(() => owner, 'owner')
  expect(api.reload).toHaveBeenCalledWith(owner)
  expect(api.sendEmailVerification).toHaveBeenCalledWith(owner)
})
it('does not send for a missing or different central account', async () => {
  for (const owner of [null, user('other')]) await expect(verifyEmailForOwner(() => owner, 'owner')).rejects.toThrow('Sign in')
  expect(api.sendEmailVerification).not.toHaveBeenCalled()
})
it('does not send after an account switch during refresh', async () => {
  let owner = user()
  api.reload.mockImplementation(async () => { owner = user('other') })
  await expect(verifyEmailForOwner(() => owner, 'owner')).rejects.toThrow('account changed')
  expect(api.sendEmailVerification).not.toHaveBeenCalled()
})
it('does not resend for an already verified account', async () => {
  await verifyEmailForOwner(() => user('owner', true), 'owner')
  expect(api.sendEmailVerification).not.toHaveBeenCalled()
})
it('lets send failures reach the initiating button without claiming success', async () => {
  api.sendEmailVerification.mockRejectedValue(new Error('Rate limited'))
  await expect(verifyEmailForOwner(() => user(), 'owner')).rejects.toThrow('Rate limited')
})
