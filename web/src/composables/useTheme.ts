import { computed } from 'vue'
import { useColorMode } from '@vueuse/core'

export type Theme = 'light' | 'dark' | 'auto'

const { store, state } = useColorMode<Theme>({ storageKey: 'theme' })

// `state` resolves 'auto' to the actual current preference (light/dark),
// so consumers needing the effective theme don't have to re-derive.
const isDark = computed(() => state.value === 'dark')

export function useTheme() {
  return { theme: store, isDark }
}
