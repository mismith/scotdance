<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { CircleAlert, X } from '@lucide/vue'
import Dialog from '@/components/Dialog.vue'
import Button from '@/components/ui/Button.vue'
import { confirmRequest, dismissToast, toasts } from '@/lib/admin/feedback'
import { errorHaptic, warningHaptic } from '@/lib/haptics'

// Keep the last request on screen while the dialog closes, so its words
// don't vanish mid-way.
const req = computed(() => confirmRequest.value)
const shown = shallowRef(req.value)
watch(req, (r) => {
  if (r) {
    shown.value = r
    if (r.destructive) warningHaptic()
  }
  // Then let it go once the close has played.
  else setTimeout(() => !req.value && (shown.value = null), 400)
})

// Notices sit above everything, open sheets included. A modal dialog makes
// all outside it inert (a toast's Undo would be dead under a sheet), so the
// stack is a popover that moves into the topmost open dialog: part of it, yet
// in the top layer, placed against the window.
const stack = ref<HTMLElement | null>(null)
const host = shallowRef<HTMLElement | 'body'>('body')
function retarget() {
  host.value = [...document.querySelectorAll<HTMLDialogElement>('dialog[open]')].at(-1) ?? 'body'
}
// (The stack itself is watched too: this host loads with the first toast, and
// that one must show as soon as the stack is in the page.)
watch(
  [host, () => toasts.length, stack],
  () => {
    if (stack.value?.isConnected && !stack.value.matches(':popover-open')) stack.value.showPopover?.()
  },
  { flush: 'post' },
)
let observer: MutationObserver | undefined
onMounted(() => {
  requestAnimationFrame(() => (live.value = true))
  observer = new MutationObserver(retarget)
  observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] })
  retarget()
})
onBeforeUnmount(() => observer?.disconnect())

// At most two at once: newer ones push the oldest out.
// The stack loads with the first toast; it shows them a frame after it's in
// the page, so its live region announces even that first one.
const live = ref(false)
const visible = computed(() => (live.value ? toasts.slice(-2) : []))
watch(
  () => toasts.at(-1),
  (t) => {
    retarget()
    if (t?.tone === 'error') errorHaptic()
  },
)

async function runAction(id: number, run: () => unknown) {
  dismissToast(id)
  await run()
}
</script>

<template>
  <!-- A decision, not something the user reached for: it simply appears. -->
  <Dialog :open="!!req" variant="center" :closable="false" :morph="false" @close="req?.resolve(false)">
    <template v-if="shown">
      <div class="space-y-2 pr-2">
        <h2 class="text-title">{{ shown.title }}</h2>
        <p v-if="shown.message" class="text-muted-foreground text-base">{{ shown.message }}</p>
      </div>
      <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button size="lg" @click="req?.resolve(false)">{{ shown.cancelLabel ?? 'Cancel' }}</Button>
        <Button size="lg" :variant="shown.destructive ? 'destructive' : 'primary'" @click="req?.resolve(true)">
          {{ shown.confirmLabel }}
        </Button>
      </div>
    </template>
  </Dialog>

  <!-- One notice stack, above the tab bar when there is one (style.css
       --notice-bottom; in a sheet, just above the bottom edge), sharing one
       dark glass in both themes. -->
  <Teleport :to="host">
    <div
      ref="stack"
      popover="manual"
      :style="host !== 'body' && { '--notice-bottom': 'calc(var(--safe-bottom) + 1rem)', '--notice-offset': '0px', '--toast-lift': '0px' }"
      class="pointer-events-none fixed inset-x-chrome-4 top-auto bottom-[calc(var(--notice-bottom)+var(--notice-offset,0px)+var(--toast-lift,0px))] m-0 flex h-auto w-auto flex-col items-center gap-2 overflow-visible border-0 bg-transparent p-0 text-inherit transition-[bottom] duration-(--dur-base) ease-standard"
      role="status"
      aria-live="polite"
    >
      <TransitionGroup
        move-class="transition-transform duration-(--dur-slow) ease-snappy motion-reduce:transition-none"
        enter-active-class="transition duration-(--dur-slow) ease-snappy motion-reduce:transition-none"
        enter-from-class="translate-y-4 scale-95 opacity-0"
        leave-active-class="absolute transition duration-(--dur-quick) ease-exit motion-reduce:transition-none"
        leave-to-class="scale-95 opacity-0"
      >
        <div
          v-for="t in visible"
          :key="t.id"
          class="hud pointer-events-auto flex max-w-lg items-center gap-1 rounded-2xl py-1.5 pr-1.5 pl-4"
        >
          <CircleAlert v-if="t.tone === 'error'" class="size-[1.125rem] shrink-0 text-(--hud-danger)" aria-hidden="true" />
          <p class="min-w-0 flex-1 py-1.5 text-callout font-medium" :class="t.tone === 'error' && 'pl-1'">
            <span v-if="t.tone === 'error'" class="sr-only">Error: </span>{{ t.message }}
          </p>
          <button
            v-if="t.action"
            type="button"
            class="press h-10 shrink-0 rounded-xl px-3 text-callout font-semibold text-(--hud-link)"
            @click="runAction(t.id, t.action.run)"
          >
            {{ t.action.label }}
          </button>
          <button
            type="button"
            aria-label="Dismiss"
            class="press flex size-11 shrink-0 items-center justify-center rounded-full opacity-60 hover:opacity-100"
            @click="dismissToast(t.id)"
          >
            <X class="size-4" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
