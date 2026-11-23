import type { Router, RouteLocationNormalized } from 'vue-router'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, firebaseApp } from '@/firebase'
import { isNative, nativePlugin, platform } from '@/lib/native'
import { version } from '../../package.json'

/**
 * Page views to Firebase (Google) Analytics, in the property v3 uses: the web
 * SDK on the web (`page_view`, as v3), the native SDK in the apps
 * (`screen_view`; their capacitor:// page keeps no cookies, so gtag never
 * sends). What goes out is
 * in docs/analytics.md: the page's path and route name, the competition's id,
 * the app's version and platform, the signed-in uid. Never a query string (it
 * holds what people type, often a dancer's name) or the page's title (dancer
 * pages are titled with theirs).
 */
interface Tracker {
  page: (to: RouteLocationNormalized) => void
  user: (uid: string | null) => void
}

/** @capacitor-firebase/analytics, as the native shell exposes it. */
interface FirebaseAnalyticsPlugin {
  logEvent(o: { name: string; params?: Record<string, unknown> }): Promise<void>
  setUserId(o: { userId: string | null }): Promise<void>
}

const pageParams = (to: RouteLocationNormalized) => ({
  page_path: to.path,
  page_title: String(to.name ?? to.path),
})

// Page views only: on the web a `set` one would stick once you leave the competition.
const competitionParams = ({ params: { competitionId } }: RouteLocationNormalized) =>
  typeof competitionId === 'string' ? { competition_id: competitionId } : {}

function nativeTracker(): Tracker | null {
  const plugin = nativePlugin<FirebaseAnalyticsPlugin>('FirebaseAnalytics')
  if (!plugin) return null
  return {
    // Apps report screens, not pages: GA's "Page title and screen name" and
    // "Page path and screen class" then read the same as the web's.
    page: (to) => {
      const { page_path, page_title } = pageParams(to)
      void plugin
        .logEvent({
          name: 'screen_view',
          params: {
            screen_name: page_title,
            screen_class: page_path,
            ...competitionParams(to),
            app_version: version,
            app_platform: platform,
          },
        })
        .catch(() => {})
    },
    user: (uid) => void plugin.setUserId({ userId: uid }).catch(() => {}),
  }
}

const ID_KEY = 'analytics-id'

/** The browser's own id, kept in localStorage, so GA's cookie needn't last. */
function deviceId(): string {
  const id = `${Math.floor(Math.random() * 2 ** 31)}.${Math.floor(Date.now() / 1000)}`
  try {
    const saved = localStorage.getItem(ID_KEY)
    if (saved) return saved
    localStorage.setItem(ID_KEY, id)
  } catch {
    /* private mode: a new id each visit */
  }
  return id
}

async function webTracker(first: RouteLocationNormalized): Promise<Tracker | null> {
  const { isSupported, initializeAnalytics, logEvent, setDefaultEventParameters, setUserId } =
    await import('firebase/analytics')
  if (!(await isSupported())) return null

  // Set for every event, so even Google's own don't read the address bar or document.title.
  const webParams = (to: RouteLocationNormalized) => ({
    page_location: `${window.location.origin}${to.path}`,
    ...pageParams(to),
  })
  // The config's parameters go with every event, page views and Google's own (session_start, user_engagement).
  const analytics = initializeAnalytics(firebaseApp, {
    config: {
      send_page_view: false,
      client_id: deviceId(),
      app_version: version,
      app_platform: platform,
      ...webParams(first),
    },
  })
  return {
    page: (to) => {
      setDefaultEventParameters(webParams(to))
      logEvent(analytics, 'page_view', { ...webParams(to), ...competitionParams(to) })
    },
    user: (uid) => setUserId(analytics, uid),
  }
}

export async function startAnalytics(router: Router) {
  await router.isReady()
  const tracker = isNative ? nativeTracker() : await webTracker(router.currentRoute.value)
  if (!tracker) return

  onAuthStateChanged(auth, (user) => tracker.user(user?.uid ?? null))
  tracker.page(router.currentRoute.value)
  router.afterEach((to, from, failure) => {
    if (!failure && to.path !== from.path) tracker.page(to)
  })
}
