import { onScopeDispose, ref } from 'vue'
export type SaveStatus = '' | 'saving' | 'saved'
export function useSaveFeedback() {
  const status = ref<SaveStatus>('')
  let timer: ReturnType<typeof setTimeout> | undefined
  function reset() { clearTimeout(timer); status.value = '' }
  function start() { reset(); status.value = 'saving' }
  function done() { reset(); status.value = 'saved'; timer = setTimeout(reset, 1800) }
  onScopeDispose(reset)
  return { status, start, done, reset }
}
