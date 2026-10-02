<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { canEdit, friendlyError } from '@/lib/admin/write'

// A labelled on/off switch that saves on tap. The whole row is the target.

const props = defineProps<{
  modelValue: boolean
  label: string
  description?: string
  save: (on: boolean) => unknown
  disabled?: boolean
}>()

const id = useId()
const busy = ref(false)
const error = ref<string | null>(null)
const locked = computed(() => props.disabled || !canEdit.value)

async function toggle() {
  if (locked.value || busy.value) return
  busy.value = true
  error.value = null
  try {
    await props.save(!props.modelValue)
  } catch (e) {
    error.value = friendlyError(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <button
      :id="id"
      type="button"
      role="switch"
      :aria-checked="modelValue"
      :aria-describedby="description ? `${id}-d` : undefined"
      :disabled="locked"
      class="flex w-full items-center gap-3 py-1 text-left disabled:cursor-not-allowed disabled:opacity-60"
      @click="toggle"
    >
      <span class="min-w-0 flex-1">
        <span class="block text-base font-bold">{{ label }}</span>
        <span v-if="description" :id="`${id}-d`" class="text-muted-foreground block text-sm">{{ description }}</span>
      </span>
      <span
        :class="[
          'relative h-7 w-12 shrink-0 rounded-full transition-colors after:absolute after:top-0.5 after:left-0.5 after:size-6 after:rounded-full after:bg-white after:shadow after:transition-transform',
          modelValue ? 'bg-primary-fill after:translate-x-5' : 'bg-strong',
          busy && 'opacity-70',
        ]"
        aria-hidden="true"
      />
    </button>
    <p v-if="error" class="text-destructive pt-1 text-sm font-semibold" role="alert">{{ error }}</p>
  </div>
</template>
