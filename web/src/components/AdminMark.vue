<script setup lang="ts">
import { Shield } from '@lucide/vue'

// The mark for organisers and admins: what only they see, and the
// competitions they're an admin of. An outlined shield on a little disc at
// the bottom right of an icon or date tile (whose wrapper is `relative`), the
// disc in the colour it sits on (`ring`) so it stands apart from what it
// overlaps.
withDefaults(
  defineProps<{
    size?: 'sm' | 'md'
    ring?: 'card' | 'background' | 'raised' | 'blue-paper'
  }>(),
  { size: 'sm', ring: 'card' },
)
</script>

<template>
  <span
    :class="[
      'pointer-events-none absolute flex items-center justify-center rounded-full',
      size === 'md' ? '-right-2 -bottom-2 size-5' : '-right-1.5 -bottom-1.5 size-4',
      ring === 'background'
        ? 'bg-background'
        : ring === 'raised'
          ? 'bg-raised'
          : ring === 'blue-paper'
            ? 'bg-blue-paper'
            : 'bg-card',
    ]"
    aria-hidden="true"
  >
    <Shield
      :class="['text-primary', size === 'md' ? 'size-3.5' : 'size-3']"
      :stroke-width="2.5"
    />
  </span>
</template>
