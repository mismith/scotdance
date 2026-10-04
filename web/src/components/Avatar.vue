<script setup lang="ts">
import { ref, watch } from 'vue'
import { initialsOf } from '@/lib/format'

// A person as a circle: their photo, or their initials when there isn't one
// (or it won't load). A dancer you follow wears their colour; you yourself
// (MeAvatar) are filled, so you hold on a highlighted row.
const props = withDefaults(
  defineProps<{
    name: string
    image?: string | null
    /** A followed dancer's colour (see useFollowing). */
    color?: string | null
    size?: 'xs' | 'sm' | 'lg' | 'xl'
    you?: boolean
  }>(),
  { image: null, color: null, size: 'sm' },
)

const SIZE = { xs: 'size-8 text-xs', sm: 'size-10 text-sm', lg: 'size-16 text-xl', xl: 'size-24 text-[2rem]' }

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
    loading="lazy"
    decoding="async"
    alt=""
    :class="['bg-muted shrink-0 rounded-full object-cover', SIZE[size]]"
    @error="broken = true"
  />
  <span
    v-else
    :class="[
      'flex shrink-0 items-center justify-center rounded-full font-semibold tracking-[-0.01em]',
      SIZE[size],
      color ? 'sash text-on-dancer' : you ? 'bg-primary-fill text-primary-foreground' : 'bg-blue-paper text-primary',
    ]"
    :style="color ? { '--dc': color } : undefined"
    aria-hidden="true"
  >
    {{ initialsOf(name) }}
  </span>
</template>
