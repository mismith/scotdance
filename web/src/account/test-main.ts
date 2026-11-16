import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { VueFire, VueFireAuthOptionsFromAuth } from 'vuefire'

import AccountApp from './AccountTestApp.vue'
import { auth, firebaseApp } from '@/firebase'
import { vTapFeedback } from '@/directives/tapFeedback'
import { vProximity } from '@/directives/proximity'
import '@/composables/useTheme'
import '@fontsource-variable/atkinson-hyperlegible-next/wght.css'
import '@/style.css'

// Test fixture only; omitted from the production Vite inputs.
if (import.meta.env.MODE !== 'emulator') throw new Error('Account test fixture requires emulators.')
const app = createApp(AccountApp)
app.use(createPinia())
app.use(VueFire, { firebaseApp, modules: [VueFireAuthOptionsFromAuth({ auth })] })
app.directive('tap-feedback', vTapFeedback)
app.directive('proximity', vProximity)
document.addEventListener('touchstart', () => {}, { passive: true })
app.mount('#app')
