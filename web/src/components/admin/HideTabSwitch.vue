<script setup lang="ts">
import { ref } from 'vue'
import { useHideTab, type HideableTab } from '@/composables/admin/useHideTab'
import { canEdit } from '@/lib/admin/write'

// "Hide the Schedule tab" or "Hide the Results tab": a compact switch for the
// top of the section, once it has something in it. (While it's empty, the
// empty state offers hiding instead of building.)

const props = defineProps<{ tab: HideableTab }>()
const t = useHideTab(props.tab)
const { hidden } = t

const busy = ref(false)
async function toggle() {
  if (busy.value) return
  busy.value = true
  try {
    await (hidden.value ? t.show() : t.hide())
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="hidden"
    :disabled="!canEdit"
    class="flex h-11 items-center gap-3 text-[0.9375rem] font-bold disabled:opacity-50"
    @click="toggle"
  >
    <span
      :class="[
        'relative h-7 w-12 shrink-0 rounded-full transition-colors after:absolute after:top-0.5 after:left-0.5 after:size-6 after:rounded-full after:bg-white after:shadow after:transition-transform',
        hidden ? 'bg-primary after:translate-x-5' : 'bg-strong',
        busy && 'opacity-70',
      ]"
      aria-hidden="true"
    />
    Hide the {{ t.name }} tab
  </button>
</template>
