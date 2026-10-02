<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { ChevronDown } from '@lucide/vue'
import AdminField from '@/components/admin/AdminField.vue'
import SaveMark from '@/components/admin/SaveMark.vue'
import { canEdit, friendlyError } from '@/lib/admin/write'
import type { SelectOption } from '@/lib/admin/collection'

// A native picker (the phone's own wheel or list) that saves on choose.

const props = defineProps<{
  modelValue: string | null | undefined
  label: string
  options: SelectOption[]
  save: (value: string | null) => unknown
  hint?: string
  required?: boolean
  /** Label for the empty choice; omitted when required and already set. */
  placeholder?: string
  disabled?: boolean
  hideLabel?: boolean
}>()

const id = useId()
const status = ref<'idle' | 'saving' | 'saved'>('idle')
const error = ref<string | null>(null)
const locked = computed(() => props.disabled || !canEdit.value)

const current = computed(() => props.modelValue ?? '')
// A value that no longer matches any option (e.g. a deleted age group).
const orphan = computed(() => !!current.value && !props.options.some((o) => o.value === current.value))

const grouped = computed(() => {
  const groups = new Map<string, SelectOption[]>()
  for (const o of props.options) {
    const g = o.group ?? ''
    groups.set(g, [...(groups.get(g) ?? []), o])
  }
  return [...groups.entries()]
})

async function onChange(e: Event) {
  const value = (e.target as HTMLSelectElement).value || null
  error.value = null
  status.value = 'saving'
  try {
    await props.save(value)
    status.value = 'saved'
    setTimeout(() => (status.value = 'idle'), 1600)
  } catch (err) {
    status.value = 'idle'
    error.value = friendlyError(err)
    ;(e.target as HTMLSelectElement).value = current.value
  }
}
</script>

<template>
  <AdminField
    :label="label"
    :for="id"
    :hint="hint"
    :error="error ?? (orphan ? 'This no longer exists. Choose another.' : null)"
    :required="required"
    :hide-label="hideLabel"
  >
    <div class="relative">
      <select
        :id="id"
        :value="current"
        :disabled="locked"
        :aria-invalid="orphan || !!error || undefined"
        :class="[
          'h-12 w-full appearance-none rounded-xl pr-16 pl-3 text-base',
          locked ? 'bg-muted text-muted-foreground cursor-not-allowed shadow-[inset_0_0_0_1px_var(--border)]' : 'field',
        ]"
        @change="onChange"
      >
        <option v-if="!required || !current || orphan" value="">{{ placeholder ?? 'None' }}</option>
        <option v-if="orphan" :value="current" disabled>Missing</option>
        <template v-for="[group, opts] in grouped" :key="group">
          <optgroup v-if="group" :label="group">
            <option v-for="o in opts" :key="o.value" :value="o.value">{{ o.label }}</option>
          </optgroup>
          <template v-else>
            <option v-for="o in opts" :key="o.value" :value="o.value">{{ o.label }}</option>
          </template>
        </template>
      </select>
      <span class="text-muted-foreground pointer-events-none absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-1.5" aria-hidden="true">
        <SaveMark :status="status" />
        <ChevronDown class="size-4" />
      </span>
    </div>
  </AdminField>
</template>
