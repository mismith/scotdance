<script setup lang="ts">
import { computed } from 'vue'
import { wordDiff, type DiffPart } from '@/lib/admin/venueMerge'

// Text with the words that differ from `reference` marked, and a caret where
// words of the reference are missing: a venue as typed against Google's.
// With no text, `empty` stands in (marked when the reference has some).
// `carets: false` leaves out the missing-word marks (for addresses, where
// they say little).
const props = withDefaults(defineProps<{ text?: string | null; reference?: string | null; empty: string; carets?: boolean }>(), { text: null, reference: null, carets: true })
const parts = computed<DiffPart[]>(() =>
  props.text?.trim()
    ? wordDiff(props.text, props.reference).filter((p) => props.carets || p.kind !== 'missing')
    : [{ text: props.empty, kind: props.reference?.trim() ? 'diff' : 'same' }],
)
</script>

<template>
  <span
    ><template v-for="(p, i) in parts" :key="i"
      >{{ i ? ' ' : '' }}<mark v-if="p.kind === 'diff'" class="bg-next text-next-foreground rounded px-0.5">{{ p.text }}</mark
      ><span v-else-if="p.kind === 'missing'" class="text-next-foreground font-bold" :title="`Missing: ${p.text}`"
        >‸<span class="sr-only"> (missing {{ p.text }})</span></span
      ><template v-else>{{ p.text }}</template></template
    ></span
  >
</template>
