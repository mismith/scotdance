<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { Check, ChevronRight, Download, Trophy } from '@lucide/vue'
import EmptyState from '@/components/EmptyState.vue'
import MasterDetail from '@/components/admin/MasterDetail.vue'
import ResultsEntry from '@/components/admin/ResultsEntry.vue'
import SwitchField from '@/components/admin/SwitchField.vue'
import { useManagedCompetition, type MGroup } from '@/composables/admin/useManagedCompetition'
import { useSplit } from '@/composables/admin/useWide'
import { confirm, toast } from '@/lib/admin/feedback'
import { CALLBACKS, OVERALL, danceState, parsePlacings, placeAt } from '@/lib/admin/results'

const route = useRoute()
const m = useManagedCompetition()
const split = useSplit()

const groupId = computed(() => (route.params.groupId ? String(route.params.groupId) : null))
const danceId = computed(() => (route.params.danceId ? String(route.params.danceId) : CALLBACKS))

const hasOverall = (g: MGroup) => !!g.category?.name && !g.category.name.trim().toLowerCase().startsWith('primary')
const danceIds = (g: MGroup) => [CALLBACKS, ...m.groupDances(g.id).map((d) => d.id), ...(hasOverall(g) ? [OVERALL] : [])]

function progress(g: MGroup) {
  const ids = danceIds(g)
  const done = ids.filter((id) => danceState(m.results.value[g.id]?.[id]) !== 'todo').length
  return { done, total: ids.length }
}

// The next dance still to enter, so tapping a group lands where you need to be.
function firstTodo(g: MGroup) {
  return danceIds(g).find((id) => danceState(m.results.value[g.id]?.[id]) === 'todo') ?? CALLBACKS
}

const sections = computed(() => {
  const byCategory = new Map<string, MGroup[]>()
  for (const g of m.groups.value) {
    const key = g.category?.label ?? 'No category'
    byCategory.set(key, [...(byCategory.get(key) ?? []), g])
  }
  return [...byCategory.entries()]
})

const totals = computed(() => {
  let done = 0
  let total = 0
  for (const g of m.groups.value) {
    const p = progress(g)
    done += p.done
    total += p.total
  }
  return { done, total }
})

async function setHidden(hidden: boolean) {
  if (hidden) {
    const hasAny = Object.keys(m.results.value).length > 0
    const ok = await confirm({
      title: 'Hide the Results tab?',
      message: hasAny ? 'All results entered so far are deleted, and the tab disappears from the competition page.' : 'The tab disappears from the competition page.',
      confirmLabel: 'Hide results',
      destructive: hasAny,
    })
    if (!ok) return
    const before = m.raw.value.results ?? null
    await m.writeData({ results: false })
    toast('Results tab hidden', { action: { label: 'Undo', run: () => m.writeData({ results: before }) } })
  } else {
    await m.writeData({ results: null })
  }
}

// A spreadsheet of every placing, for the organisers' records.
function exportCsv() {
  const rows: string[][] = [['Category', 'Age group', 'Dance', 'Place', 'Number', 'First name', 'Last name', 'Location']]
  for (const g of m.groups.value) {
    for (const id of danceIds(g)) {
      const name = id === CALLBACKS ? 'Callbacks' : id === OVERALL ? 'Overall' : (m.dancesById.value.get(id)?.label ?? '')
      const p = parsePlacings(m.results.value[g.id]?.[id])
      p.entries.forEach((e, i) => {
        const d = m.dancersById.value.get(e.id)
        rows.push([
          g.category?.label ?? '',
          g.name ?? '',
          name,
          id === CALLBACKS ? '' : String(placeAt(i, p) ?? ''),
          d?.num ?? '?',
          d?.firstName ?? '',
          d?.lastName ?? '',
          d?.location ?? '',
        ])
      })
    }
  }
  const csv = rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${(m.competition.value?.name ?? 'results').replace(/[^\w-]+/g, ' ').trim()} results.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
</script>

<template>
  <MasterDetail :show-detail="!!groupId" focus-detail>
    <template #list>
      <div class="space-y-6 p-4 pb-[calc(2rem+var(--safe-bottom))]">
        <header class="space-y-1">
          <h1 class="text-title">Results</h1>
          <p v-if="!m.resultsHidden.value && totals.total" class="text-muted-foreground text-sm font-semibold tabular-nums">
            {{ totals.done }} of {{ totals.total }} entered
          </p>
        </header>

        <EmptyState
          v-if="m.resultsHidden.value"
          :icon="Trophy"
          title="Results are hidden"
          description="This competition doesn’t show results. Turn the tab back on below to enter them."
        />
        <EmptyState
          v-else-if="!m.groups.value.length"
          :icon="Trophy"
          title="No age groups yet"
          description="Add age groups and their dancers first, then enter results here."
        />

        <section v-for="[category, groups] in m.resultsHidden.value ? [] : sections" :key="category" class="space-y-2">
          <h2 class="text-muted-foreground px-1 text-sm font-bold">{{ category }}</h2>
          <ul class="bg-card divide-y overflow-hidden rounded-2xl border shadow-sm">
            <li v-for="g in groups" :key="g.id">
              <RouterLink
                :to="{ name: 'manage.results', params: { competitionId: m.competitionId.value, groupId: g.id, danceId: firstTodo(g) } }"
                :replace="split"
                :aria-current="groupId === g.id ? 'true' : undefined"
                :class="['flex min-h-15 items-center gap-3 px-4 py-2', groupId === g.id ? 'bg-blue-paper' : 'hover:bg-accent']"
              >
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-base font-semibold">{{ g.name || g.label }}</span>
                  <span class="text-muted-foreground block text-sm">{{ m.groupDancers(g.id).length }} dancers</span>
                </span>
                <span
                  v-if="progress(g).done === progress(g).total"
                  class="bg-done text-done-foreground flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-bold"
                >
                  <Check class="size-3.5" stroke-width="3" /> Done
                </span>
                <span v-else class="text-muted-foreground text-sm font-semibold tabular-nums">{{ progress(g).done }}/{{ progress(g).total }}</span>
                <ChevronRight class="text-muted-foreground size-5 shrink-0 md:hidden" />
              </RouterLink>
            </li>
          </ul>
        </section>

        <section class="space-y-3 border-t pt-6">
          <button
            v-if="totals.done"
            type="button"
            class="bg-card border-strong hover:bg-accent flex h-11 items-center gap-1.5 rounded-xl border px-4 text-[0.9375rem] font-bold"
            @click="exportCsv"
          >
            <Download class="size-4" /> Download all results
          </button>
          <div class="bg-card rounded-2xl border px-4 py-2">
            <SwitchField
              :model-value="m.resultsHidden.value"
              label="Hide the Results tab"
              description="For competitions that won’t publish results here."
              :save="setHidden"
            />
          </div>
        </section>
      </div>
    </template>

    <template #empty>
      <div class="hidden h-full items-center justify-center p-8 md:flex">
        <p class="text-muted-foreground max-w-xs text-center text-base">Choose an age group to enter its callbacks, placings and points.</p>
      </div>
    </template>

    <template #detail>
      <ResultsEntry v-if="groupId && m.groupsById.value.get(groupId)" :key="groupId" :group-id="groupId" :dance-id="danceId" />
      <EmptyState v-else :icon="Trophy" title="This age group isn’t here any more" description="Choose another from the list." />
    </template>
  </MasterDetail>
</template>
