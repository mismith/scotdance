import { ref, watch, type Ref } from 'vue'
import { useIntervalFn } from '@vueuse/core'
import { onValue, serverTimestamp, set } from 'firebase/database'
import { dataRef } from '@/firebase'
import { nowMs } from '@/lib/now'
import { useAuthStore } from '@/stores/auth'
import type { Line } from '@/lib/onNow'

export type OnNowAnswer = 'yes' | 'no' | 'undo'

// The pink lines for one competition (lib/onNow), watched only while `on`
// (its day is today), and answering for the signed-in account. After a Yes
// the line moves here straight away; the function's line takes over when it
// arrives.
export function useOnNow(competitionId: Ref<string>, on: Ref<boolean>) {
  const auth = useAuthStore()
  const lines = ref<Record<string, Line>>({})
  const mine = ref<Record<string, Line | null>>({})
  const now = ref(nowMs())
  useIntervalFn(() => (now.value = nowMs()), 30_000)

  watch(
    [competitionId, on],
    ([id, isOn], _, onCleanup) => {
      lines.value = {}
      mine.value = {}
      if (!id || !isOn) return
      const off = onValue(
        dataRef(`competitions:onNow/${id}`),
        (snap) => {
          lines.value = (snap.val() as Record<string, Line> | null) ?? {}
          mine.value = {}
        },
        () => (lines.value = {}),
      )
      onCleanup(off)
    },
    { immediate: true },
  )

  const forget = (platformId: string) => {
    const rest = { ...mine.value }
    delete rest[platformId]
    mine.value = rest
  }

  /** The line on a platform: yours for a moment after answering, then everyone's. */
  const lineFor = (platformId: string): Line | null =>
    platformId in mine.value ? mine.value[platformId] : (lines.value[platformId] ?? null)

  async function answer(platformId: string, turn: string, vote: OnNowAnswer) {
    if (!auth.uid) return
    const before = lineFor(platformId)
    if (vote === 'yes') mine.value = { ...mine.value, [platformId]: { turn, at: nowMs() } }
    if (vote === 'undo' || (vote === 'no' && before?.turn === turn)) forget(platformId)
    try {
      await set(dataRef(`competitions:onNow:votes/${competitionId.value}/${platformId}/${auth.uid}`), {
        turn,
        vote,
        at: serverTimestamp(),
      })
    } catch {
      // Refused (answered twice in a few seconds, or offline): the line shows what everyone else says.
      forget(platformId)
    }
  }

  return { now, lineFor, answer }
}
