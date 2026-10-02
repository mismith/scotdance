<script setup lang="ts">
import { computed } from 'vue'
import AdminMark from '@/components/AdminMark.vue'
import { formatMonthAbbrev, isSameDay, parseDate } from '@/lib/format'

// A competition's date as a little calendar page: month, day, and the
// weekday (upcoming) or year (history). What people scan lists for. Quiet
// by default; pink only while it's on (`today`, which defaults to its date
// being today). `managed`: one you can manage, marked with the admin shield.
const props = withDefaults(
  defineProps<{ date?: number | string | null; below?: 'weekday' | 'year'; managed?: boolean; today?: boolean }>(),
  { date: null, below: 'weekday', managed: false, today: undefined },
)
const d = computed(() => {
  const date = props.date ? parseDate(props.date) : null
  return date && !Number.isNaN(date.getTime()) ? date : null
})
const today = computed(() => props.today ?? isSameDay(props.date ?? undefined))
</script>

<template>
  <span
    :class="[
      'relative flex w-11 shrink-0 flex-col items-center justify-center gap-px rounded-xl py-1.5 leading-none',
      today ? 'bg-live-paper' : 'bg-muted',
    ]"
    :title="managed ? 'You can manage this' : undefined"
  >
    <template v-if="d">
      <span :class="['text-xs font-semibold uppercase', today ? 'text-live' : 'text-muted-foreground']">
        {{ formatMonthAbbrev(d) }}
      </span>
      <span class="text-xl font-extrabold tabular-nums">{{ d.getDate() }}</span>
      <span class="text-muted-foreground text-xs">
        {{ below === 'year' ? d.getFullYear() : d.toLocaleDateString(undefined, { weekday: 'short' }) }}
      </span>
    </template>
    <span v-else class="text-muted-foreground py-2 text-xs font-semibold">TBA</span>
    <AdminMark v-if="managed" size="md" />
  </span>
</template>
