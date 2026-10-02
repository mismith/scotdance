<script setup lang="ts">
import { Info } from '@lucide/vue'
import Dialog from '@/components/Dialog.vue'
import { useMorph } from '@/lib/morph'

// A quiet (i) that explains something in place. It opens a small panel that
// grows out of it, like the ⋯ menus; tap anywhere else or press Escape to
// close.

defineProps<{ label?: string }>()

const tip = useMorph()
</script>

<template>
  <button
    type="button"
    :aria-label="label ?? 'More about this'"
    aria-haspopup="dialog"
    :aria-expanded="tip.open"
    class="press text-muted-foreground hover:text-foreground relative inline-flex size-6 shrink-0 items-center justify-center rounded-full align-middle after:absolute after:-inset-2.5"
    @click.stop="tip.show($event)"
  >
    <Info class="size-4.5" />
  </button>
  <!-- Out of the page's tree: a tip can sit inside another control (a tab),
       and taps in it mustn't reach that. -->
  <Teleport to="body">
    <Dialog :open="tip.open" :morph="tip" variant="dropdown" :aria-label="label ?? 'More about this'" @close="tip.hide()">
      <div class="text-callout p-2.5 text-left leading-snug">
        <slot />
      </div>
    </Dialog>
  </Teleport>
</template>
