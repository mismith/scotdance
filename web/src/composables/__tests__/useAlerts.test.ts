import { afterEach, describe, expect, it, vi } from 'vitest'

// Alerts still on the phone about the results you're looking at come off it
// (useAlerts' clearSeenAlerts): the native plugin, faked.

const delivered = [
  { id: 'a', data: { link: '/competitions/c1/results/g1#dance-fling' } },
  { id: 'b', data: { link: '/competitions/c1/results/g2#dance-sword' } },
  { id: 'c', data: { link: '/competitions/c1/results' } },
  { id: 'd', data: { link: '/competitions/c1/info' } },
  // Android may not keep the link.
  { id: 'e', data: {} },
]

async function load() {
  const plugin = {
    getDeliveredNotifications: vi.fn(async () => ({ notifications: delivered })),
    removeDeliveredNotifications: vi.fn(async () => {}),
  }
  vi.stubGlobal('Capacitor', { getPlatform: () => 'ios', Plugins: { FirebaseMessaging: plugin } })
  vi.resetModules()
  const { clearSeenAlerts } = await import('../useAlerts')
  /** Which notifications came off, after visiting `path`. */
  return async (path: string) => {
    plugin.removeDeliveredNotifications.mockClear()
    clearSeenAlerts(path)
    await new Promise((r) => setTimeout(r))
    return plugin.removeDeliveredNotifications.mock.calls.flatMap(([o]) => (o as { notifications: { id: string }[] }).notifications.map((n) => n.id))
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('clearing seen alerts', () => {
  it('takes off an age group’s alerts on its results page, and only those', async () => {
    const visit = await load()
    expect(await visit('/competitions/c1/results/g1')).toEqual(['a'])
  })

  it('takes off a summary across age groups on the competition’s results', async () => {
    const visit = await load()
    expect(await visit('/competitions/c1/results')).toEqual(['c'])
  })

  it('leaves them all anywhere else', async () => {
    const visit = await load()
    expect(await visit('/competitions/c1/info')).toEqual([])
    expect(await visit('/competitions/c2/results/g1')).toEqual([])
  })
})
