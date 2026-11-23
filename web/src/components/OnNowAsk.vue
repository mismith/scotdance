<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'

// On now (ADR 0020): one question, asked once, in the same place every time
// (just above the tab bar): "Is Premier "C" on now?". Pink, as "now" is
// everywhere in the app. A bar drains while it waits; when it's empty the card
// folds away and nothing is said. After a Yes the card says what happened,
// with Undo.
export interface OnNowQuestion {
  /** Changes for each new question. */
  id: string
  label: string
  /** The dance and platform: "Sword Dance · Platform 1". */
  detail: string
}
const props = defineProps<{ question: OnNowQuestion | null }>()
// `done` once it has folded away, however it went.
const emit = defineEmits<{ answer: [vote: 'yes' | 'no']; undo: []; done: [] }>()

const ASK_MS = 8000
const SAID_MS = 5000

const shown = ref<OnNowQuestion | null>(null)
const phase = ref<'ask' | 'yes' | 'no'>('ask')
const draining = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

function fold() {
  clearTimeout(timer)
  if (shown.value) emit('done')
  shown.value = null
}
function wait(ms: number) {
  clearTimeout(timer)
  timer = setTimeout(fold, ms)
}

watch(
  () => props.question,
  (q) => {
    // Once answered, the card finishes saying so whatever happens to the question.
    if (!q) return phase.value === 'ask' ? fold() : undefined
    if (q.id === shown.value?.id) return
    shown.value = q
    phase.value = 'ask'
    draining.value = false
    // Start full, then drain over the wait.
    requestAnimationFrame(() => requestAnimationFrame(() => (draining.value = true)))
    wait(ASK_MS)
  },
  { immediate: true },
)
onBeforeUnmount(() => clearTimeout(timer))

function answer(vote: 'yes' | 'no' | null) {
  if (!vote) return fold()
  emit('answer', vote)
  phase.value = vote
  wait(vote === 'yes' ? SAID_MS : 1500)
}
function undo() {
  emit('undo')
  fold()
}
</script>

<template>
  <Teleport to="body">
    <div role="status" aria-live="polite">
      <Transition
        enter-active-class="transition duration-(--dur-slow) ease-snappy motion-reduce:transition-none"
        enter-from-class="translate-y-4 opacity-0"
        leave-active-class="transition duration-(--dur-base) ease-exit motion-reduce:transition-none"
        leave-to-class="translate-y-4 opacity-0"
      >
        <div v-if="shown" class="fixed inset-x-chrome-4 bottom-(--notice-bottom) z-40 mx-auto max-w-lg">
          <div class="bg-live-paper border-live/40 overflow-hidden rounded-[1.375rem] border shadow-[0_12px_32px_-8px_rgb(0_0_0/0.45)]">
            <div v-if="phase === 'ask'" class="space-y-2.5 px-4 pt-3 pb-3.5">
              <p class="leading-snug">
                <span class="block font-semibold">Is {{ shown.label }} on now?</span>
                <span class="text-muted-foreground block text-sm">{{ shown.detail }}</span>
              </p>
              <div class="flex gap-1.5">
                <button type="button" class="press bg-live text-live-paper h-10 flex-1 rounded-full text-sm font-semibold" @click="answer('yes')">Yes</button>
                <button type="button" class="press border-live/40 h-10 flex-1 rounded-full border text-sm font-semibold" @click="answer('no')">No</button>
                <button type="button" class="press border-live/40 h-10 flex-1 rounded-full border text-sm font-semibold" @click="answer(null)">Not sure</button>
              </div>
            </div>
            <div v-else class="flex min-h-14 items-center justify-between gap-3 py-2 pr-2 pl-4">
              <p class="text-callout font-semibold">{{ phase === 'yes' ? `${shown.label} is on now` : 'Thanks' }}</p>
              <button v-if="phase === 'yes'" type="button" class="press text-live h-10 rounded-full px-3 text-sm font-semibold" @click="undo">Undo</button>
            </div>
            <div v-if="phase === 'ask'" class="bg-live/15 h-1" aria-hidden="true">
              <div
                class="bg-live h-full origin-left ease-linear motion-reduce:hidden"
                :class="draining ? 'scale-x-0 transition-transform duration-[8000ms]' : 'scale-x-100'"
              />
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </Teleport>
</template>
