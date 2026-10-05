import { computed, reactive, ref, watch } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { onValue, ref as dbRef, remove, set, update } from 'firebase/database'
import { database, NAMESPACE } from '@/firebase'
import { isNative, nativePlugin, platform } from '@/lib/native'
import { onBeforeSignOut, useAuthStore } from '@/stores/auth'

// Alerts when a dancer you follow places, a competition you follow goes
// live, and on the morning of competition day.
//
// Two ways they reach you:
//  - In the app (web and native): while ScotDance.app is open, a banner
//    drops in the moment a followed dancer's placing is posted
//    (useLiveAlerts). On by default; switched off per device.
//  - Notifications (the native apps): the phone registers with Firebase
//    Cloud Messaging and its token is saved to /users:tokens/{uid}/{key};
//    functions/src/notifications.ts sends to it. Which kinds you get is
//    saved with your account, at /users/{uid}/alerts, so it's the same on
//    every phone you sign in on.

export type AlertKind = 'results' | 'morning' | 'published'
/** `importance` is the Android channel's (4 high, 3 default, 2 low: no sound), as iOS interrupts for each (functions/src/notifications.ts). */
export const ALERT_KINDS: Array<{ id: AlertKind; label: string; hint: string; importance: 2 | 3 | 4 }> = [
  { id: 'results', label: 'Results', hint: 'The moment your dancers’ placings are posted', importance: 4 },
  { id: 'morning', label: 'Morning of', hint: 'Who’s dancing today, first thing on competition day', importance: 3 },
  { id: 'published', label: 'Dancer list is up', hint: 'When a competition you follow posts its dancers and schedule', importance: 2 },
]

// @capacitor-firebase/messaging, as the native shell exposes it. It hands
// back FCM tokens on iOS too (never raw APNs ones, which FCM can't use).
interface MessagingPlugin {
  checkPermissions(): Promise<{ receive: PermissionState }>
  requestPermissions(): Promise<{ receive: PermissionState }>
  getToken(): Promise<{ token: string }>
  deleteToken(): Promise<void>
  addListener(event: 'notificationActionPerformed', cb: (e: { notification: { data?: { link?: string } } }) => void): Promise<{ remove: () => void }>
  addListener(event: 'tokenReceived', cb: (e: { token: string }) => void): Promise<{ remove: () => void }>
  /** Android only. */
  createChannel?(o: { id: string; name: string; description?: string; importance?: 1 | 2 | 3 | 4 | 5; visibility?: -1 | 0 | 1 }): Promise<void>
}
type PermissionState = 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale'
export type PushState = 'unavailable' | 'off' | 'on' | 'blocked'

// Try the native flow in a browser: emulator builds only, with ?push in the
// address (or remembered after). Nothing reaches a real phone.
const preview =
  import.meta.env.MODE === 'emulator' &&
  (new URLSearchParams(location.search).has('push') || localStorage.getItem('dev:push-preview') === '1')
if (preview) localStorage.setItem('dev:push-preview', '1')
const previewPlugin = (): MessagingPlugin => {
  let perm: PermissionState = (localStorage.getItem('dev:push-permission') as PermissionState) || 'prompt'
  return {
    checkPermissions: async () => ({ receive: perm }),
    // As if Allow were tapped on the phone's prompt.
    requestPermissions: async () => {
      perm = 'granted'
      localStorage.setItem('dev:push-permission', perm)
      return { receive: perm }
    },
    getToken: async () => ({ token: 'preview-browser-token' }),
    deleteToken: async () => {},
    addListener: async () => ({ remove: () => {} }),
  }
}
const messaging = (): MessagingPlugin | null => (preview ? previewPlugin() : nativePlugin<MessagingPlugin>('FirebaseMessaging'))

// Firebase keys can't contain . # $ [ ] /
const tokenKey = (t: string) => t.replace(/[.#$[\]/]/g, '_').slice(-120)

const inApp = useLocalStorage('alerts:inApp', true)
/** This phone's registered token, so signing out (or Off) can take it away again. */
const deviceToken = useLocalStorage<string | null>('alerts:token', null)
const permission = ref<PermissionState | 'unknown'>('unknown')
const prefs = reactive<Partial<Record<AlertKind | 'enabled', boolean>>>({})
let started = false

function start() {
  if (started) return
  started = true
  const auth = useAuthStore()
  const plugin = messaging()
  void plugin?.checkPermissions().then((p) => (permission.value = p.receive))
  // Android files notifications under channels people can change in the
  // phone's settings: one per kind, which the server sends each alert to.
  if (platform === 'android') {
    for (const k of ALERT_KINDS) {
      void plugin?.createChannel?.({ id: k.id, name: k.label, description: k.hint, importance: k.importance, visibility: 1 }).catch(() => {})
    }
  }

  // Your choices, live: they're the same on every phone.
  let off: (() => void) | null = null
  watch(
    () => auth.uid,
    (uid) => {
      off?.()
      off = null
      for (const k of Object.keys(prefs)) delete prefs[k as AlertKind]
      if (!uid) return
      off = onValue(dbRef(database, `${NAMESPACE}/users/${uid}/alerts`), (snap) => Object.assign(prefs, snap.val() ?? {}))
      // Firebase's advice: refresh the token now and then, so it's never
      // stale. Each launch re-saves it (with when), and picks up a new one.
      if (deviceToken.value) void plugin?.getToken().then(({ token }) => saveToken(uid, token)).catch(() => {})
    },
    { immediate: true },
  )

  // A new token (the phone was restored, say) replaces the old one.
  void plugin?.addListener('tokenReceived', ({ token }) => {
    if (auth.uid && deviceToken.value && token !== deviceToken.value) void saveToken(auth.uid, token)
  })

  // Signing out stops this phone getting the last account's alerts: its
  // token comes off the account, and is given up with Firebase too (which
  // still works if the first can't finish, offline).
  onBeforeSignOut(async () => {
    if (!auth.uid || !deviceToken.value) return
    void plugin?.deleteToken().catch(() => {})
    await removeToken(auth.uid).catch(() => {})
  })
}

async function saveToken(uid: string, token: string) {
  if (deviceToken.value && deviceToken.value !== token) await remove(dbRef(database, `${NAMESPACE}/users:tokens/${uid}/${tokenKey(deviceToken.value)}`)).catch(() => {})
  await set(dbRef(database, `${NAMESPACE}/users:tokens/${uid}/${tokenKey(token)}`), { token, platform: preview ? 'preview' : platform, updatedAt: Date.now() })
  deviceToken.value = token
}
async function removeToken(uid: string) {
  if (!deviceToken.value) return
  await remove(dbRef(database, `${NAMESPACE}/users:tokens/${uid}/${tokenKey(deviceToken.value)}`))
  deviceToken.value = null
}

/** Open what a tapped notification is about. Call once, with the router. */
export function handleNotificationTaps(open: (link: string) => void) {
  void messaging()?.addListener('notificationActionPerformed', (e) => {
    const link = e.notification.data?.link
    if (link?.startsWith('/')) open(link)
  })
}

export function useAlerts() {
  start()
  const auth = useAuthStore()
  const plugin = messaging()

  /** Notifications on this phone: not here (the web), off, on, or turned off in the phone's settings. */
  const push = computed<PushState>(() => {
    if (!plugin) return 'unavailable'
    if (permission.value === 'denied') return 'blocked'
    return permission.value === 'granted' && deviceToken.value && prefs.enabled === true ? 'on' : 'off'
  })
  const busy = ref(false)

  /**
   * Ask the phone (the system prompt shows once), then register it. 'failed'
   * when it couldn't be registered (Firebase unreachable, say): try later.
   */
  async function turnOn(): Promise<PushState | 'failed'> {
    if (!plugin || !auth.uid) return push.value
    busy.value = true
    try {
      let p = (await plugin.checkPermissions()).receive
      if (p === 'prompt' || p === 'prompt-with-rationale') p = (await plugin.requestPermissions()).receive
      permission.value = p
      if (p !== 'granted') return push.value
      const { token } = await plugin.getToken()
      await saveToken(auth.uid, token)
      await update(dbRef(database, `${NAMESPACE}/users/${auth.uid}/alerts`), { enabled: true })
      return 'on'
    } catch (e) {
      console.warn('Couldn’t turn on notifications', e)
      return 'failed'
    } finally {
      busy.value = false
    }
  }

  /** Stop notifications on this phone (other phones keep theirs). */
  async function turnOff() {
    if (!auth.uid) return
    busy.value = true
    try {
      await removeToken(auth.uid)
      await plugin?.deleteToken().catch(() => {})
    } finally {
      busy.value = false
    }
  }

  const kind = (k: AlertKind) =>
    computed({
      get: () => prefs[k] !== false,
      set: (on: boolean) => {
        if (auth.uid) void update(dbRef(database, `${NAMESPACE}/users/${auth.uid}/alerts`), { [k]: on })
      },
    })

  return {
    /** The in-app banner, on this device. */
    enabled: computed({
      get: () => inApp.value,
      set: (v: boolean) => (inApp.value = v),
    }),
    push,
    /** Whether the phone hasn't been asked yet: its prompt is still to come. */
    canAsk: computed(() => !!plugin && (permission.value === 'prompt' || permission.value === 'prompt-with-rationale')),
    busy,
    turnOn,
    turnOff,
    kinds: Object.fromEntries(ALERT_KINDS.map((k) => [k.id, kind(k.id)])) as Record<AlertKind, ReturnType<typeof kind>>,
    preview,
    isNative,
  }
}
