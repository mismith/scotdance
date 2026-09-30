import { watchEffect } from 'vue'
import { useLocalStorage } from '@vueuse/core'

// Per-device display preferences, applied to <html>.
//
// Text size: every size in the app is rem-based, so scaling the root font
// scales type, spacing and targets together. Standard is the compact 80%
// design; Large (125%) is the size of the original Front Row prototype.
// The percentage is of the browser's own default, so a phone already set
// to large text starts larger still.
//
// Higher contrast follows the phone's own Increase Contrast setting (see
// style.css); there's no separate in-app switch.

export type TextSize = 'standard' | 'large' | 'largest'

export const TEXT_SIZES: Array<{ id: TextSize; label: string; scale: number }> = [
  { id: 'standard', label: 'Standard', scale: 1 },
  { id: 'large', label: 'Large', scale: 1.25 },
  { id: 'largest', label: 'Largest', scale: 1.5 },
]

const textSize = useLocalStorage<TextSize>('display:textSize', 'standard')

let applied = false

export function useDisplayPrefs() {
  if (!applied) {
    applied = true
    watchEffect(() => {
      const root = document.documentElement
      const scale = TEXT_SIZES.find((t) => t.id === textSize.value)?.scale ?? 1
      root.style.fontSize = scale === 1 ? '' : `${scale * 100}%`
    })
  }
  return { textSize }
}
