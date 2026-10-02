<script setup lang="ts">
import { ref, watch } from 'vue'
import { initialsOf } from '@/lib/format'

// A person as a circle: their photo, or their initials when there isn't one
// (or it won't load). A dancer you follow wears their colour.
const props = withDefaults(
  defineProps<{
    name: string
    image?: string | null
    /** A followed dancer's colour (see useFollowing). */
    color?: string | null
    size?: 'sm' | 'lg'
  }>(),
  { image: null, color: null, size: 'sm' },
)

const broken = ref(false)
watch(
  () => props.image,
  () => (broken.value = false),
)
</script>

<template>
  <img
    v-if="image && !broken"
    :src="image"
    alt=""
    :class="['bg-muted shrink-0 rounded-full object-cover', size === 'lg' ? 'size-16' : 'size-10']"
    @error="broken = true"
  />
  <span
    v-else
    :class="[
      'flex shrink-0 items-center justify-center rounded-full font-semibold tracking-[-0.01em]',
      size === 'lg' ? 'size-16 text-xl' : 'size-10 text-sm',
      color ? 'sash text-on-dancer' : 'bg-blue-paper text-primary',
    ]"
    :style="color ? { '--dc': color } : undefined"
    aria-hidden="true"
  >
    {{ initialsOf(name) }}
  </span>
</template>
