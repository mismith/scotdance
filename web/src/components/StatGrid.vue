<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import SectionHeader from '@/components/SectionHeader.vue'
import Skeleton from '@/components/Skeleton.vue'

interface Stat {
  label: string
  value: string | number | null | undefined
  to?: RouteLocationRaw
}

const props = withDefaults(
  defineProps<{
    stats: Stat[]
    header?: string
    cols?: 1 | 2 | 3
    loading?: boolean
  }>(),
  { header: undefined, cols: undefined, loading: false },
)

const colCount = computed<1 | 2 | 3>(() => {
  if (props.cols) return props.cols
  const n = props.stats.length
  if (n <= 1) return 1
  if (n === 2) return 2
  if (n === 3) return 3
  return 2
})

const rows = computed<Stat[][]>(() => {
  const c = colCount.value
  const out: Stat[][] = []
  for (let i = 0; i < props.stats.length; i += c) {
    out.push(props.stats.slice(i, i + c))
  }
  return out
})

function display(value: Stat['value']): string {
  if (value == null || value === '' || value === 0 || value === '0') return '—'
  return String(value)
}
</script>

<template>
  <div class="space-y-2">
    <SectionHeader v-if="header" :label="header" />
    <div
      v-for="(row, rowIdx) in rows"
      :key="rowIdx"
      :class="[
        'divide-border grid divide-x',
        row.length === 1 && 'grid-cols-1',
        row.length === 2 && 'grid-cols-2',
        row.length === 3 && 'grid-cols-3',
        rowIdx > 0 && 'border-border border-t',
      ]"
    >
      <component
        :is="stat.to ? RouterLink : 'div'"
        v-for="stat in row"
        :key="stat.label"
        :to="stat.to"
        class="flex flex-col items-center gap-2 px-3 py-4"
      >
        <div class="text-4xl leading-none font-medium tracking-tight tabular-nums">
          <Skeleton v-if="loading" class="h-9 w-10" />
          <template v-else>{{ display(stat.value) }}</template>
        </div>
        <div class="text-foreground/65 text-xs text-eyebrow">
          {{ stat.label }}
        </div>
      </component>
    </div>
  </div>
</template>
