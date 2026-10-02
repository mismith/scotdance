<script setup lang="ts">
// How much of something has results, said quietly: a check when it's all
// in, "2 of 6" part way, nothing before. Status only speaks when it's news,
// so the check draws itself in when the last result arrives while you watch
// (not every time a page opens).
defineProps<{ posted: number; total: number }>()
</script>

<template>
  <Transition
    mode="out-in"
    enter-active-class="[&_path]:transition-[stroke-dashoffset] [&_path]:duration-(--dur-slow) [&_path]:ease-standard motion-reduce:[&_path]:transition-none"
    enter-from-class="[&_path]:[stroke-dashoffset:1]"
  >
    <span v-if="total && posted >= total" key="in" class="text-done-foreground flex size-6 shrink-0 items-center justify-center">
      <svg viewBox="0 0 24 24" class="size-5" fill="none" aria-hidden="true">
        <path
          d="M20 6 9 17l-5-5"
          stroke="currentColor"
          stroke-width="3"
          stroke-linecap="round"
          stroke-linejoin="round"
          pathLength="1"
          class="[stroke-dasharray:1]"
        />
      </svg>
      <span class="sr-only">Results in</span>
    </span>
    <span
      v-else-if="posted > 0"
      key="part"
      class="text-muted-foreground shrink-0 text-sm font-medium whitespace-nowrap tabular-nums"
    >
      {{ posted }} of {{ total }}
    </span>
  </Transition>
</template>
