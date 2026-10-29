import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { VueFire, VueFireAuthOptionsFromAuth } from 'vuefire'

import ConnectApp from './ConnectApp.vue'
import { auth, firebaseApp } from '@/firebase'
import { vTapFeedback } from '@/directives/tapFeedback'
import { vProximity } from '@/directives/proximity'
import '@/composables/useTheme'
import '@fontsource-variable/atkinson-hyperlegible-next/wght.css'
import '@/style.css'

// The page organisers' other tools open to send their work to ScotDance.app
// (protocol.ts). Just enough of the app to sign in and pick a competition,
// so it opens quickly over the tool: its own sign-in (saved on this site,
// so signing in here signs in to the app too), its components, its look.
const app = createApp(ConnectApp)
app.use(createPinia())
app.use(VueFire, { firebaseApp, modules: [VueFireAuthOptionsFromAuth({ auth })] })
app.directive('tap-feedback', vTapFeedback)
app.directive('proximity', vProximity)
document.addEventListener('touchstart', () => {}, { passive: true })
app.mount('#app')
