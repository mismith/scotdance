<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    name?: string | null
    image?: string | null
    /** Renders the chip in the secondary (favourite) color treatment. */
    favorite?: boolean
  }>(),
  {
    name: '',
    image: null,
    favorite: false,
  },
)

const mark = computed(() => (props.name ?? '').trim().charAt(0).toUpperCase() || '?')
</script>

<template>
  <div
    :class="[
      '@container relative flex shrink-0 items-center justify-center overflow-hidden',
      favorite
        ? 'bg-secondary text-secondary-foreground'
        : 'bg-primary text-primary-foreground',
    ]"
  >
    <img
      v-if="image"
      :src="image"
      :alt="name ?? ''"
      class="absolute inset-0 size-full object-cover"
    />
    <template v-else>
      <div
        class="absolute inset-0"
        style="background-image: radial-gradient(70% 60% at 30% 20%, rgba(255, 255, 255, 0.18) 0%, transparent 70%);"
      />
      <span class="relative font-medium leading-none" style="font-size: 42cqw">
        {{ mark }}
      </span>
    </template>
  </div>
</template>
