<script setup lang="ts">
// The steps, as buttons to jump between them. Whoever listens decides
// whether a jump forward can go all the way.

defineProps<{ steps: string[]; current: number }>()
defineEmits<{ go: [step: number] }>()
</script>

<template>
  <nav aria-label="Steps">
    <ol class="flex gap-1.5">
      <li v-for="(label, i) in steps" :key="label" class="min-w-0 flex-1">
        <button
          type="button"
          :aria-current="i === current ? 'step' : undefined"
          :class="[
            'press flex min-h-11 w-full flex-col gap-2 rounded-md pt-1 pb-1.5 text-left text-sm font-semibold',
            i === current ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
          ]"
          @click="$emit('go', i)"
        >
          <!-- The bar fills from the left as you reach its step. -->
          <span class="bg-border block h-1.5 w-full overflow-hidden rounded-full">
            <span
              :class="[
                'bg-primary-fill block h-full origin-left rounded-full transition-transform duration-(--dur-slow) ease-snappy motion-reduce:transition-none',
                i <= current ? 'scale-x-100' : 'scale-x-0',
              ]"
            />
          </span>
          <span class="block truncate"><span class="sr-only">Step {{ i + 1 }}: </span>{{ label }}</span>
        </button>
      </li>
    </ol>
  </nav>
</template>
