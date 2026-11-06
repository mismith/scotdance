import { until } from '@vueuse/core'
import { set } from 'firebase/database'
import { dataRef } from '@/firebase'
import { useAuthStore } from '@/stores/auth'
import { useMeStore } from '@/stores/me'

// Profile view counts: which dancers' profiles a signed-in account opened,
// once each per UTC day (dancers:views/{uid}/{day}/{dancerId}). Functions
// flag an account that opens lots in a day (functions/src/profileViews.ts),
// to catch someone browsing children's profiles in the app. System admins
// aren't counted: they open lots, looking after the app.

const seen = new Set<string>()

/** Today as the database keys it: 2026-11-04, in UTC. */
const today = () => new Date().toISOString().slice(0, 10)

/** Note that the signed-in account opened this dancer's profile. Fire and forget. */
export function recordProfileView(dancerId: string): void {
  if (!dancerId) return
  void record(dancerId).catch(() => {})
}

async function record(dancerId: string) {
  const auth = useAuthStore()
  const me = useMeStore()
  // Who it is (and whether they're a system admin) is known a moment after the page opens.
  await until(() => auth.authReady).toBe(true, { timeout: 5000 })
  if (!auth.uid) return
  await until(() => me.permissionsLoaded).toBe(true, { timeout: 5000 })
  if (me.isAdmin) return
  const day = today()
  const key = `${auth.uid}/${day}/${dancerId}`
  if (seen.has(key)) return
  seen.add(key)
  await set(dataRef(`dancers:views/${key}`), true)
}
