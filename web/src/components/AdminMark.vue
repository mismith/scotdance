<script setup lang="ts">
import { Shield } from '@lucide/vue'

// The mark for organisers and admins: what only they see, and the
// competitions they can manage. A small solid shield at the bottom right of
// an icon or date tile (whose wrapper is `relative`), outlined in the colour
// it sits on (`ring`) so it stands apart from what it overlaps.
withDefaults(defineProps<{ size?: 'sm' | 'md'; ring?: 'card' | 'background' | 'raised' | 'blue-paper' }>(), { size: 'sm', ring: 'card' })
</script>

<template>
  <Shield
    :class="[
      'fill-primary pointer-events-none absolute',
      size === 'md' ? '-right-2 -bottom-2 size-6' : '-right-1.5 -bottom-1.5 size-4',
      ring === 'background' ? 'text-background' : ring === 'raised' ? 'text-raised' : ring === 'blue-paper' ? 'text-blue-paper' : 'text-card',
    ]"
    :stroke-width="3"
    aria-hidden="true"
  />
</template>
