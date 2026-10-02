<script setup lang="ts">
import { grow, shrink } from '@/lib/admin/motion'

// A list whose items glide to their new places, grow in as they're added and
// fold away as they go. `still` holds it all: while something's dragged (the
// drag moves things itself) or while a search swaps the whole list.
const props = withDefaults(defineProps<{ tag?: string; still?: boolean }>(), { tag: 'ul' })

const enter = (el: Element, done: () => void) => (props.still ? done() : grow(el, done))
const leave = (el: Element, done: () => void) => (props.still ? done() : shrink(el, done))
</script>

<template>
  <TransitionGroup
    :tag="tag"
    :css="false"
    :move-class="still ? undefined : 'transition-transform duration-(--dur-slow) ease-snappy motion-reduce:transition-none'"
    @enter="enter"
    @leave="leave"
  >
    <slot />
  </TransitionGroup>
</template>
