import { onActivated, onDeactivated, ref } from 'vue'

// Pages are kept alive while out of sight (PageStack), so going back to one
// is instant. A part that lives outside its page, as a bar in the chrome
// layer does, should only be there while its page is showing.
export function usePageShowing() {
  const showing = ref(true)
  onActivated(() => (showing.value = true))
  onDeactivated(() => (showing.value = false))
  return showing
}
