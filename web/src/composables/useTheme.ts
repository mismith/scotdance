import { computed, watch } from 'vue'
import { useColorMode } from '@vueuse/core'

export type Theme = 'light' | 'dark' | 'auto'

const { store, state } = useColorMode<Theme>({ storageKey: 'theme' })

// `state` resolves 'auto' to the actual current preference (light/dark),
// so consumers needing the effective theme don't have to re-derive.
const isDark = computed(() => state.value === 'dark')

// The browser's own chrome (address bar, installed-app title bar) follows the
// app's theme too, including a manual override: index.html's theme-color
// metas only know the system's.
watch(
  isDark,
  (dark) => {
    for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
      meta.content = dark ? '#0c0f13' : '#f2f4f7'
    }
  },
  { immediate: true },
)

export function useTheme() {
  return { theme: store, isDark }
}
