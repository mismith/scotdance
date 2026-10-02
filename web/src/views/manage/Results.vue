<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { Check, ChevronDown, ChevronRight, CircleCheck, Download, EyeOff, Minus, Plus, Trophy } from '@lucide/vue'
import EmptyState from '@/components/EmptyState.vue'
import MasterDetail from '@/components/admin/MasterDetail.vue'
import ResultsEntry from '@/components/admin/ResultsEntry.vue'
import SectionHeader from '@/components/admin/SectionHeader.vue'
import SectionMenu from '@/components/admin/SectionMenu.vue'
import { useHideTab } from '@/composables/admin/useHideTab'
import { useManagedCompetition, type MGroup } from '@/composables/admin/useManagedCompetition'
import { useSplit } from '@/composables/admin/useWide'
import { canEdit } from '@/lib/admin/write'
import { CALLBACKS, OVERALL, danceState, isPlaceholderId, parsePlacings, placeAt } from '@/lib/admin/results'
import { groupHasOverall } from '@/types/competition'

const route = useRoute()
const m = useManagedCompetition()
const split = useSplit()
const hideTab = useHideTab('results')

const PRIMARY = 'bg-primary-fill text-primary-foreground flex h-11 items-center gap-1.5 rounded-xl px-4 text-[0.9375rem] font-bold disabled:opacity-50'

const groupId = computed(() => (route.params.groupId ? String(route.params.groupId) : null))
const danceId = computed(() => (route.params.danceId ? String(route.params.danceId) : CALLBACKS))

// Only enter results for what's listed: a removed dance (or an old link)
// would otherwise save placings nobody can see.
const openGroup = computed(() => (groupId.value ? (m.groupsById.value.get(groupId.value) ?? null) : null))

const danceIds = (g: MGroup) => [CALLBACKS, ...m.groupDances(g.id).map((d) => d.id), ...(groupHasOverall(g) ? [OVERALL] : [])]

function progress(g: MGroup) {
  const ids = danceIds(g)
  const done = ids.filter((id) => danceState(m.results.value[g.id]?.[id]) !== 'todo').length
  return { done, total: ids.length }
}

const danceRows = (g: MGroup) => [
  { id: CALLBACKS, label: 'Callbacks' },
  ...m.groupDances(g.id).map((d) => ({ id: d.id, label: d.label })),
  ...(groupHasOverall(g) ? [{ id: OVERALL, label: 'Overall' }] : []),
]
const stateOf = (groupId: string, danceId: string) => danceState(m.results.value[groupId]?.[danceId])
const hasPlaceholder = (groupId: string, danceId: string) =>
  parsePlacings(m.results.value[groupId]?.[danceId]).entries.some((e) => isPlaceholderId(e.id)) ||
  (m.points.value[groupId]?.[danceId]?.combined ?? []).some(isPlaceholderId)

// Which age groups are open, remembered on this device. The first (or the
// one being entered) opens by default.
const EXPANDED_KEY = 'manage.results.expanded'
const expanded = ref<Record<string, boolean>>({})
try {
  expanded.value = JSON.parse(localStorage.getItem(EXPANDED_KEY) ?? '{}')
} catch {
  expanded.value = {}
}
const isExpanded = (id: string) => expanded.value[id] ?? (id === groupId.value || id === m.groups.value[0]?.id || m.groups.value.length === 1)
function toggle(id: string) {
  expanded.value = { ...expanded.value, [id]: !isExpanded(id) }
  try {
    localStorage.setItem(EXPANDED_KEY, JSON.stringify(expanded.value))
  } catch {
    // Private browsing: just don't remember.
  }
}
watch(groupId, (id) => {
  if (id && !isExpanded(id)) expanded.value = { ...expanded.value, [id]: true }
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

// A spreadsheet of every placing, for the organisers' records.
function exportCsv() {
  const rows: string[][] = [['Category', 'Age group', 'Dance', 'Place', 'Number', 'First name', 'Last name', 'Location']]
  for (const g of m.groups.value) {
    for (const id of danceIds(g)) {
      const name = id === CALLBACKS ? 'Callbacks' : id === OVERALL ? 'Overall' : (m.dancesById.value.get(id)?.label ?? '')
      const row = (dancerId: string, place: string) => {
        const d = m.dancersById.value.get(dancerId)
        return [g.category?.label ?? '', g.name ?? '', name, place, d?.num ?? '?', d?.firstName ?? '', d?.lastName ?? '', d?.location ?? '']
      }
      const p = parsePlacings(m.results.value[g.id]?.[id])
      p.entries.forEach((e, i) => rows.push(row(e.id, id === CALLBACKS ? '' : String(placeAt(i, p) ?? ''))))
      // Championship points too, as the old export had them.
      const pointed = new Set(Object.values(m.points.value[g.id]?.[id] ?? {}).flat())
      for (const dancerId of pointed) rows.push(row(dancerId, 'Point'))
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
  <MasterDetail :show-detail="!!groupId">
    <template #list>
      <div class="space-y-6 p-4 pb-[calc(2rem+var(--safe-bottom))]">
        <SectionHeader title="Results" :count="!hideTab.hidden.value && totals.total ? `${totals.done} of ${totals.total} entered` : null">
          <!-- What's rarely needed. Hiding the tab deletes what's entered
               (after asking), so it's tucked away here. -->
          <template v-if="!hideTab.hidden.value && m.groups.value.length" #actions>
            <SectionMenu v-slot="{ row, close }" label="More for results">
              <button v-if="totals.done" type="button" :class="row" @click="close(); exportCsv()">
                <Download class="text-primary size-5 shrink-0" /> Download all results
              </button>
              <button type="button" :class="row" :disabled="!canEdit" @click="close(); hideTab.hide()">
                <EyeOff class="text-primary size-5 shrink-0" /> Hide the Results tab
              </button>
            </SectionMenu>
          </template>
        </SectionHeader>

        <EmptyState v-if="hideTab.hidden.value" :icon="Trophy" title="Results are hidden" description="The competition page has no Results tab.">
          <button type="button" :disabled="!canEdit" :class="PRIMARY" @click="hideTab.show()">Show the Results tab</button>
        </EmptyState>
        <EmptyState
          v-else-if="!m.groups.value.length"
          :icon="Trophy"
          title="No age groups yet"
          description="Add age groups and their dancers first, then enter results here."
        >
          <RouterLink :to="{ name: 'manage.groups', params: { competitionId: m.competitionId.value } }" :class="PRIMARY">
            <Plus class="size-4" /> Add age groups
          </RouterLink>
          <template #footer>
            Not publishing results here?
            <button type="button" :disabled="!canEdit" class="text-primary font-bold underline-offset-2 hover:underline disabled:opacity-50" @click="hideTab.hide()">
              Hide the Results tab
            </button>
          </template>
        </EmptyState>

        <ul v-else class="bg-card divide-y overflow-hidden rounded-2xl border shadow-sm">
          <li v-for="g in m.groups.value" :key="g.id">
            <button
              type="button"
              :aria-expanded="isExpanded(g.id)"
              class="hover:bg-accent flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left"
              @click="toggle(g.id)"
            >
              <span class="min-w-0 flex-1">
                <span class="block truncate text-base font-bold">{{ g.label }}</span>
                <span class="text-muted-foreground block text-sm">{{ m.groupDancers(g.id).length }} dancers · {{ progress(g).done }} of {{ progress(g).total }} entered</span>
              </span>
              <CircleCheck v-if="progress(g).done === progress(g).total" class="text-primary size-5 shrink-0" />
              <ChevronDown :class="['text-muted-foreground size-5 shrink-0 transition-transform', isExpanded(g.id) && 'rotate-180']" />
            </button>
            <ul v-if="isExpanded(g.id)" class="bg-background divide-y border-t">
              <li v-for="d in danceRows(g)" :key="d.id">
                <RouterLink
                  :to="{ name: 'manage.results', params: { competitionId: m.competitionId.value, groupId: g.id, danceId: d.id } }"
                  :replace="split"
                  :aria-current="groupId === g.id && danceId === d.id ? 'true' : undefined"
                  :class="[
                    'flex min-h-13 items-center gap-3 py-1.5 pr-3 pl-6',
                    groupId === g.id && danceId === d.id ? 'bg-blue-paper' : 'hover:bg-accent',
                    hasPlaceholder(g.id, d.id) && 'bg-[repeating-linear-gradient(135deg,transparent_0_10px,color-mix(in_oklab,var(--color-next)_60%,transparent)_10px_20px)]',
                  ]"
                >
                  <span
                    :class="[
                      'flex size-9 shrink-0 items-center justify-center rounded-full text-[0.6875rem] font-extrabold',
                      stateOf(g.id, d.id) === 'todo' ? 'bg-muted text-muted-foreground' : 'bg-primary-fill text-primary-foreground',
                    ]"
                  >
                    <Check v-if="stateOf(g.id, d.id) === 'done'" class="size-4.5" stroke-width="3" />
                    <Minus v-else-if="stateOf(g.id, d.id) === 'none'" class="size-4.5" stroke-width="3" />
                    <template v-else>TBD</template>
                  </span>
                  <span class="min-w-0 flex-1 truncate text-[0.9375rem] font-semibold">{{ d.label }}</span>
                  <Trophy v-if="d.id === OVERALL" class="text-muted-foreground size-4.5 shrink-0" />
                  <ChevronRight class="text-muted-foreground size-5 shrink-0 md:hidden" />
                </RouterLink>
              </li>
            </ul>
          </li>
        </ul>

      </div>
    </template>

    <template #empty>
      <div class="hidden h-full items-center justify-center md:flex">
        <EmptyState
          v-if="!hideTab.hidden.value && m.groups.value.length"
          :icon="Trophy"
          title="Choose an age group"
          description="Enter its callbacks, placings and points here."
        />
      </div>
    </template>

    <template #detail>
      <ResultsEntry v-if="openGroup && danceIds(openGroup).includes(danceId)" :key="openGroup.id" :group-id="openGroup.id" :dance-id="danceId" />
      <EmptyState v-else-if="openGroup" :icon="Trophy" title="This dance isn’t in this age group any more" description="Choose another from the list." />
      <EmptyState v-else :icon="Trophy" title="This age group isn’t here any more" description="Choose another from the list." />
    </template>
  </MasterDetail>
</template>
