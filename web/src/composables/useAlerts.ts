import { computed } from 'vue'
import { ref as dbRef, remove, set, update } from 'firebase/database'
import { database } from '@/firebase'
import { useAuthStore } from '@/stores/auth'
import { useAlertsPrompt } from '@/composables/useAlertsPrompt'
import { useMeStore } from '@/stores/me'

// Result alerts for followed dancers.
//
// Two channels:
//  - Push (native app): the Capacitor PushNotifications plugin registers
//    the device and its FCM token is saved to /users:tokens/{uid}/{key}.
//    The `notifyFollowersOnResult` function sends to those tokens.
//  - In the app (web and native): while ScotDance is open, useLiveAlerts
//    shows a banner the moment a followed dancer's placing is posted, and a
//    system notification if the page is in the background and the browser
//    allows it.
//
// The preference lives at /users/{uid}/alerts so it follows the person, and
// in localStorage so this device remembers it signed out. Each kind of alert
// can be switched off on its own (all default on):
//   results    placings as they're posted
//   morning    a summary on the morning of each competition
//   published  a competition goes live (dancer list and schedule posted)

export type AlertKind = 'results' | 'morning' | 'published'
export const ALERT_KINDS: Array<{ id: AlertKind; label: string; hint: string }> = [
  { id: 'results', label: 'Live results', hint: 'Placings for your dancers as soon as they’re posted' },
  { id: 'morning', label: 'Morning summary', hint: 'On competition day: who’s dancing, where and when' },
  { id: 'published', label: 'Competition goes live', hint: 'When the dancer list and schedule are posted' },
]

const NAMESPACE = import.meta.env.VITE_FIREBASE_DATA_NAMESPACE || 'production'

interface PushToken {
  value: string
}
interface PushPlugin {
  checkPermissions(): Promise<{ receive: string }>
  requestPermissions(): Promise<{ receive: string }>
  register(): Promise<void>
  addListener(event: 'registration', cb: (t: PushToken) => void): Promise<{ remove: () => void }>
  addListener(event: 'registrationError', cb: (e: unknown) => void): Promise<{ remove: () => void }>
}

function nativePush(): PushPlugin | null {
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; Plugins?: Record<string, unknown> } })
    .Capacitor
  if (!cap?.isNativePlatform?.()) return null
  return (cap.Plugins?.PushNotifications as PushPlugin | undefined) ?? null
}

function platformName() {
  const cap = (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor
  return cap?.getPlatform?.() ?? 'web'
}

// Firebase keys can't contain . # $ [ ] /
const tokenKey = (t: string) => t.replace(/[.#$[\]/]/g, '_').slice(-120)

async function registerNativeToken(uid: string): Promise<boolean> {
  const push = nativePush()
  if (!push) return false
  let perm = await push.checkPermissions()
  if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
    perm = await push.requestPermissions()
  }
  if (perm.receive !== 'granted') return false
  return new Promise<boolean>((resolve) => {
    void push.addListener('registration', async (t) => {
      await set(dbRef(database, `${NAMESPACE}/users:tokens/${uid}/${tokenKey(t.value)}`), {
        token: t.value,
        platform: platformName(),
        updatedAt: Date.now(),
      })
      resolve(true)
    })
    void push.addListener('registrationError', () => resolve(false))
    void push.register()
  })
}

export function useAlerts() {
  const auth = useAuthStore()
  const prompt = useAlertsPrompt()

  const me = useMeStore()
  const enabled = computed(() => prompt.enabledHere.value)
  const kinds = computed(() => {
    const a = (me.record as { alerts?: Partial<Record<AlertKind, boolean>> } | null)?.alerts ?? {}
    return { results: a.results !== false, morning: a.morning !== false, published: a.published !== false }
  })

  async function setKind(kind: AlertKind, on: boolean) {
    const uid = auth.uid
    if (!uid) return
    await update(dbRef(database, `${NAMESPACE}/users/${uid}/alerts`), { [kind]: on, updatedAt: Date.now() })
  }

  async function enable(): Promise<'push' | 'in-app' | 'blocked'> {
    const uid = auth.uid
    if (!uid) {
      auth.requireSignIn(() => void enable(), { reason: 'alerts' })
      return 'blocked'
    }
    let channel: 'push' | 'in-app' | 'blocked' = 'in-app'
    if (nativePush()) {
      channel = (await registerNativeToken(uid)) ? 'push' : 'blocked'
    } else if ('Notification' in window && Notification.permission === 'default') {
      // Background system notifications while the page is open. Denying is
      // fine: in-app banners still work.
      await Notification.requestPermission().catch(() => undefined)
    }
    if (channel !== 'blocked') {
      prompt.enabledHere.value = true
      await update(dbRef(database, `${NAMESPACE}/users/${uid}/alerts`), {
        enabled: true,
        updatedAt: Date.now(),
      }).catch(() => undefined)
    }
    return channel
  }

  async function disable() {
    prompt.enabledHere.value = false
    const uid = auth.uid
    if (uid) {
      await update(dbRef(database, `${NAMESPACE}/users/${uid}/alerts`), {
        enabled: false,
        updatedAt: Date.now(),
      }).catch(() => undefined)
      if (nativePush()) await remove(dbRef(database, `${NAMESPACE}/users:tokens/${uid}`)).catch(() => undefined)
    }
  }

  function promptFor(name: string | null = null) {
    prompt.show(name)
  }

  return {
    get enabled() {
      return enabled.value
    },
    get kinds() {
      return kinds.value
    },
    setKind,
    enable,
    disable,
    promptFor,
    isNative: !!nativePush(),
  }
}
