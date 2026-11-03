<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

// One picture in a What's new slide. The one showing drifts a touch closer
// while it's on; the others wait off to the side they'll come from (or went
// to), so stepping either way slides the right way. Children can play their
// own entrance with `group-data-on:`.
const props = defineProps<{ index: number; shot: number }>()

// A frame late, so a slide's first picture comes in rather than just being there.
const ready = ref(false)
onMounted(() => requestAnimationFrame(() => (ready.value = true)))
const on = computed(() => ready.value && props.index === props.shot)

const style = computed(() => {
  if (on.value)
    return {
      opacity: 1,
      scale: '1.03',
      transition: 'opacity 500ms var(--ease-standard), scale 3200ms cubic-bezier(0.15, 0.7, 0.3, 1), translate 600ms var(--ease-push)',
    }
  return {
    opacity: 0,
    scale: '0.88',
    translate: `${props.index < props.shot ? -48 : props.index === props.shot ? 0 : 48}px 0`,
    transition: 'opacity 350ms var(--ease-exit), scale 600ms var(--ease-standard), translate 600ms var(--ease-standard)',
  }
})
</script>

<template>
  <div
    :data-on="on || undefined"
    :aria-hidden="!on || undefined"
    :class="['group absolute inset-0 flex items-center justify-center motion-reduce:scale-100! motion-reduce:translate-none!', !on && 'pointer-events-none']"
    :style="style"
  >
    <slot />
  </div>
</template>
