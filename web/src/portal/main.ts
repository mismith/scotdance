import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import DancersPage from './DancersPage.vue'
import DancerPage from './DancerPage.vue'
import AccountPage from './AccountPage.vue'
import PolicyPage from './PolicyPage.vue'
import SupportPage from './SupportPage.vue'
import { vProximity } from '@/directives/proximity'
import '@/composables/useTheme'
import '@fontsource-variable/atkinson-hyperlegible-next/wght.css'
import './style.css'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: route => ({ path: route.query.section === 'dancers' ? '/dancers' : '/account', query: {} }) },
    { path: '/dancers', component: DancersPage, meta: { title: 'Dancers' } },
    { path: '/dancers/new', component: DancerPage, meta: { title: 'Add dancer' } },
    { path: '/dancers/:id', component: DancerPage, meta: { title: 'Edit dancer' } },
    { path: '/account', component: AccountPage, meta: { title: 'Account' } },
    { path: '/privacy', component: PolicyPage, meta: { title: 'Privacy and terms', public: true } },
    { path: '/support', component: SupportPage, meta: { title: 'Support', public: true } },
    { path: '/:pathMatch(.*)*', redirect: '/dancers' },
  ],
  scrollBehavior: (_to, _from, saved) => saved ?? { top: 0 },
})
router.afterEach(to => { document.title = `${String(to.meta.title)} · ScotDance Connect` })
const app = createApp(App)
app.use(createPinia()).use(router).directive('proximity', vProximity)
void router.isReady().then(() => app.mount('#app'))
