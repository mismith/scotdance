import { createApp } from 'vue'
import App from './EditorApp.vue'
import { vProximity } from '@/directives/proximity'
import '@/composables/useTheme'
import '@fontsource-variable/atkinson-hyperlegible-next/wght.css'
import '../style.css'
import './style.css'
document.documentElement.dataset.dancerEditor = ''
// The frame fills the viewport; the shared dialog owns the surface and its only scroll area.
document.documentElement.style.background = 'transparent'
document.body.style.background = 'transparent'
void document.fonts
  .load('700 17px "Atkinson Hyperlegible Next Variable"')
  .catch(() => [])
  .then(() => createApp(App).directive('proximity', vProximity).mount('#app'))
