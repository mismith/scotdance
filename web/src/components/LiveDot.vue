<script setup lang="ts">
// The one live mark: a hot pink dot beside the word "Live", once per screen.
// It pulses only while results are arriving, never just because it's the day.
defineProps<{ pulse?: boolean }>()
</script>

<template>
  <span
    :class="[
      'bg-live inline-block size-2 shrink-0 rounded-full',
      pulse && 'animate-[live-pulse_2.4s_ease-out_infinite] motion-reduce:animate-none',
    ]"
    aria-hidden="true"
  />
</template>
