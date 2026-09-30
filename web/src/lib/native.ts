import { watch } from 'vue'
import { useTheme } from '@/composables/useTheme'

// The native apps (Capacitor) wrap this same web build. The shell injects
// `window.Capacitor` before the page loads, with a proxy for each native
// plugin, so the web build doesn't bundle Capacitor at all: on the web these
// are simply absent and every helper here does nothing.

interface CapacitorGlobal {
  getPlatform?: () => string
  Plugins?: Record<string, unknown>
}

const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor

export type Platform = 'web' | 'ios' | 'android'
const p = cap?.getPlatform?.()
export const platform: Platform = p === 'ios' || p === 'android' ? p : 'web'
export const isNative = platform !== 'web'

export function nativePlugin<T>(name: string): T | null {
  return isNative ? ((cap?.Plugins?.[name] as T | undefined) ?? null) : null
}

export const STORE_URL: Record<Platform, string | null> = {
  ios: 'https://apps.apple.com/app/scotdance/id1386475626',
  android: 'https://play.google.com/store/apps/details?id=info.mismith.scotdance',
  web: null,
}

interface SplashScreenPlugin {
  hide: () => Promise<void>
}
interface SystemBarsPlugin {
  setStyle: (o: { style: 'DARK' | 'LIGHT' }) => Promise<void>
}
interface AppPlugin {
  addListener: (event: 'backButton', cb: (e: { canGoBack: boolean }) => void) => unknown
  minimizeApp: () => Promise<void>
}

const ignore = () => {}

/** Wire the page up to the native shell. Call once, after the app mounts. */
export function setupNative() {
  if (!isNative) return

  // The splash stays up until the page says it's ready (launchAutoHide: false).
  nativePlugin<SplashScreenPlugin>('SplashScreen')?.hide().catch(ignore)

  // Status bar icons follow the app's theme, including a manual override.
  // "DARK" means light icons for a dark background.
  const bars = nativePlugin<SystemBarsPlugin>('SystemBars')
  const { isDark } = useTheme()
  watch(isDark, (dark) => bars?.setStyle({ style: dark ? 'DARK' : 'LIGHT' }).catch(ignore), { immediate: true })

  // iOS: tapping the status bar scrolls to the top, like every native list.
  window.addEventListener('statusTap', () => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduce ? 'instant' : 'smooth' })
  })

  // Android back button: close an open sheet or menu first, then go back,
  // and from the first screen put the app away (like other Android apps).
  const app = platform === 'android' ? nativePlugin<AppPlugin>('App') : null
  void app?.addListener('backButton', ({ canGoBack }) => {
    const dialog = [...document.querySelectorAll('dialog[open]')].at(-1)
    if (dialog) dialog.dispatchEvent(new Event('cancel', { cancelable: true }))
    else if (canGoBack) history.back()
    else void app.minimizeApp()
  })
}
