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
            'flex min-h-11 w-full flex-col gap-2 rounded-md pt-1 pb-1.5 text-left text-sm font-bold',
            i === current ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
          ]"
          @click="$emit('go', i)"
        >
          <span :class="['h-1.5 w-full rounded-full transition-colors', i <= current ? 'bg-primary-fill' : 'bg-border']" />
          <span class="block truncate"><span class="sr-only">Step {{ i + 1 }}: </span>{{ label }}</span>
        </button>
      </li>
    </ol>
  </nav>
</template>
