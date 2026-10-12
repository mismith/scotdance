<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import Switch from '@/components/ui/Switch.vue'
import { useSharedSheet } from '@/composables/admin/useSharedParts'
import { canEdit, friendlyError } from '@/lib/admin/write'
import type { LinkPart } from '@/lib/linked'

// A labelled on/off switch that saves on tap. The whole row is the target.

const props = defineProps<{
  modelValue: boolean
  label: string
  description?: string
  save: (on: boolean) => unknown
  disabled?: boolean
  /** Shared from a linked main one: shown as it is, locked; tapping says why. */
  shared?: LinkPart
}>()
const sheet = useSharedSheet()

const id = useId()
const busy = ref(false)
const error = ref<string | null>(null)
const locked = computed(() => props.disabled || !canEdit.value)

function onRow(e: MouseEvent) {
  if (!props.shared) return
  e.preventDefault()
  sheet?.explain(props.shared, e)
}

async function toggle(on: boolean) {
  if (locked.value || busy.value) return
  busy.value = true
  error.value = null
  try {
    await props.save(on)
  } catch (e) {
    error.value = friendlyError(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <label :class="['flex min-h-11 items-center gap-3 py-1.5', locked && !shared ? 'cursor-not-allowed' : 'cursor-pointer']" @click="onRow">
      <span :class="['min-w-0 flex-1', locked && !shared && 'opacity-(--disabled-opacity)']">
        <span :id="`${id}-l`" class="block text-base font-medium">{{ label }}</span>
        <span v-if="description" :id="`${id}-d`" class="text-muted-foreground block text-sm whitespace-pre-line">{{ description }}</span>
      </span>
      <Switch
        :model-value="modelValue"
        :disabled="locked && !shared"
        :locked="!!shared"
        :busy="busy"
        :aria-labelledby="`${id}-l`"
        :aria-describedby="description ? `${id}-d` : undefined"
        @update:model-value="toggle"
      />
    </label>
    <p v-if="error" class="text-destructive pt-1 text-sm font-medium" role="alert">{{ error }}</p>
  </div>
</template>
