import { nextTick, ref } from 'vue'

// What screen readers hear for news that appears on its own (a placing
// alert, going offline, the first toast). One live region, always in the
// page (App.vue): a region added together with its text often isn't read.
export const announcement = ref('')

let clear: ReturnType<typeof setTimeout> | undefined
export function announce(text: string) {
  // Cleared first, so the same words twice are read twice; and soon after,
  // since it's been read by then and stale words shouldn't linger.
  announcement.value = ''
  clearTimeout(clear)
  void nextTick(() => {
    announcement.value = text
    clear = setTimeout(() => (announcement.value = ''), 5000)
  })
}
