<script setup lang="ts">
import { ref } from 'vue'
import { CircleHelp } from '@lucide/vue'
import Dialog from '@/components/Dialog.vue'

// "4 steps" / "2+1 steps", tappable. Parents read "Highland Fling (4)" as four
// dancers or fourth place; this spells it out and explains it on tap.
const props = defineProps<{ steps: string | number | null | undefined; dance?: string }>()
const open = ref(false)
const text = String(props.steps ?? '').trim()
const plus = text.includes('+')
</script>

<template>
  <button
    v-if="text"
    type="button"
    class="bg-muted text-muted-foreground inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-sm font-bold"
    :aria-label="`${text} steps. What are steps?`"
    @click.stop.prevent="open = true"
  >
    {{ text }} steps <CircleHelp class="size-4" />
  </button>
  <Dialog :open="open" variant="sheet" @close="open = false">
    <template #header>
      <h2 class="text-title">What are steps?</h2>
    </template>
    <div class="space-y-3 p-4 pb-[calc(1.5rem+var(--safe-bottom))] text-base leading-relaxed">
      <p>
        Each dance is made of short sections called steps.
        <b>{{ text }} steps</b> means {{ dance ?? 'this dance' }} is danced with
        <template v-if="plus">{{ text.split('+')[0] }} slow steps, then {{ text.split('+')[1] }} quick.</template>
        <template v-else>{{ text }} of them.</template>
      </p>
      <p class="text-muted-foreground">
        It’s about the dance itself. It isn’t a placing or the number of dancers.
      </p>
      <button
        type="button"
        class="bg-primary text-primary-foreground h-12 w-full rounded-xl text-base font-bold"
        @click="open = false"
      >
        Got it
      </button>
    </div>
  </Dialog>
</template>
