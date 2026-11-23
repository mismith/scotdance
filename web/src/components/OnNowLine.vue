<script setup lang="ts">
import { computed } from 'vue'
import Dialog from '@/components/Dialog.vue'
import { useMorph } from '@/lib/morph'

// On now (ADR 0020): the pink line across the top of the age group people say
// is dancing. It pulses gently, and its dot explains itself: who says so, how
// long ago, and (signed in) Yes, No or Not sure, since whoever taps it is
// probably looking at the platform right then.
const props = defineProps<{
  /** The age group, for screen readers: "Premier 12 & Under 14". */
  label: string
  /** When it was last confirmed (ms). */
  at: number
  now: number
  /** Signed in: only then can they answer. */
  canAnswer: boolean
}>()
const emit = defineEmits<{ answer: [vote: 'yes' | 'no'] }>()

const tip = useMorph()
const ago = computed(() => {
  const min = Math.max(0, Math.round((props.now - props.at) / 60_000))
  return min < 1 ? 'just now' : `${min} min ago`
})

function pick(vote: 'yes' | 'no' | null) {
  if (vote) emit('answer', vote)
  tip.hide()
}
</script>

<template>
  <span class="bg-live pointer-events-none absolute inset-x-0 -top-px z-10 h-0.5 rounded-full" aria-hidden="true" />
  <button
    type="button"
    :aria-label="`${label} is on now, say people here`"
    aria-haspopup="dialog"
    :aria-expanded="tip.open"
    class="press absolute -top-2.25 left-1.5 z-20 flex size-4.5 items-center justify-center rounded-full after:absolute after:-inset-3"
    @click.stop="tip.show($event)"
  >
    <span class="bg-live size-2.5 rounded-full animate-[live-pulse_2s_ease-out_infinite] motion-reduce:animate-none" />
  </button>
  <Teleport to="body">
    <Dialog :open="tip.open" :morph="tip" variant="dropdown" aria-label="On now" @close="tip.hide()">
      <div class="text-callout w-64 space-y-3 p-2.5 text-left leading-snug">
        <p>
          People here say this is where things are right now.
          <span class="text-muted-foreground block pt-1 text-sm">Last confirmed {{ ago }}.<template v-if="canAnswer"> Is that right?</template></span>
        </p>
        <div v-if="canAnswer" class="flex gap-1.5">
          <button type="button" class="press bg-live text-live-paper h-9 flex-1 rounded-full text-sm font-semibold" @click="pick('yes')">Yes</button>
          <button type="button" class="press border-foreground/15 h-9 flex-1 rounded-full border text-sm font-semibold" @click="pick('no')">No</button>
          <button type="button" class="press border-foreground/15 h-9 flex-1 rounded-full border text-sm font-semibold" @click="pick(null)">Not sure</button>
        </div>
      </div>
    </Dialog>
  </Teleport>
</template>
