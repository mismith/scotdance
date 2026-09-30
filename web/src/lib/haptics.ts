import { nativePlugin } from '@/lib/native'

// A light tap under the finger for tab and bar buttons, in the native apps
// (via @capacitor/haptics when it's there). The web has no equivalent worth
// using, so it does nothing there.
interface HapticsPlugin {
  impact?: (o: { style: 'LIGHT' | 'MEDIUM' | 'HEAVY' }) => Promise<void>
}

export function tapHaptic() {
  nativePlugin<HapticsPlugin>('Haptics')?.impact?.({ style: 'LIGHT' }).catch(() => {})
}
