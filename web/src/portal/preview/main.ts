import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PhotoPreview from './PhotoPreview.vue'
import { vProximity } from '@/directives/proximity'
import '@/composables/useTheme'
import '@fontsource-variable/atkinson-hyperlegible-next/wght.css'
import '../style.css'
void document.fonts
  .load('700 17px "Atkinson Hyperlegible Next Variable"')
  .catch(() => [])
  .then(() => {
    createApp(PhotoPreview)
      .use(createPinia())
      .directive('proximity', vProximity)
      .mount('#app')
  })
