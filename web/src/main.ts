import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createHead } from '@unhead/vue/client'
import { VueFire, VueFireAuth, VueFireDatabaseOptionsAPI } from 'vuefire'

import App from './App.vue'
import { router } from './router'
import { firebaseApp } from './firebase'
import { vTapFeedback } from './directives/tapFeedback'
import { setupNative } from './lib/native'
import './composables/useTheme'
import '@fontsource-variable/atkinson-hyperlegible-next/wght.css'
import './style.css'

const app = createApp(App)

app.use(createPinia())
app.use(createHead())
app.use(router)
app.use(VueFire, {
  firebaseApp,
  modules: [VueFireAuth(), VueFireDatabaseOptionsAPI()],
})

app.directive('tap-feedback', vTapFeedback)

app.config.errorHandler = (err, _instance, info) => {
  console.error('[vue:error]', info, err)
}

router.onError((err) => {
  const message = err instanceof Error ? err.message : String(err)
  if (
    /Failed to fetch dynamically imported module|Importing a module script failed/i.test(
      message,
    )
  ) {
    window.location.reload()
    return
  }
  console.error('[router:error]', message, err)
})

app.mount('#app')
setupNative()
