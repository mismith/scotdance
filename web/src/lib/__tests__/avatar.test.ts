import { webcrypto } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, reactive } from 'vue'
import { gravatarUrl, useAvatar } from '../avatar'

afterEach(() => vi.unstubAllGlobals())
const settle = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0))
  await nextTick()
}
const errorFor = (src: string) =>
  ({ target: { getAttribute: () => src } }) as unknown as Event

describe('account avatars', () => {
  it('normalizes email and requests only real, G-rated photos', async () => {
    vi.stubGlobal('crypto', webcrypto)
    expect(await gravatarUrl(' MyEmailAddress@example.com ')).toBe(
      'https://www.gravatar.com/avatar/84059b07d4be67b806386c0aad8070a23f18836bbaae342275dc0a83414c32ee?s=200&d=404&r=g',
    )
    expect(await gravatarUrl('  ')).toBeNull()
    expect(await gravatarUrl(null)).toBeNull()
  })

  it('uses a supplied photo, then Gravatar, then initials when both fail', async () => {
    const digest = vi.fn().mockResolvedValue(new Uint8Array([1]).buffer)
    vi.stubGlobal('crypto', { subtle: { digest } })
    const identity = reactive({
      email: 'fallback@example.test',
      image: 'https://example.test/photo.jpg',
    })
    const scope = effectScope()
    const avatar = scope.run(() => useAvatar(() => identity))!
    expect(avatar.image.value).toBe(identity.image)
    await settle()
    avatar.onError(errorFor(identity.image))
    expect(avatar.image.value).toContain('/avatar/01?')
    avatar.onError(errorFor(avatar.image.value!))
    expect(avatar.image.value).toBeNull()
    scope.stop()
  })

  it('ignores stale lookups and image errors after an account switch', async () => {
    const resolvers: Array<(value: ArrayBuffer) => void> = []
    vi.stubGlobal('crypto', {
      subtle: {
        digest: () => new Promise<ArrayBuffer>((resolve) => resolvers.push(resolve)),
      },
    })
    const identity = reactive({
      email: 'old@example.test',
      image: 'https://example.test/old.jpg',
    })
    const scope = effectScope()
    const avatar = scope.run(() => useAvatar(() => identity))!
    const oldImage = avatar.image.value!
    identity.email = 'new@example.test'
    identity.image = ''
    resolvers[1]!(new Uint8Array([2]).buffer)
    await settle()
    expect(avatar.image.value).toContain('/avatar/02?')
    resolvers[0]!(new Uint8Array([1]).buffer)
    await settle()
    avatar.onError(errorFor(oldImage))
    expect(avatar.image.value).toContain('/avatar/02?')
    identity.email = ''
    expect(avatar.image.value).toBeNull()
    scope.stop()
  })

  it('keeps initials when hashing is unavailable', async () => {
    vi.stubGlobal('crypto', {
      subtle: { digest: () => Promise.reject(new Error('unavailable')) },
    })
    const scope = effectScope()
    const avatar = scope.run(() =>
      useAvatar(() => ({ email: 'unavailable@example.test' })),
    )!
    await settle()
    expect(avatar.image.value).toBeNull()
    scope.stop()
  })
})
