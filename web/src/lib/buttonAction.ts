import { computed, ref } from 'vue'

export type ButtonAction = (event: MouseEvent) => unknown

/** Lock immediately, including before Vue renders disabled, and release on success or failure. */
export function useButtonAction(props: {
  busy?: boolean
  disabled?: boolean
  onClick?: ButtonAction | ButtonAction[]
}) {
  const pending = ref(false)
  const busy = computed(() => !!props.busy || pending.value)
  const disabled = computed(() => !!props.disabled || busy.value)
  function guard(event: MouseEvent) {
    if (disabled.value) {
      event.preventDefault()
      event.stopImmediatePropagation()
      return false
    }
    return true
  }
  async function click(event: MouseEvent) {
    if (!guard(event)) return
    const handlers = Array.isArray(props.onClick) ? props.onClick : [props.onClick]
    pending.value = true
    try {
      const results = handlers.map((handler) => handler?.(event))
      if (
        results.some(
          (result) =>
            result && typeof (result as PromiseLike<unknown>).then === 'function',
        )
      ) {
        const settled = await Promise.allSettled(results)
        const failure = settled.find((result) => result.status === 'rejected')
        if (failure?.status === 'rejected') throw failure.reason
      }
    } finally {
      pending.value = false
    }
  }
  return { busy, disabled, click, guard }
}
