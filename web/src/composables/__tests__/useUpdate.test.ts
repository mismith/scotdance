import { describe, expect, it, vi } from 'vitest'

// The "new version" prompt, against whatever /versions holds.

let emit: (v: unknown) => void = () => {}
vi.mock('@/firebase', () => ({ dataRef: () => ({}) }))
vi.mock('firebase/database', () => ({
  onValue: (_r: unknown, cb: (snap: { val: () => unknown }) => void) => {
    emit = (v) => cb({ val: () => v })
    return () => {}
  },
}))
vi.mock('@/lib/native', () => ({ platform: 'web', STORE_URL: { web: null } }))
vi.mock('../../../package.json', () => ({ version: '4.0.0' }))

const { useUpdate } = await import('@/composables/useUpdate')

describe('useUpdate', () => {
  it('offers a newer version for this platform only', () => {
    const u = useUpdate()
    emit({ web: '4.0.1', ios: '9.9.9' })
    expect(u.updateAvailable).toBe(true)
    emit({ web: '4.0.0', ios: '9.9.9' })
    expect(u.updateAvailable).toBe(false)
    emit({ ios: '9.9.9' })
    expect(u.updateAvailable).toBe(false)
    emit(null)
    expect(u.updateAvailable).toBe(false)
  })

  it('ignores a version that isn’t one', () => {
    const u = useUpdate()
    emit({ web: 'latest' })
    expect(u.updateAvailable).toBe(false)
    u.openDialog()
    expect(u.dialogOpen).toBe(false)
  })
})
