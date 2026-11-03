import { computed, reactive, ref } from 'vue'
import { useLocalStorage, useTimeoutFn } from '@vueuse/core'

// What's new, as a short reel (WhatsNewSheet). Home offers it once, as a
// banner, to the people it's news to; About keeps it for anyone after that.
// A later release with news of its own gets a new RELEASE, and the banner
// comes back for it.
const RELEASE = '4'

const open = ref(false)
const seen = useLocalStorage('whats-new:seen', '')
// Closed after Home offered it: a note says where it lives now, and More
// keeps a dot until it's next opened.
const hint = ref(false)
const note = ref(false)
const { start: hideNoteLater } = useTimeoutFn(() => (note.value = false), 5000, { immediate: false })
let fromHome = false

export function useWhatsNew() {
  return reactive({
    open,
    hint,
    note,
    /** Not yet opened or dismissed on this device. */
    unseen: computed(() => seen.value !== RELEASE),
    show(offered = false) {
      fromHome = offered
      seen.value = RELEASE
      open.value = true
    },
    close() {
      open.value = false
      if (!fromHome) return
      fromHome = false
      hint.value = true
      note.value = true
      hideNoteLater()
    },
    /** The banner's ×: no reel, but still where to find it. */
    dismiss() {
      seen.value = RELEASE
      hint.value = true
      note.value = true
      hideNoteLater()
    },
    /** More was opened: the dot has done its job. */
    found() {
      hint.value = false
      note.value = false
    },
  })
}
