import { computed, reactive, watch, type Ref } from 'vue'
import { get, serverTimestamp } from 'firebase/database'
import { dataRef } from '@/firebase'
import { write } from '@/lib/admin/write'
import { useAuthStore } from '@/stores/auth'
import { useMeStore } from '@/stores/me'

// Hidden profiles: a family asked, so a dancer's profile turns off its
// signed-in extras (Overview, Results by dance) and everyone sees
// the basic one. They stay in Search, Dancers and every competition's results.
// dancers:hidden/{dancerId} = { by, byName, at, note? }, set by a system admin.

export interface HiddenInfo {
  by: string
  byName: string
  at: number
  note?: string
}

interface State {
  info: HiddenInfo | null
  loading: boolean
}

// What's known, shared: hiding or showing a profile updates every place that
// asks about it. Each dancer is read once.
const states = reactive<Record<string, State>>({})

async function load(id: string) {
  if (states[id]) return
  states[id] = { info: null, loading: true }
  try {
    states[id] = { info: ((await get(dataRef(`dancers:hidden/${id}`))).val() as HiddenInfo | null) ?? null, loading: false }
  } catch {
    // Not known: ask again next time.
    delete states[id]
  }
}

/** Whether a dancer's profile is hidden, and the admins' record of it. Read once per dancer, again if the dancer changes. */
export function useDancerHidden(dancerId: Ref<string>) {
  watch(dancerId, (id) => id && void load(id), { immediate: true })
  const state = computed(() => states[dancerId.value])
  return {
    hidden: computed(() => !!state.value?.info),
    info: computed(() => state.value?.info ?? null),
    loading: computed(() => !state.value || state.value.loading),
  }
}

/** Hide a dancer's profile (with a note for admins), or show it again. System admins only. */
export async function setDancerHidden(dancerId: string, hide: boolean, note?: string): Promise<void> {
  const auth = useAuthStore()
  const me = useMeStore()
  if (!me.isAdmin || !auth.uid) throw new Error('Only system admins can hide a profile.')
  const trimmed = note?.trim()
  await write({
    [`dancers:hidden/${dancerId}`]: hide
      ? { by: auth.uid, byName: me.displayName ?? me.email ?? 'An admin', at: serverTimestamp(), ...(trimmed ? { note: trimmed } : {}) }
      : null,
  })
  // As saved (the time is the server's), so every place that asks has it.
  const info = hide ? ((await get(dataRef(`dancers:hidden/${dancerId}`))).val() as HiddenInfo | null) : null
  states[dancerId] = { info, loading: false }
}
