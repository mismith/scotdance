<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { initialsOf } from '@/lib/format'
import { clothInk, isCloth } from '@/lib/tartan'
import { inkOnLook } from '@/stores/dancerColors'

// A person as a circle: their photo, or their initials when there isn't one
// (or it won't load). A dancer you follow wears their look, a colour or a
// tartan; you yourself (MeAvatar) are filled, so you hold on a highlighted row.
const props = withDefaults(
  defineProps<{
    name: string
    image?: string | null
    /** A followed dancer's look, as a CSS background (see useFollowing's colorFor). */
    color?: string | null
    size?: 'xs' | 'sm' | 'lg' | 'xl'
    you?: boolean
  }>(),
  { image: null, color: null, size: 'sm' },
)

const SIZE = { xs: 'size-8 text-xs', sm: 'size-10 text-sm', lg: 'size-16 text-xl', xl: 'size-24 text-[2rem]' }

// Initials in the colour's own ink; on a tartan, white (or ink, on light
// cloth) with a soft halo that keeps them legible over every stripe.
const ink = computed(() => {
  if (!props.color) return undefined
  if (!isCloth(props.color)) return { color: inkOnLook(props.color) ?? undefined }
  const { ink, halo } = clothInk(props.color)
  return { color: ink, textShadow: `0 0 2px ${halo}, 0 1px 4px ${halo}` }
})

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
      color
        ? 'sash'
        : you
          ? 'bg-primary-fill text-primary-foreground'
          : 'bg-blue-paper text-primary',
    ]"
    :style="color ? { '--dc': color, ...ink } : undefined"
    aria-hidden="true"
  >
    {{ initialsOf(name) }}
  </span>
</template>
