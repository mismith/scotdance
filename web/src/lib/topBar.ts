import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, shallowReactive, type Ref } from 'vue'

// The top bar's frosted glass is one sheet behind whichever page's bar is
// showing (App), so it doesn't come and go with the pages as they slide:
// it frosts or clears with the newest bar.
const bars = shallowReactive<Ref<boolean>[]>([])

export const topBarFrosted = computed(() => bars.at(-1)?.value ?? false)

export function useTopBarFrost(frosted: Ref<boolean>) {
  const add = () => {
    remove()
    bars.push(frosted)
  }
  const remove = () => {
    const i = bars.indexOf(frosted)
    if (i >= 0) bars.splice(i, 1)
  }
  onMounted(add)
  onBeforeUnmount(remove)
  // A page kept alive out of sight (PageStack): its bar comes and goes with it.
  onActivated(add)
  onDeactivated(remove)
}
