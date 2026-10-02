import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createHead } from '@unhead/vue/client'
import { VueFire, VueFireAuthOptionsFromAuth, VueFireDatabaseOptionsAPI } from 'vuefire'

import App from './App.vue'
import { router } from './router'
import { auth, firebaseApp } from './firebase'
import { vTapFeedback } from './directives/tapFeedback'
import { vProximity } from './directives/proximity'
import { setupNative } from './lib/native'
import './composables/useTheme'
import '@fontsource-variable/atkinson-hyperlegible-next/wght.css'
// Competitor numbers and other figures that line up in columns.
import '@fontsource-variable/atkinson-hyperlegible-mono/wght.css'
import './style.css'

const app = createApp(App)

app.use(createPinia())
app.use(createHead())
app.use(router)
app.use(VueFire, {
  firebaseApp,
  // The auth made in firebase.ts (VueFireAuth() would make its own, with the popup helper).
  modules: [VueFireAuthOptionsFromAuth({ auth }), VueFireDatabaseOptionsAPI()],
})

app.directive('tap-feedback', vTapFeedback)
app.directive('proximity', vProximity)
// iOS only applies :active (the press-* states) once a touchstart listener exists.
document.addEventListener('touchstart', () => {}, { passive: true })

app.config.errorHandler = (err, _instance, info) => {
  console.error('[vue:error]', info, err)
}

// A page's code failing to load usually means a new version went out: load
// the page afresh to pick it up. Only once a minute, so code that's really
// missing (or a flaky connection) can't reload the app over and over.
const RELOAD_KEY = 'chunk-reload-at'
router.onError((err, to) => {
  const message = err instanceof Error ? err.message : String(err)
  if (
    /Failed to fetch dynamically imported module|Importing a module script failed/i.test(
      message,
    )
  ) {
    let last = 0
    try {
      last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0)
      sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
    } catch {
      /* private mode: reload anyway */
    }
    if (Date.now() - last > 60_000) {
      window.location.assign(to.fullPath)
      return
    }
  }
  console.error('[router:error]', message, err)
})

app.mount('#app')
setupNative()
