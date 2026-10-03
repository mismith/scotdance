<script setup lang="ts" generic="T extends string">
import { computed, type Component } from 'vue'
import { Check, ChevronDown } from '@lucide/vue'
import Dialog from '@/components/Dialog.vue'
import { useMorph } from '@/lib/morph'
import { selectionHaptic } from '@/lib/haptics'

// A pill showing the current choice, like the location pill beside it; it
// grows a small menu of the choices, just under it, with a check on the
// current one.
const model = defineModel<T>({ required: true })
const props = defineProps<{
  options: ReadonlyArray<{ value: T; label: string; hint: string; icon: Component }>
  /** Names the choice, for screen readers ("Which competitions"). */
  label: string
}>()
const menu = useMorph()

const current = computed(() => props.options.find((o) => o.value === model.value) ?? props.options[0]!)

function pick(value: T) {
  if (value !== model.value) selectionHaptic()
  model.value = value
  menu.hide()
}
</script>

<template>
  <button
    type="button"
    class="press surface flex h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-callout font-semibold"
    :aria-label="`${label}: ${current.label}`"
    aria-haspopup="dialog"
    :aria-expanded="menu.open"
    @click="menu.show($event)"
  >
    <component :is="current.icon" class="text-primary size-[1.125rem]" aria-hidden="true" />
    {{ current.label }}
    <ChevronDown class="text-muted-foreground size-4" aria-hidden="true" />
  </button>

  <Dialog :open="menu.open" :morph="menu" variant="dropdown" :aria-label="label" @close="menu.hide()">
    <ul role="radiogroup" :aria-label="label">
      <li v-for="o in options" :key="o.value">
        <button
          type="button"
          role="radio"
          :aria-checked="model === o.value"
          class="press-row focus-inset flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-base font-medium"
          @click="pick(o.value)"
        >
          <component :is="o.icon" class="text-muted-foreground size-5 shrink-0" aria-hidden="true" />
          <span class="min-w-0 flex-1">
            {{ o.label }}
            <span class="text-muted-foreground block text-sm font-normal">{{ o.hint }}</span>
          </span>
          <Check v-if="model === o.value" class="text-primary size-5 shrink-0" stroke-width="2.5" aria-hidden="true" />
        </button>
      </li>
    </ul>
  </Dialog>
</template>
