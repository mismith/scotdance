<script setup lang="ts">
import { ClipboardList } from '@lucide/vue'
import SheetGlyph from '@/components/SheetGlyph.vue'
import { pageCount } from '@/lib/sheets'

// Under a dance's placings, once the organiser has added the judges' sheet:
// opens it in the viewer. The picture on the right is a drawing of a sheet,
// not the sheet, so a results page never downloads one until it's opened.
defineProps<{ pages: number }>()
const emit = defineEmits<{ open: [] }>()
</script>

<template>
  <button
    type="button"
    aria-haspopup="dialog"
    class="press-row focus-inset flex w-full items-center gap-3 px-4 py-3 text-left"
    @click="emit('open')"
  >
    <ClipboardList class="text-primary size-5 shrink-0" />
    <span class="min-w-0 flex-1">
      <span class="block text-base font-semibold">Judges’ sheet</span>
      <span class="text-muted-foreground block text-sm">
        {{ ['How each judge placed the dancers', pageCount(pages)].filter(Boolean).join(' · ') }}
      </span>
    </span>
    <SheetGlyph :pages="pages" />
  </button>
</template>
