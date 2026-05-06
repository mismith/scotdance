<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    name?: string | null
    image?: string | null
    size?: number
    radius?: number
  }>(),
  {
    name: '',
    image: null,
    size: 48,
    radius: 12,
  },
)

const mark = computed(() => (props.name ?? '').trim().charAt(0).toUpperCase() || '?')
const fontSize = computed(() => Math.round(props.size * 0.42))
</script>

<template>
  <div
    :style="{ width: `${size}px`, height: `${size}px`, borderRadius: `${radius}px` }"
    class="text-primary-foreground relative flex shrink-0 items-center justify-center overflow-hidden"
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
        style="
          background-image: linear-gradient(
            135deg,
            color-mix(in oklch, var(--primary) 80%, black) 0%,
            var(--primary) 100%
          );
        "
      />
      <div
        class="absolute inset-0"
        style="
          background-image: radial-gradient(
            70% 60% at 30% 20%,
            rgba(255, 255, 255, 0.18) 0%,
            transparent 70%
          );
        "
      />
      <span
        class="font-serif relative font-medium leading-none"
        :style="{ fontSize: `${fontSize}px` }"
      >
        {{ mark }}
      </span>
    </template>
  </div>
</template>
