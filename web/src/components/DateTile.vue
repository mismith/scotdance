<script setup lang="ts">
import { computed } from 'vue'
import AdminMark from '@/components/AdminMark.vue'
import { formatMonthAbbrev, isSameDay, parseDate } from '@/lib/format'

// A competition's date as a little calendar page: month, day, and the
// weekday (upcoming) or year (history). What people scan lists for.
// `managed`: one you can manage, marked with the admin shield.
const props = withDefaults(
  defineProps<{ date?: number | string | null; below?: 'weekday' | 'year'; managed?: boolean }>(),
  { date: null, below: 'weekday', managed: false },
)
const d = computed(() => {
  const date = props.date ? parseDate(props.date) : null
  return date && !Number.isNaN(date.getTime()) ? date : null
})
const today = computed(() => isSameDay(props.date ?? undefined))
</script>

<template>
  <span
    :class="[
      'relative flex w-12 shrink-0 flex-col items-center justify-center rounded-xl py-1 leading-none',
      today ? 'bg-live-paper' : 'bg-muted',
    ]"
    :title="managed ? 'You can manage this' : undefined"
  >
    <template v-if="d">
      <span class="text-live text-[0.6875rem] font-extrabold uppercase">{{ formatMonthAbbrev(d) }}</span>
      <span class="text-xl font-extrabold tabular-nums">{{ d.getDate() }}</span>
      <span class="text-muted-foreground text-[0.6875rem] font-bold">
        {{ below === 'year' ? d.getFullYear() : d.toLocaleDateString(undefined, { weekday: 'short' }) }}
      </span>
    </template>
    <span v-else class="text-muted-foreground py-2 text-xs font-bold">TBA</span>
    <AdminMark v-if="managed" size="md" />
  </span>
</template>
