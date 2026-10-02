<script setup lang="ts">
import { Check, LoaderCircle } from '@lucide/vue'

// Inside a field that saves itself: a spinner while it saves, then a tick
// that pops in and fades away.
defineProps<{ status: 'idle' | 'saving' | 'saved' | string }>()
</script>

<template>
  <Transition
    mode="out-in"
    enter-active-class="transition-[scale,opacity] duration-(--dur-slow) ease-elastic motion-reduce:transition-opacity motion-reduce:ease-standard"
    enter-from-class="scale-40 opacity-0 motion-reduce:scale-100"
    leave-active-class="transition-opacity duration-(--dur-quick) ease-exit"
    leave-to-class="opacity-0"
  >
    <LoaderCircle v-if="status === 'saving'" class="size-4 animate-spin" />
    <Check v-else-if="status === 'saved'" class="text-done-foreground size-4" stroke-width="2.5" />
  </Transition>
</template>
