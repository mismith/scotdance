import { nativePlugin } from '@/lib/native'

// Text size follows the phone, not an in-app setting.
//
// On the web, the browser's own zoom and text settings already apply (all
// sizes are rem-based). Inside the native app, the WebView ignores the
// phone's text-size setting by default, so people who need big text would
// get small text. When the app is built with @capacitor/text-zoom, this
// reads the phone's preferred size and applies it, and re-checks when the
// app comes back to the foreground (the setting may have changed).

interface TextZoomPlugin {
  getPreferred(): Promise<{ value: number }>
  set(opts: { value: number }): Promise<void>
}

const textZoom = () => nativePlugin<TextZoomPlugin>('TextZoom')

let applied = false

export function useDisplayPrefs() {
  if (applied) return
  applied = true
  const plugin = textZoom()
  if (!plugin) return
  const apply = async () => {
    try {
      const { value } = await plugin.getPreferred()
      await plugin.set({ value })
    } catch {
      /* plugin missing on this build: default size */
    }
  }
  void apply()
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void apply()
  })
}
