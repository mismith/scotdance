import { nativePlugin } from '@/lib/native'

// A small haptic vocabulary for the native apps (via @capacitor/haptics when
// it's there). The web has no equivalent worth using, so these do nothing
// there. Use the word that matches the moment, sparingly:
//   selectionHaptic   a tick as a choice changes (segmented controls, pickers)
//   tapHaptic         light: tabs, opening a menu or sheet
//   followHaptic      medium: following someone
//   successHaptic     saved, signed in, a live result arriving
//   warningHaptic     a destructive confirm opening
//   errorHaptic       a save or sign-in that failed
interface HapticsPlugin {
  impact?: (o: { style: 'LIGHT' | 'MEDIUM' | 'HEAVY' }) => Promise<void>
  notification?: (o: { type: 'SUCCESS' | 'WARNING' | 'ERROR' }) => Promise<void>
  selectionStart?: () => Promise<void>
  selectionChanged?: () => Promise<void>
  selectionEnd?: () => Promise<void>
}

const ignore = () => {}
const plugin = () => nativePlugin<HapticsPlugin>('Haptics')

export function tapHaptic() {
  plugin()?.impact?.({ style: 'LIGHT' }).catch(ignore)
}

export function followHaptic() {
  plugin()?.impact?.({ style: 'MEDIUM' }).catch(ignore)
}

export function selectionHaptic() {
  const p = plugin()
  if (!p?.selectionChanged) return
  // iOS only ticks inside a selection session.
  void (p.selectionStart?.() ?? Promise.resolve())
    .then(() => p.selectionChanged?.())
    .then(() => p.selectionEnd?.())
    .catch(ignore)
}

export function successHaptic() {
  plugin()?.notification?.({ type: 'SUCCESS' }).catch(ignore)
}

export function warningHaptic() {
  plugin()?.notification?.({ type: 'WARNING' }).catch(ignore)
}

export function errorHaptic() {
  plugin()?.notification?.({ type: 'ERROR' }).catch(ignore)
}
