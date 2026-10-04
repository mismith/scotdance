<script setup lang="ts">
import { useId } from 'vue'
import { ChevronDown } from '@lucide/vue'
import AdminField from '@/components/admin/AdminField.vue'
import type { SelectOption } from '@/lib/admin/collection'

// A plain form control (no autosave) for "add" forms that save on submit.

const model = defineModel<string>({ default: '' })

defineProps<{
  label: string
  kind?: 'text' | 'textarea' | 'select' | 'url' | 'email' | 'date' | 'datetime-local'
  options?: SelectOption[]
  hint?: string
  error?: string | null
  required?: boolean
  placeholder?: string
  inputmode?: 'text' | 'numeric' | 'url' | 'email'
  autocomplete?: string
}>()

const id = useId()
const base = 'field placeholder:text-muted-foreground w-full rounded-xl px-3 text-base'
</script>

<template>
  <AdminField v-slot="{ describedby }" :label="label" :for="id" :hint="hint" :error="error" :required="required">
    <textarea
      v-if="kind === 'textarea'"
      :id="id"
      v-model="model"
      :aria-invalid="!!error || undefined"
      :aria-required="required || undefined"
      :aria-describedby="describedby"
      rows="3"
      :placeholder="placeholder"
      :class="[base, 'min-h-24 py-2.5']"
    />
    <div v-else-if="kind === 'select'" class="relative">
      <select
        :id="id"
        v-model="model"
        :aria-invalid="!!error || undefined"
        :aria-required="required || undefined"
        :aria-describedby="describedby"
        :class="[base, 'h-12 appearance-none pr-10']"
      >
        <option value="">{{ placeholder ?? 'Choose…' }}</option>
        <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
      <ChevronDown class="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2" />
    </div>
    <input
      v-else
      :id="id"
      v-model="model"
      :aria-invalid="!!error || undefined"
      :aria-required="required || undefined"
      :aria-describedby="describedby"
      :type="kind === 'url' ? 'url' : kind === 'email' ? 'email' : kind === 'date' ? 'date' : kind === 'datetime-local' ? 'datetime-local' : 'text'"
      :inputmode="inputmode"
      :placeholder="placeholder"
      :autocomplete="autocomplete ?? 'off'"
      :class="[base, 'h-12']"
    />
  </AdminField>
</template>
