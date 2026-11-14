<script setup lang="ts">
import { computed } from 'vue'
import { useAvatar } from '@/lib/avatar'
import { initialsOf, nameHue } from '@/lib/format'
import { clothInk, isCloth } from '@/lib/tartan'
import { inkOnLook } from '@/stores/dancerColors'

// A person as a circle: their photo, or their initials when there isn't one
// (or it won't load). A dancer you follow wears their look, a colour or a
// tartan; you yourself (MeAvatar) are filled, so you hold on a highlighted row.
// Judges and pipers can wear a soft colour of their own, from their name, as
// they do among a competition's staff (StaffAvatar). Never a dancer: colour
// on a dancer means yours.
const props = withDefaults(
  defineProps<{
    name: string
    email?: string | null
    image?: string | null
    /** A followed dancer's look, as a CSS background (see useFollowing's colorFor). */
    color?: string | null
    size?: 'xs' | 'sm' | 'lg' | 'xl'
    you?: boolean
    /** A person who isn't a dancer: initials on a soft colour of their own. */
    tinted?: boolean
  }>(),
  { email: null, image: null, color: null, size: 'sm' },
)

const SIZE = {
  xs: 'size-8 text-xs',
  sm: 'size-10 text-sm',
  lg: 'size-16 text-xl',
  xl: 'size-24 text-[2rem]',
}

// Initials in the colour's own ink; on a tartan, white (or ink, on light
// cloth) with a soft halo that keeps them legible over every stripe.
const ink = computed(() => {
  if (!props.color) return undefined
  if (!isCloth(props.color)) return { color: inkOnLook(props.color) ?? undefined }
  const { ink, halo } = clothInk(props.color)
  return { color: ink, textShadow: `0 0 2px ${halo}, 0 1px 4px ${halo}` }
})

const { image: photo, onError } = useAvatar(() => props)
</script>

<template>
  <img
    v-if="photo"
    :key="photo"
    :src="photo"
    referrerpolicy="no-referrer"
    loading="lazy"
    decoding="async"
    alt=""
    :class="['bg-muted shrink-0 rounded-full object-cover', SIZE[size]]"
    @error="onError"
  />
  <span
    v-else
    :class="[
      'flex shrink-0 items-center justify-center rounded-full tracking-[-0.01em]',
      SIZE[size],
      tinted && !color && !you ? 'font-bold' : 'font-semibold',
      color
        ? 'sash'
        : you
          ? 'bg-primary-fill text-primary-foreground'
          : tinted
            ? 'bg-[oklch(0.93_0.05_var(--h))] text-[oklch(0.45_0.13_var(--h))] dark:bg-[oklch(0.34_0.06_var(--h))] dark:text-[oklch(0.88_0.08_var(--h))]'
            : 'bg-blue-paper text-primary',
    ]"
    :style="
      color ? { '--dc': color, ...ink } : tinted ? { '--h': nameHue(name) } : undefined
    "
    aria-hidden="true"
  >
    {{ initialsOf(name) }}
  </span>
</template>
