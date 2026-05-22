import { computed, reactive, ref } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { Crisp } from 'crisp-sdk-web'

const WEBSITE_ID = '160e5d08-deea-4187-a21b-39762a904c26'

// SDK lacks a typed equivalent of $crisp.is("session:ongoing") (truthy
// only after the visitor has sent or received at least one message),
// which is exactly the signal we need for launcher visibility. Fall
// through to the raw queue for that one read — `Crisp.configure` still
// sets up window.$crisp, so this remains consistent with SDK lifecycle.
declare global {
  interface Window {
    $crisp?: { is?: (state: string) => boolean }
  }
}

const ongoing = ref(false)
const unread = ref(0)
// Local UI dismissal of our launcher. Persisted because Crisp has no
// concept of our launcher, so we can't lean on its session cookie like
// we do for `ongoing`/`unread`. Auto-clears when an operator replies
// (see the message:received handler below) so a dismissed user can't
// miss a fresh response.
const dismissed = useLocalStorage('crisp-launcher-dismissed', false)

const available = computed(() => typeof window !== 'undefined' && !!window.$crisp)

function sync() {
  ongoing.value = !!window.$crisp?.is?.('session:ongoing')
  unread.value = Crisp.chat.unreadCount() ?? 0
}

function open() {
  // chat.show() un-suppresses the widget (we hid it below to suppress
  // Crisp's default launcher). chat.open() then maximises the panel.
  Crisp.chat.show()
  Crisp.chat.open()
  dismissed.value = false
}

function dismiss() {
  Crisp.chat.close()
  Crisp.chat.hide()
  dismissed.value = true
}

function setUserEmail(email: string | null | undefined) {
  if (!email) return
  Crisp.user.setEmail(email)
}

// Module-eval side effects. configure() injects the client script and
// sets up the $crisp queue; subsequent calls buffer commands until the
// script finishes loading.
Crisp.configure(WEBSITE_ID)

// Crisp's default launcher never shows — SupportLauncher.vue is the
// only visible chat affordance.
Crisp.chat.hide()

// Subscribe to every event that can change session state or unread
// count. Each handler just re-reads from Crisp's source of truth.
Crisp.message.onMessageReceived(() => { sync(); dismissed.value = false })
Crisp.message.onMessageSent(() => sync())
Crisp.chat.onChatOpened(() => { sync(); dismissed.value = false })
// When the user minimises Crisp's panel, re-hide so its default bubble
// doesn't linger over our floating chrome.
Crisp.chat.onChatClosed(() => { Crisp.chat.hide(); sync() })

// Sync initial state once Crisp finishes loading the session. Without
// this, refreshing a page mid-conversation wouldn't surface the launcher
// until the next message event.
Crisp.session.onLoaded(() => sync())

const state = reactive({
  available,
  ongoing,
  unread,
  dismissed,
  open,
  dismiss,
  setUserEmail,
})

export function useCrisp() {
  return state
}
