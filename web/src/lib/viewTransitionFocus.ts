import { computed, nextTick, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'

// Tracks the currently "focused" entity per scope so list rows can opt into
// being the view-transition source for that scope without all peer rows also
// participating in the snapshot. Detail pages set focus on mount (so back-nav
// re-tags the right row); list rows set focus on click (so forward-nav tags
// the clicked row before the snapshot is taken).
//
// `rowKey` lets a list disambiguate when the same entity-id appears multiple
// times on one page (e.g. a dancer placing in several dances within the same
// Group). The clicked row passes a per-occurrence key so only that DOM element
// carries the view-transition-name; peers stay untagged and don't trigger
// the browser's "duplicate view-transition-name" abort.
interface FocusEntry {
  id: string
  rowKey: string | null
}
const focused = ref<Record<string, FocusEntry | null>>({})

export function focusVt(
  scope: string,
  id: string | number | null | undefined,
  rowKey: string | null = null,
): void {
  focused.value[scope] =
    id == null ? null : { id: String(id), rowKey }
}

function matches(
  scope: string,
  id: string | number | null | undefined,
  rowKey: string | null,
): boolean {
  if (id == null) return false
  const f = focused.value[scope]
  if (!f || f.id !== String(id)) return false
  // When focus carries a rowKey, only the matching row participates. When it
  // doesn't (e.g. back-nav into a list that doesn't disambiguate), any row
  // with the right id participates.
  return f.rowKey === null || f.rowKey === rowKey
}

export function useVtName(
  scope: string,
  id: MaybeRefOrGetter<string | number | null | undefined>,
  name: string,
) {
  return computed(() => (matches(scope, toValue(id), null) ? name : undefined))
}

// Non-reactive sibling of useVtName for inline use inside v-for rows. Vue
// templates track the reactive read of `focused`, so the row re-renders
// when focus changes — no need to allocate a computed per row.
export function vtName(
  scope: string,
  id: string | number | null | undefined,
  name: string,
  rowKey: string | null = null,
): string | undefined {
  return matches(scope, id, rowKey) ? name : undefined
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
//
// For pages where the same entity-id appears multiple times (e.g. a dancer
// placing in several dances within one Group), pass a per-occurrence `rowKey`
// to both `onNavigate` and `name` so only the clicked row carries the
// view-transition-name. syncFocus preserves the rowKey when the same entity
// is re-focused (back-nav lands the morph on the same row).
export function useVtScope(scope: string) {
  async function onNavigate(
    e: MouseEvent,
    navigate: (e?: MouseEvent) => unknown,
    id: string | number | null | undefined,
    rowKey: string | null = null,
  ) {
    focusVt(scope, id, rowKey)
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
      (v) => {
        const next = v == null ? null : String(v)
        const current = focused.value[scope]
        // Same entity already focused — keep the rowKey set by the forward
        // click so back-nav re-tags the same row.
        if (next != null && current?.id === next) return
        focusVt(scope, next)
      },
      { immediate: true },
    )
  }

  function name(
    id: string | number | null | undefined,
    kind: string,
    rowKey: string | null = null,
  ): string | undefined {
    return vtName(scope, id, `${scope}-${kind}`, rowKey)
  }

  return { onNavigate, syncFocus, name }
}
