import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { VueFire, VueFireAuthOptionsFromAuth } from 'vuefire'

import AccountApp from './AccountApp.vue'
import { auth, firebaseApp } from '@/firebase'
import { vTapFeedback } from '@/directives/tapFeedback'
import { vProximity } from '@/directives/proximity'
import '@/composables/useTheme'
import '@fontsource-variable/atkinson-hyperlegible-next/wght.css'
import '@/style.css'

// Account controls stay on the identity origin; only Connect may host this frame.
const app = createApp(AccountApp)
app.use(createPinia())
app.use(VueFire, { firebaseApp, modules: [VueFireAuthOptionsFromAuth({ auth })] })
app.directive('tap-feedback', vTapFeedback)
app.directive('proximity', vProximity)
document.addEventListener('touchstart', () => {}, { passive: true })
app.mount('#app')
