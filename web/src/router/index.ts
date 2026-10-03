import { nextTick, type Component } from 'vue'
import {
  createRouter,
  createWebHistory,
  isNavigationFailure,
  NavigationFailureType,
  type RouteRecordRaw,
  type RouteLocationNormalized,
} from 'vue-router'
import { getCurrentUser } from 'vuefire'
import { CalendarDays, Gavel, House, Info, Music, School, Settings, Users } from '@lucide/vue'
import { startViewTransition } from '@/lib/transition'
import { byPath, fromTap, inverse, types, type Motion } from '@/lib/navMotion'
import { trackCompetitionEntry } from '@/lib/competitionExit'
import { useAuthStore } from '@/stores/auth'
import { recordBackLabel } from '@/lib/backLabels'
import { isNative } from '@/lib/native'
import { ROUTE_INFO_KEY, SCROLL_POSITIONS_KEY } from '@/lib/deviceHistory'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    /**
     * Layout renders its own bottom nav (e.g. competition info tabs, dancer
     * profile tabs). App skips GlobalBottomNav so the two don't stack.
     */
    ownsBottomNav?: boolean
    /**
     * Human-readable name for this route. Used as the page title fallback
     * and the back-pill label when navigating away. Routes with `icon` set
     * are treated as navigable sections by chrome (GlobalBottomNav, etc.).
     */
    title?: string
    icon?: Component
    /** Manage and system-admin screens. */
    admin?: boolean
    /** Manage: the section a sub-page (import, draws) goes back to on phones. */
    manageParent?: string
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/Home.vue'),
    meta: { icon: House, title: 'Home' },
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('@/views/About.vue'),
    meta: { icon: Info, title: 'About ScotDance.app' },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/Settings.vue'),
    meta: { icon: Settings, title: 'Settings' },
  },
  // The More tab is a menu now; old links land on Settings.
  { path: '/more', redirect: { name: 'settings' } },
  {
    path: '/dancers',
    name: 'dancers',
    component: () => import('@/views/Dancers.vue'),
    meta: { icon: Users, title: 'Dancers' },
  },
  {
    path: '/judges',
    name: 'judges',
    component: () => import('@/views/Judges.vue'),
    meta: { icon: Gavel, title: 'Judges' },
  },
  {
    path: '/pipers',
    name: 'pipers',
    component: () => import('@/views/Pipers.vue'),
    meta: { icon: Music, title: 'Pipers' },
  },
  {
    path: '/venues',
    name: 'venues',
    component: () => import('@/views/Venues.vue'),
    meta: { icon: School, title: 'Venues' },
  },
  {
    path: '/dancers/:dancerId',
    component: () => import('@/views/dancer/DancerLayout.vue'),
        children: [
      { path: '', redirect: { name: 'dancer.info' } },
      {
        path: 'info',
        name: 'dancer.info',
        component: () => import('@/views/dancer/Info.vue'),
      },
      // One page now; old links to /results land on it.
      { path: 'results', name: 'dancer.results', redirect: { name: 'dancer.info' } },
    ],
  },
  {
    path: '/judges/:judgeId',
    component: () => import('@/views/judge/JudgeLayout.vue'),
        children: [
      { path: '', redirect: { name: 'judge.info' } },
      {
        path: 'info',
        name: 'judge.info',
        component: () => import('@/views/judge/Info.vue'),
      },
      { path: 'competitions', name: 'judge.competitions', redirect: { name: 'judge.info' } },
    ],
  },
  {
    path: '/pipers/:piperId',
    component: () => import('@/views/piper/PiperLayout.vue'),
        children: [
      { path: '', redirect: { name: 'piper.info' } },
      {
        path: 'info',
        name: 'piper.info',
        component: () => import('@/views/piper/Info.vue'),
      },
      { path: 'competitions', name: 'piper.competitions', redirect: { name: 'piper.info' } },
      { path: 'results', redirect: { name: 'piper.competitions' } },
    ],
  },
  {
    path: '/venues/:venueId',
    component: () => import('@/views/venue/VenueLayout.vue'),
        children: [
      { path: '', redirect: { name: 'venue.info' } },
      {
        path: 'info',
        name: 'venue.info',
        component: () => import('@/views/venue/Info.vue'),
      },
      { path: 'competitions', name: 'venue.competitions', redirect: { name: 'venue.info' } },
      { path: 'results', redirect: { name: 'venue.competitions' } },
    ],
  },
  {
    path: '/search',
    name: 'search',
    component: () => import('@/views/Search.vue'),
    meta: { title: 'Search' },
  },
  {
    path: '/competitions',
    name: 'competitions',
    component: () => import('@/views/competitions/CompetitionsList.vue'),
    meta: { icon: CalendarDays, title: 'Competitions' },
  },
  {
    path: '/manage',
    name: 'manage.competitions',
    component: () => import('@/views/manage/ManageCompetitions.vue'),
    meta: { title: 'Manage competitions' },
  },
  {
    path: '/admin',
    name: 'admin',
    component: () => import('@/views/admin/AdminLayout.vue'),
    meta: { ownsBottomNav: true, admin: true, title: 'System admin' },
    children: [
      { path: 'submissions/:submissionId?', name: 'admin.submissions', component: () => import('@/views/admin/Submissions.vue') },
      { path: 'users/:userId?', name: 'admin.users', component: () => import('@/views/admin/Users.vue') },
      { path: 'tools', name: 'admin.tools', component: () => import('@/views/admin/Tools.vue') },
      // The old admin's pages.
      { path: 'info/:rest(.*)*', redirect: { name: 'admin.tools', params: {} } },
    ],
  },
  {
    path: '/competitions/submit',
    name: 'competitions.submit',
    component: () => import('@/views/competitions/Submit.vue'),
    meta: { title: 'Submit a competition' },
  },
  {
    path: '/competitions/:competitionId/invites/:inviteId',
    name: 'competition.invite',
    component: () => import('@/views/competition/AcceptInvite.vue'),
    meta: { title: 'Invitation' },
  },
  {
    path: '/competitions/:competitionId/manage',
    component: () => import('@/views/manage/ManageLayout.vue'),
    meta: { ownsBottomNav: true, admin: true },
    children: [
      { path: '', name: 'manage', component: () => import('@/views/manage/ManageHome.vue') },
      { path: 'details', name: 'manage.details', component: () => import('@/views/manage/Details.vue') },
      { path: 'results/:groupId?/:danceId?', name: 'manage.results', component: () => import('@/views/manage/Results.vue') },
      { path: 'schedule/:dayId?', name: 'manage.schedule', component: () => import('@/views/manage/Schedule.vue') },
      {
        path: 'dancers/import',
        name: 'manage.dancers.import',
        component: () => import('@/views/manage/ImportDancers.vue'),
        meta: { manageParent: 'manage.dancers', title: 'Import' },
      },
      { path: 'dancers/:itemId?', name: 'manage.dancers', component: () => import('@/views/manage/Dancers.vue') },
      {
        path: 'groups/:itemId/draws',
        name: 'manage.groups.draws',
        component: () => import('@/views/manage/Draws.vue'),
        meta: { manageParent: 'manage.groups', title: 'Draws' },
      },
      { path: 'groups/:itemId?', name: 'manage.groups', component: () => import('@/views/manage/Groups.vue') },
      { path: 'categories/:itemId?', name: 'manage.categories', component: () => import('@/views/manage/Categories.vue') },
      { path: 'dances/:itemId?', name: 'manage.dances', component: () => import('@/views/manage/Dances.vue') },
      { path: 'platforms/:itemId?', name: 'manage.platforms', component: () => import('@/views/manage/Platforms.vue') },
      { path: 'staff/:itemId?', name: 'manage.staff', component: () => import('@/views/manage/Staff.vue') },
      { path: 'admins', name: 'manage.admins', component: () => import('@/views/manage/Admins.vue') },
    ],
  },
  // Links from the old app's emails and bookmarks.
  { path: '/competitions/:competitionId/admin/:rest(.*)*', redirect: (to) => ({ name: 'manage', params: { competitionId: to.params.competitionId } }) },
  {
    path: '/competitions/:competitionId',
    component: () => import('@/views/competition/CompetitionLayout.vue'),
    meta: { ownsBottomNav: true },
    children: [
      { path: '', redirect: { name: 'competition.info' } },
      {
        path: 'info',
        name: 'competition.info',
        component: () => import('@/views/competition/Info.vue'),
      },
      {
        path: 'dancers',
        name: 'competition.dancers',
        component: () => import('@/views/competition/Dancers.vue'),
      },
      {
        path: 'dancers/:dancerId',
        name: 'competition.dancer',
        component: () => import('@/views/competition/Dancer.vue'),
      },
      {
        path: 'schedule',
        name: 'competition.schedule',
        component: () => import('@/views/competition/Schedule.vue'),
      },
      {
        path: 'schedule/:dayId/:blockId/:eventId',
        name: 'competition.event',
        component: () => import('@/views/competition/Event.vue'),
      },
      // The old app's deeper and shallower schedule links.
      {
        path: 'schedule/:dayId/:blockId?',
        redirect: (to) => ({ name: 'competition.schedule', params: { competitionId: to.params.competitionId } }),
      },
      {
        path: 'schedule/:dayId/:blockId/:eventId/:danceId',
        redirect: ({ params: { competitionId, dayId, blockId, eventId } }) => ({
          name: 'competition.event',
          params: { competitionId, dayId, blockId, eventId },
        }),
      },
      {
        path: 'results',
        name: 'competition.results',
        component: () => import('@/views/competition/Results.vue'),
      },
      {
        path: 'results/:groupId',
        name: 'competition.group',
        component: () => import('@/views/competition/Group.vue'),
      },
      // The old app linked each dance's results (e.g. from dancer reports).
      {
        path: 'results/:groupId/:danceId',
        redirect: ({ params: { competitionId, groupId, danceId } }) => ({
          name: 'competition.group',
          params: { competitionId, groupId },
          hash: `#dance-${danceId}`,
        }),
      },
    ],
  },
  {
    path: '/profile',
    name: 'profile',
    component: () => import('@/views/Profile.vue'),
    meta: { requiresAuth: true, title: 'Account' },
  },
  {
    path: '/policies',
    name: 'policies',
    component: () => import('@/views/Policies.vue'),
    meta: { title: 'Privacy and terms' },
  },
  // The old app had /policies/privacy and /policies/terms.
  { path: '/policies/:policyId', redirect: { name: 'policies', params: {} } },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFound.vue'),
    meta: { title: 'Not found' },
  },
]

// Persisted scroll positions keyed by route.fullPath. Covers cases that
// vue-router's native savedPosition doesn't: in-app pushes back to a list,
// and iOS-PWA cold resume after the WebView was evicted.
const readScrollPositions = (): Record<string, number> => {
  try { return JSON.parse(localStorage.getItem(SCROLL_POSITIONS_KEY) ?? '{}') } catch { return {} }
}
const writeScrollPositions = (m: Record<string, number>) => {
  try { localStorage.setItem(SCROLL_POSITIONS_KEY, JSON.stringify(m)) } catch { /* quota / private mode */ }
}
// The newest SCROLL_LIMIT pages, and never one with search words in its
// address: those are what Clear on Recent searches is for.
const SCROLL_LIMIT = 100
function saveScrollPosition(route: { fullPath: string; query: Record<string, unknown> }) {
  if (!route.fullPath || route.query.q) return
  const m = readScrollPositions()
  delete m[route.fullPath]
  m[route.fullPath] = window.scrollY
  const keys = Object.keys(m)
  for (const k of keys.slice(0, Math.max(0, keys.length - SCROLL_LIMIT))) delete m[k]
  writeScrollPositions(m)
}

// Persisted last-visited route, so cold-boot to '/' (e.g. PWA/Capacitor icon
// launch after the WebView was evicted) can resume where the user left off.
type SavedRoute = { params: Record<string, string>; query: Record<string, string> }
type RouteInfo = { $current?: string; $at?: string; [name: string]: SavedRoute | string | undefined }
const readRouteInfo = (): RouteInfo => {
  try { return JSON.parse(localStorage.getItem(ROUTE_INFO_KEY) ?? '{}') } catch { return {} }
}
const writeRouteInfo = (m: RouteInfo) => {
  try { localStorage.setItem(ROUTE_INFO_KEY, JSON.stringify(m)) } catch { /* quota / private mode */ }
}

// Going back, the page is often still loading its data, so it's too short to
// scroll to where you were and the browser clamps to the top. Wait (briefly)
// until it's tall enough, then restore.
function whenTallEnough(top: number, timeout = 2000): Promise<void> {
  return new Promise((resolve) => {
    const start = performance.now()
    const check = () => {
      const room = document.documentElement.scrollHeight - window.innerHeight
      if (room >= top || performance.now() - start > timeout) resolve()
      else requestAnimationFrame(check)
    }
    check()
  })
}

// The old app used #/ URLs (emails, bookmarks); send them to the same page
// here. Must run before createWebHistory() reads the location below.
if (location.hash.startsWith('#/')) history.replaceState(history.state, '', location.hash.slice(1) || '/')

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    // Override CSS scroll-behavior:smooth — route-change scrolls should be instant
    // (smooth animation gets cancelled by DOM changes from lazy-loaded components)
    if (savedPosition) return whenTallEnough(savedPosition.top).then(() => ({ ...savedPosition, behavior: 'instant' }))
    // Query/hash-only nav on the same route (e.g. typing into a filter) must
    // not move scroll — otherwise every keystroke snaps to top.
    if (from && to.path === from.path) return false
    // Hash scrolls are handled per-view (e.g. Group.vue#focusHashTarget) so
    // they can wait for async data and apply the chrome offset themselves.
    // Returning false here prevents Vue Router's native scrollIntoView from
    // racing and clobbering the view's manual scroll.
    if (to.hash) return false
    const stored = readScrollPositions()[to.fullPath]
    if (stored != null) return whenTallEnough(stored).then(() => ({ top: stored, behavior: 'instant' as const }))
    return { top: 0, behavior: 'instant' }
  },
})

// Cold-boot restore: resume where the user left off only if they were here
// recently (e.g. the app was evicted mid-competition). After a break, open on
// Home, which is where their dancers are. Only for the installed app (native
// or home-screen web app): a browser tab reloads its own URL, and typing the
// address or opening a bookmark should land on Home.
const RESUME_WINDOW_MS = 2 * 60 * 60 * 1000
const installed = () =>
  isNative ||
  matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true
router.beforeEach((to, from) => {
  if (from.name) return
  if (to.name !== 'home') return
  if (!installed()) return
  // Only a launch onto Home itself, not a redirect there (e.g. a signed-out
  // /profile link, which should stay on Home with the sign-in sheet).
  if (to.redirectedFrom) return
  const info = readRouteInfo()
  const last = info.$current
  if (!last || last === 'home' || last === 'not-found') return
  const at = Number(info.$at ?? 0)
  if (!at || Date.now() - at > RESUME_WINDOW_MS) return
  const saved = info[last]
  if (!saved || typeof saved === 'string') return
  return { name: last, params: saved.params, query: saved.query }
})

// Remember what the page being left was called, so Back can say where it goes.
// Not while only its query changes (typing a search): that's the same page.
router.beforeEach((to, from) => {
  if (from.name && to.path !== from.path) recordBackLabel(from.fullPath, document.title)
})

router.beforeEach((to, from) => {
  if (to.path !== from.path) saveScrollPosition(from)
})

// iOS standalone PWAs get suspended without firing beforeEach. pagehide is
// the last reliable hook before the WebView is evicted, so flush here too.
addEventListener('pagehide', () => saveScrollPosition(router.currentRoute.value))

router.beforeEach(async (to) => {
  if (!to.matched.some((r) => r.meta.requiresAuth)) return
  const user = await getCurrentUser()
  if (!user) {
    useAuthStore().openLogin()
    return { name: 'home' }
  }
})

trackCompetitionEntry(router)

router.afterEach((to) => {
  // Never resume onto a dead link.
  if (!to.name || to.name === 'not-found') return
  const name = String(to.name)
  const info = readRouteInfo()
  info.$current = name
  info.$at = String(Date.now())
  info[name] = {
    params: { ...to.params } as Record<string, string>,
    query: { ...to.query } as Record<string, string>,
  }
  writeRouteInfo(info)
})

// Tapping a link to the page you're already on (e.g. the active bottom-nav
// tab) is a duplicated navigation — vue-router skips scrollBehavior, so
// catch the failure here and scroll to top instead.
router.afterEach((_to, _from, failure) => {
  if (!isNavigationFailure(failure, NavigationFailureType.duplicated)) return
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: 0, behavior: reduce ? 'instant' : 'smooth' })
})

// iOS swipe-back (and any other UA-driven traverse animation) already paints
// the destination before our guards run. Running our own VT on top would
// snapshot the already-arrived page and animate it to itself — a one-frame
// flicker. The Navigation API tells us this happened via hasUAVisualTransition.
let skipNextViewTransition = false
const nav = (window as Window & { navigation?: EventTarget }).navigation
nav?.addEventListener('navigate', (event) => {
  if ((event as Event & { hasUAVisualTransition?: boolean }).hasUAVisualTransition) {
    skipNextViewTransition = true
  }
})

// Which way a navigation goes (lib/navMotion): toward what you tapped,
// along its menu; deeper for a link in the page; Back reverses how you got
// here. Each history entry remembers how it was reached, by the position
// vue-router keeps in history.state, so the browser's Back and Forward play
// it in reverse or again. (By the time the guards run, Back and Forward have
// already moved history.state to where they're going, while a push or
// replace hasn't touched it yet. Replacing an entry, as a competition's tabs
// do, keeps how it was first reached.)
const arrivals = new Map<number, Motion>()
let lastPosition = Number(history.state?.position ?? 0)
let pending: Motion | null = null
router.afterEach((_to, _from, failure) => {
  const position = Number(history.state?.position ?? lastPosition)
  if (!failure && pending && position > lastPosition) arrivals.set(position, pending)
  lastPosition = position
  pending = null
})
const inComp = (r: RouteLocationNormalized) => r.matched.some((m) => m.meta.ownsBottomNav)
function motionFor(to: RouteLocationNormalized, from: RouteLocationNormalized): Motion {
  const now = Number(history.state?.position ?? lastPosition)
  if (now !== lastPosition) {
    const arrived = arrivals.get(Math.max(now, lastPosition))
    if (now < lastPosition) return arrived ? inverse(arrived) : { way: 'back', axis: 'x' }
    return arrived ?? { way: 'forward', axis: 'x' }
  }
  return fromTap(to.path, from.path) ?? byPath(to.path, from.path)
}

router.beforeResolve(async (to, from) => {
  if (from.matched.length === 0) return
  const motion = (pending = motionFor(to, from))
  // Skip transition for same-route query-only changes (e.g. typing into a
  // search input that syncs ?q= to the URL) — the snapshot/replay would
  // flicker visible text on each keystroke.
  if (to.name === from.name && to.path === from.path) return
  if (skipNextViewTransition) {
    skipNextViewTransition = false
    return
  }
  // Reduce Motion: pages just change (as sheets just open, see lib/morph).
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  // In Manage on wide screens, picking from a list beside its detail
  // shouldn't move the window; going to another section still does. On
  // phones each step is a page, so it always animates.
  if (to.meta.admin && from.meta.admin && to.name === from.name && matchMedia('(min-width: 768px)').matches) return
  // Crossing into or out of a competition, the tab bar's exit button buds
  // off the pill or merges back into it (style.css, vt-bud-*).
  const crossing = inComp(to) && !inComp(from) ? ['enter-competition'] : !inComp(to) && inComp(from) ? ['leave-competition'] : []
  // The top bar's back button fades out and in when it changes; when a
  // change leaves it as it was (between a competition's tabs, say), it just
  // stays (style.css, same-back).
  const before = barParts()
  const updated = new Promise<void>((resolve) => (barUpdated = resolve))
  const transition = startViewTransition(async (vtTypes) => {
    await updated
    const after = barParts()
    if (after.back && after.back === before.back) vtTypes?.add('same-back')
  }, [...crossing, ...types(motion)])
  await transition.captured
})
// The top bar's back button, as drawn.
const barParts = () => ({ back: document.querySelector('[data-bar="back"]')?.outerHTML ?? null })
// The new page is in once the router's done and Vue has drawn it.
let barUpdated: (() => void) | null = null
router.afterEach(async () => {
  await nextTick()
  barUpdated?.()
  barUpdated = null
})
