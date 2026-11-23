import type { Router, RouteLocationNormalized } from 'vue-router'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, firebaseApp } from '@/firebase'
import { platform } from '@/lib/native'
import { version } from '../../package.json'

/**
 * Page views to Firebase (Google) Analytics, as v3 sends them, so both land in
 * the same property. What goes out is in docs/analytics.md: the page's path
 * and route name, the competition's id, the app's version and platform, the
 * signed-in uid. Never a query string (it holds what people type, often a
 * dancer's name) or the page's title (dancer pages are titled with theirs).
 */
const ID_KEY = 'analytics-id'

/** The device's own id, kept in localStorage, so GA's cookie (which the iOS app's capacitor:// page may not keep) needn't last. */
function deviceId(): string {
  try {
    const saved = localStorage.getItem(ID_KEY)
    if (saved) return saved
    const id = `${Math.floor(Math.random() * 2 ** 31)}.${Math.floor(Date.now() / 1000)}`
    localStorage.setItem(ID_KEY, id)
    return id
  } catch {
    return `${Math.floor(Math.random() * 2 ** 31)}.${Math.floor(Date.now() / 1000)}`
  }
}

/** Set for every event, so even Google's own don't read the address bar or document.title. */
const pageParams = (to: RouteLocationNormalized) => ({
  page_location: `${window.location.origin}${to.path}`,
  page_path: to.path,
  page_title: String(to.name ?? to.path),
})

export async function startAnalytics(router: Router) {
  const { isSupported, initializeAnalytics, logEvent, setDefaultEventParameters, setUserId } =
    await import('firebase/analytics')
  if (!(await isSupported())) return

  await router.isReady()
  const first = pageParams(router.currentRoute.value)
  // The config's parameters go with every event, page views and Google's own (session_start, user_engagement).
  const analytics = initializeAnalytics(firebaseApp, {
    config: {
      send_page_view: false,
      client_id: deviceId(),
      app_version: version,
      app_platform: platform,
      ...first,
    },
  })
  onAuthStateChanged(auth, (user) => setUserId(analytics, user?.uid ?? null))

  const log = (to: RouteLocationNormalized) => {
    const params = pageParams(to)
    setDefaultEventParameters(params)
    // Page views only: a `set` one would stick once you leave the competition.
    const { competitionId } = to.params
    logEvent(analytics, 'page_view', {
      ...params,
      ...(typeof competitionId === 'string' && { competition_id: competitionId }),
    })
  }
  log(router.currentRoute.value)
  router.afterEach((to, from, failure) => {
    if (!failure && to.path !== from.path) log(to)
  })
}
