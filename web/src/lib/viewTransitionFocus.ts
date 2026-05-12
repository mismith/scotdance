import { computed, nextTick, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'

// Tracks the currently "focused" entity per scope so list rows can opt into
// being the view-transition source for that scope without all peer rows also
// participating in the snapshot. Detail pages set focus on mount (so back-nav
// re-tags the right row); list rows set focus on click (so forward-nav tags
// the clicked row before the snapshot is taken).
const focused = ref<Record<string, string | null>>({})

export function focusVt(scope: string, id: string | null | undefined): void {
  focused.value[scope] = id ?? null
}

export function useVtName(
  scope: string,
  id: MaybeRefOrGetter<string | number | null | undefined>,
  name: string,
) {
  return computed(() => {
    const v = toValue(id)
    if (v == null) return undefined
    return focused.value[scope] === String(v) ? name : undefined
  })
}

// Non-reactive sibling of useVtName for inline use inside v-for rows. Vue
// templates track the reactive read of `focused`, so the row re-renders
// when focus changes — no need to allocate a computed per row.
export function vtName(
  scope: string,
  id: string | number | null | undefined,
  name: string,
): string | undefined {
  if (id == null) return undefined
  return focused.value[scope] === String(id) ? name : undefined
}

// Per-entity bundle: closes scope into the three calls a list/detail pair
// needs. Names are derived as `${scope}-${kind}` (so the scope string
// doubles as the vt-name prefix).
//
//   const vt = useVtScope('event')
//
//   // List row: focus on click + tag elements when focused.
//   <a @click="vt.onNavigate($event, navigate, event.id)">
//     <span :style="{ viewTransitionName: vt.name(event.id, 'name') }" />
//
//   // Detail page: keep focus synced so back-nav tags the right source row.
//   vt.syncFocus(eventId)
export function useVtScope(scope: string) {
  async function onNavigate(
    e: MouseEvent,
    navigate: (e?: MouseEvent) => unknown,
    id: string | number | null | undefined,
  ) {
    focusVt(scope, id == null ? null : String(id))
    // Vue's reactivity is async — flush the view-transition-name into the
    // DOM before the router triggers startViewTransition, otherwise the old
    // snapshot is captured without the tag and there's nothing to morph from.
    await nextTick()
    await navigate(e)
  }

  function syncFocus(
    idRef: MaybeRefOrGetter<string | number | null | undefined>,
  ) {
    watch(
      () => toValue(idRef),
      (v) => focusVt(scope, v == null ? null : String(v)),
      { immediate: true },
    )
  }

  function name(
    id: string | number | null | undefined,
    kind: string,
  ): string | undefined {
    return vtName(scope, id, `${scope}-${kind}`)
  }

  return { onNavigate, syncFocus, name }
}
