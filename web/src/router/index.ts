import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { getCurrentUser } from 'vuefire'
import { startViewTransition } from '@/lib/transition'
import { useAuthStore } from '@/stores/auth'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/Home.vue'),
  },
  {
    path: '/dancers',
    name: 'dancers',
    component: () => import('@/views/Dancers.vue'),
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
      {
        path: 'results',
        name: 'dancer.results',
        component: () => import('@/views/dancer/Results.vue'),
      },
    ],
  },
  {
    path: '/search',
    name: 'search',
    component: () => import('@/views/Search.vue'),
  },
  {
    path: '/competitions',
    name: 'competitions',
    component: () => import('@/views/competitions/CompetitionsList.vue'),
  },
  {
    path: '/competitions/:competitionId',
    component: () => import('@/views/competition/CompetitionLayout.vue'),
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
    meta: { requiresAuth: true },
  },
  {
    path: '/policies',
    name: 'policies',
    component: () => import('@/views/Policies.vue'),
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFound.vue'),
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, _from, savedPosition) {
    // Override CSS scroll-behavior:smooth — route-change scrolls should be instant
    // (smooth animation gets cancelled by DOM changes from lazy-loaded components)
    if (savedPosition) return { ...savedPosition, behavior: 'instant' }
    // Hash scrolls are handled per-view (e.g. Group.vue#focusHashTarget) so
    // they can wait for async data and apply the chrome offset themselves.
    // Returning false here prevents Vue Router's native scrollIntoView from
    // racing and clobbering the view's manual scroll.
    if (to.hash) return false
    return { top: 0, behavior: 'instant' }
  },
})

router.beforeEach(async (to) => {
  if (!to.matched.some((r) => r.meta.requiresAuth)) return
  const user = await getCurrentUser()
  if (!user) {
    useAuthStore().openLogin()
    return { name: 'home' }
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
