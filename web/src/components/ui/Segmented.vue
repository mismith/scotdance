<script setup lang="ts" generic="T extends string | number">
import { computed } from 'vue'
import { selectionHaptic } from '@/lib/haptics'

// The one segmented control: equal segments in a soft track, with a thumb
// that slides to the chosen one like the tab bar's capsule. Buttons with
// aria-pressed, in a labelled group.
const model = defineModel<T>({ required: true })
const props = withDefaults(
  defineProps<{
    options: ReadonlyArray<{ value: T; label: string }>
    label: string
    size?: 'md' | 'lg'
  }>(),
  { size: 'md' },
)

const index = computed(() => Math.max(0, props.options.findIndex((o) => o.value === model.value)))

function pick(v: T) {
  if (v === model.value) return
  model.value = v
  selectionHaptic()
}
</script>

<template>
  <div
    role="group"
    :aria-label="label"
    class="relative grid rounded-full bg-[color-mix(in_oklab,var(--foreground)_6%,transparent)] p-1"
    :style="{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }"
  >
    <span
      class="surface-raised pointer-events-none absolute inset-y-1 left-1 rounded-full transition-transform duration-(--dur-slow) ease-elastic motion-reduce:transition-none"
      :style="{ width: `calc((100% - 0.5rem) / ${options.length})`, transform: `translateX(${index * 100}%)` }"
      aria-hidden="true"
    />
    <button
      v-for="o in options"
      :key="String(o.value)"
      type="button"
      :aria-pressed="o.value === model"
      :class="[
        'press relative z-1 rounded-full px-3 font-semibold transition-colors',
        size === 'lg' ? 'h-11 text-base' : 'h-9 text-callout',
        o.value === model ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
      ]"
      @click="pick(o.value)"
    >
      {{ o.label }}
    </button>
  </div>
</template>
