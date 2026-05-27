import type { Component } from 'vue'
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { getCurrentUser } from 'vuefire'
import { Calendars, Gavel, Music, School, Users } from '@lucide/vue'
import TouchIcon from '@/components/TouchIcon.vue'
import { startViewTransition } from '@/lib/transition'
import { useAuthStore } from '@/stores/auth'

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
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'about',
    component: () => import('@/views/About.vue'),
    meta: { icon: TouchIcon, title: 'About ScotDance.app' },
  },
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
    meta: { ownsBottomNav: true },
    children: [
      { path: '', redirect: { name: 'dancer.info' } },
      {
        path: 'info',
        name: 'dancer.info',
        component: () => import('@/views/dancer/Info.vue'),
      },
      {
        path: 'results',
        name: 'dancer.results',
        component: () => import('@/views/dancer/Results.vue'),
      },
    ],
  },
  {
    path: '/judges/:judgeId',
    component: () => import('@/views/judge/JudgeLayout.vue'),
    meta: { ownsBottomNav: true },
    children: [
      { path: '', redirect: { name: 'judge.info' } },
      {
        path: 'info',
        name: 'judge.info',
        component: () => import('@/views/judge/Info.vue'),
      },
      {
        path: 'competitions',
        name: 'judge.competitions',
        component: () => import('@/views/judge/Competitions.vue'),
      },
    ],
  },
  {
    path: '/pipers/:piperId',
    component: () => import('@/views/piper/PiperLayout.vue'),
    meta: { ownsBottomNav: true },
    children: [
      { path: '', redirect: { name: 'piper.info' } },
      {
        path: 'info',
        name: 'piper.info',
        component: () => import('@/views/piper/Info.vue'),
      },
      {
        path: 'competitions',
        name: 'piper.competitions',
        component: () => import('@/views/piper/Competitions.vue'),
      },
      { path: 'results', redirect: { name: 'piper.competitions' } },
    ],
  },
  {
    path: '/venues/:venueId',
    component: () => import('@/views/venue/VenueLayout.vue'),
    meta: { ownsBottomNav: true },
    children: [
      { path: '', redirect: { name: 'venue.info' } },
      {
        path: 'info',
        name: 'venue.info',
        component: () => import('@/views/venue/Info.vue'),
      },
      {
        path: 'competitions',
        name: 'venue.competitions',
        component: () => import('@/views/venue/Competitions.vue'),
      },
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
    meta: { icon: Calendars, title: 'Competitions' },
  },
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
    ],
  },
  {
    path: '/profile',
    name: 'profile',
    component: () => import('@/views/Profile.vue'),
    meta: { requiresAuth: true, title: 'Profile' },
  },
  {
    path: '/policies',
    name: 'policies',
    component: () => import('@/views/Policies.vue'),
    meta: { title: 'Policies' },
  },
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
const SCROLL_KEY = 'scroll-positions'
const readScrollPositions = (): Record<string, number> => {
  try { return JSON.parse(localStorage.getItem(SCROLL_KEY) ?? '{}') } catch { return {} }
}
const writeScrollPositions = (m: Record<string, number>) => {
  try { localStorage.setItem(SCROLL_KEY, JSON.stringify(m)) } catch { /* quota / private mode */ }
}

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    // Override CSS scroll-behavior:smooth — route-change scrolls should be instant
    // (smooth animation gets cancelled by DOM changes from lazy-loaded components)
    if (savedPosition) return { ...savedPosition, behavior: 'instant' }
    // Query/hash-only nav on the same route (e.g. typing into a filter) must
    // not move scroll — otherwise every keystroke snaps to top.
    if (from && to.path === from.path) return false
    // Hash scrolls are handled per-view (e.g. Group.vue#focusHashTarget) so
    // they can wait for async data and apply the chrome offset themselves.
    // Returning false here prevents Vue Router's native scrollIntoView from
    // racing and clobbering the view's manual scroll.
    if (to.hash) return false
    const stored = readScrollPositions()[to.fullPath]
    if (stored != null) return { top: stored, behavior: 'instant' }
    return { top: 0, behavior: 'instant' }
  },
})

router.beforeEach((to, from) => {
  if (!from.fullPath) return
  if (to.path === from.path) return
  const m = readScrollPositions()
  m[from.fullPath] = window.scrollY
  writeScrollPositions(m)
})

// iOS standalone PWAs get suspended without firing beforeEach. pagehide is
// the last reliable hook before the WebView is evicted, so flush here too.
addEventListener('pagehide', () => {
  const path = router.currentRoute.value.fullPath
  if (!path) return
  const m = readScrollPositions()
  m[path] = window.scrollY
  writeScrollPositions(m)
})

router.beforeEach(async (to) => {
  if (!to.matched.some((r) => r.meta.requiresAuth)) return
  const user = await getCurrentUser()
  if (!user) {
    useAuthStore().openLogin()
    return { name: 'about' }
  }
})

router.beforeResolve(async (to, from) => {
  if (from.matched.length === 0) return
  // Skip transition for same-route query-only changes (e.g. typing into a
  // search input that syncs ?q= to the URL) — the snapshot/replay would
  // flicker visible text on each keystroke.
  if (to.name === from.name && to.path === from.path) return
  const transition = startViewTransition()
  await transition.captured
})
