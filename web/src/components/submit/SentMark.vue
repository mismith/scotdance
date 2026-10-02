<script setup lang="ts">
import { onMounted, ref } from 'vue'

// Sent: a green circle that draws itself round, then its tick, once.
const drawn = ref(false)
onMounted(() => requestAnimationFrame(() => requestAnimationFrame(() => (drawn.value = true))))

const stroke = 'transition-[stroke-dashoffset] ease-standard motion-reduce:transition-none [stroke-dasharray:1]'
</script>

<template>
  <svg viewBox="0 0 56 56" fill="none" class="text-done-foreground" role="img" aria-label="Sent">
    <circle
      cx="28"
      cy="28"
      r="25"
      stroke="currentColor"
      stroke-width="3.5"
      pathLength="1"
      transform="rotate(-90 28 28)"
      :class="[stroke, 'duration-(--dur-slow)', drawn ? '[stroke-dashoffset:0]' : '[stroke-dashoffset:1]']"
    />
    <path
      d="M17 29l7.5 7.5L39 21"
      stroke="currentColor"
      stroke-width="4"
      stroke-linecap="round"
      stroke-linejoin="round"
      pathLength="1"
      :class="[stroke, 'duration-(--dur-base) delay-(--dur-slow)', drawn ? '[stroke-dashoffset:0]' : '[stroke-dashoffset:1]']"
    />
  </svg>
</template>
