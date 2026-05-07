<script setup lang="ts">
import { computed, nextTick, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useLocalStorage } from '@vueuse/core'
import { ChevronDown } from '@lucide/vue'
import { useCompetition } from '@/composables/useCompetition'
import { injectChromeTitle } from '@/composables/useChromeTitle'
import FavoriteDancerButton from '@/components/FavoriteDancerButton.vue'
import Place from '@/components/Place.vue'
import SmoothCollapse from '@/components/SmoothCollapse.vue'
import {
  CALLBACKS_ID,
  findGroupDancers,
  findPointedDancers,
  findGroupDances,
  getCallbackResults,
  getDanceResults,
} from '@/lib/results'
import {
  OVERALL_ID,
  groupHasOverall,
  type EnrichedDance,
  type EnrichedDancer,
} from '@/types/competition'

const route = useRoute()
const {
  competitionId,
  groups,
  dancers,
  dances,
  results,
  points,
  loadDancers,
  loadResults,
} = useCompetition()

onMounted(async () => {
  await Promise.all([loadDancers(), loadResults()])
})

const groupId = computed(() => String(route.params.groupId ?? ''))
const group = computed(() => groups.value.find((g) => g.id === groupId.value) ?? null)

const chromeTitle = injectChromeTitle()
watch(
  group,
  (g) => {
    if (!g) {
      chromeTitle.value = null
      return
    }
    const name = g.name ?? g.fullName ?? null
    const cat = g.category?.name ?? null
    chromeTitle.value = [cat, name].filter(Boolean).join(' · ') || null
  },
  { immediate: true },
)

const callbacksDance: EnrichedDance = { id: CALLBACKS_ID, fullName: 'Callbacks' }
const overallDance: EnrichedDance = { id: OVERALL_ID, fullName: 'Overall' }

const danceList = computed<EnrichedDance[]>(() => {
  if (!group.value) return []
  const list: EnrichedDance[] = [callbacksDance]
  list.push(...findGroupDances(group.value, dances.value))
  if (groupHasOverall(group.value)) list.push(overallDance)
  return list
})

const dancerNumberValue = (d: EnrichedDancer) =>
  d.number != null && Number.isFinite(d.number) ? d.number : Number.POSITIVE_INFINITY

const groupDancers = computed<EnrichedDancer[]>(() => {
  if (!group.value) return []
  return [...findGroupDancers(group.value.id, dancers.value)].sort(
    (a, b) => dancerNumberValue(a) - dancerNumberValue(b),
  )
})

interface DanceSection {
  dance: EnrichedDance
  kind: 'callbacks' | 'placings'
  count: number | null
  callback?: ReturnType<typeof getCallbackResults>
  placings?: ReturnType<typeof getDanceResults>
  pointed: ReturnType<typeof findPointedDancers>
}

const sections = computed<DanceSection[]>(() => {
  if (!group.value) return []
  return danceList.value.map<DanceSection>((dance) => {
    if (dance.id === CALLBACKS_ID) {
      const callback = getCallbackResults(group.value!.id, dancers.value, results.value)
      return {
        dance,
        kind: 'callbacks',
        count: callback.dancers.length,
        callback,
        pointed: [],
      }
    }
    return {
      dance,
      kind: 'placings',
      count: null,
      placings: getDanceResults(group.value!.id, dance.id, dancers.value, results.value),
      pointed: findPointedDancers(points.value, group.value!.id, dance.id, dancers.value),
    }
  })
})

const callbacksSection = computed(() =>
  sections.value.find((s): s is DanceSection & { kind: 'callbacks' } => s.kind === 'callbacks'),
)
const callbacksHasResults = computed(
  () => !!callbacksSection.value?.callback?.hasResults,
)

const showAllInCallbacks = useLocalStorage<Record<string, boolean>>(
  'results:showAllInCallbacks',
  {},
)

const isShowingAll = computed(() => {
  if (groupId.value in showAllInCallbacks.value) {
    return showAllInCallbacks.value[groupId.value]
  }
  return !callbacksHasResults.value
})

function toggleShowAll() {
  showAllInCallbacks.value = {
    ...showAllInCallbacks.value,
    [groupId.value]: !isShowingAll.value,
  }
}

interface CallbackRow {
  key: string
  dancer: EnrichedDancer | null
  dimmed: boolean
}

const callbackRows = computed<CallbackRow[]>(() => {
  const callback = callbacksSection.value?.callback
  const calledBack = callback?.dancers ?? []
  const calledBackIds = new Set(calledBack.map((e) => e.dancerId))

  if (!isShowingAll.value) {
    return calledBack.map((e) => ({ key: e.dancerId, dancer: e.dancer, dimmed: false }))
  }

  const rows: CallbackRow[] = calledBack.map((e) => ({
    key: e.dancerId,
    dancer: e.dancer,
    dimmed: false,
  }))
  for (const d of groupDancers.value) {
    if (!calledBackIds.has(d.id)) {
      rows.push({ key: d.id, dancer: d, dimmed: callbacksHasResults.value })
    }
  }
  return rows
})

const expanded = useLocalStorage<Record<string, Record<string, boolean>>>(
  'results:expandedDances',
  {},
)

function isExpanded(danceId: string): boolean {
  const map = expanded.value[groupId.value] ?? {}
  if (danceId in map) return map[danceId]
  return true
}

function toggle(danceId: string) {
  const current = expanded.value[groupId.value] ?? {}
  expanded.value = {
    ...expanded.value,
    [groupId.value]: { ...current, [danceId]: !isExpanded(danceId) },
  }
}

function focusHashTarget() {
  const match = route.hash.match(/^#dance-(.+)$/)
  if (!match) return
  const danceId = match[1]
  const current = expanded.value[groupId.value] ?? {}
  if (!current[danceId]) {
    expanded.value = {
      ...expanded.value,
      [groupId.value]: { ...current, [danceId]: true },
    }
  }
  nextTick(() => {
    const el = document.getElementById(`dance-${danceId}`)
    el?.scrollIntoView({ block: 'start' })
  })
}

watch(
  () => [groupId.value, route.hash, sections.value.length] as const,
  () => focusHashTarget(),
  { immediate: true },
)
</script>

<template>
  <article class="space-y-6">
    <div v-if="!groups.length" class="text-muted-foreground font-serif italic text-sm">Loading…</div>

    <div v-else-if="!group" class="text-muted-foreground text-sm">Group not found.</div>

    <template v-else>
      <section
        v-for="section in sections"
        :id="`dance-${section.dance.id}`"
        :key="section.dance.id"
        class="scroll-mt-20 space-y-1"
      >
        <button
          type="button"
          class="hover:text-secondary flex w-full items-baseline gap-2 px-1 py-2 text-left"
          @click="toggle(section.dance.id)"
        >
          <ChevronDown
            :class="[
              'text-muted-foreground size-4 shrink-0 self-center transition-transform',
              isExpanded(section.dance.id) ? '' : '-rotate-90',
            ]"
          />
          <span
            class="font-serif min-w-0 flex-1 truncate text-[17px] font-medium tracking-tight leading-tight"
          >
            {{ section.dance.fullName }}
          </span>
          <span
            v-if="section.kind === 'callbacks'"
            class="text-muted-foreground self-center text-[11px] font-semibold tabular-nums"
          >
            {{
              section.callback?.hasResults ? section.count : groupDancers.length
            }}
          </span>
        </button>

        <SmoothCollapse :open="isExpanded(section.dance.id)">
          <template v-if="section.kind === 'callbacks'">
            <p
              v-if="!section.callback?.hasResults && !isShowingAll"
              class="text-muted-foreground font-serif px-1 text-sm italic"
            >
              {{
                section.callback?.explicitlyEmpty
                  ? 'No callbacks for this group.'
                  : 'Not yet posted.'
              }}
            </p>
            <ul v-if="callbackRows.length" class="divide-y border-y">
              <li
                v-for="row in callbackRows"
                :key="row.key"
                :class="['flex items-center', row.dimmed && 'opacity-40']"
              >
                <RouterLink
                  v-if="row.dancer"
                  :to="{
                    name: 'competition.dancer',
                    params: { competitionId, dancerId: row.dancer.id },
                  }"
                  class="hover:bg-accent flex min-w-0 flex-1 items-center gap-3 px-1 py-3"
                >
                  <div
                    class="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-full font-serif text-xs font-medium tabular-nums"
                  >
                    {{ row.dancer.number ?? '–' }}
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="font-serif truncate text-[15px] font-medium tracking-tight">
                      {{ row.dancer.fullName || '?' }}
                    </div>
                    <div
                      v-if="row.dancer.location"
                      class="text-muted-foreground truncate text-[11.5px]"
                    >
                      {{ row.dancer.location }}
                    </div>
                  </div>
                </RouterLink>
                <div
                  v-else
                  class="text-muted-foreground flex flex-1 items-center gap-3 px-1 py-3 text-sm"
                >
                  Unknown dancer
                </div>
                <FavoriteDancerButton
                  v-if="row.dancer"
                  :dancer="row.dancer"
                  class="mr-2"
                />
              </li>
            </ul>
            <button
              type="button"
              class="text-muted-foreground hover:text-foreground mt-2 px-1 py-1 text-xs font-medium"
              @click="toggleShowAll"
            >
              {{
                isShowingAll
                  ? 'Show callbacks only'
                  : `Show all ${groupDancers.length} dancers`
              }}
            </button>
          </template>

          <template v-else>
            <ul v-if="section.placings?.hasResults" class="divide-y border-y">
              <li
                v-for="row in section.placings.rows"
                :key="row.dancerId"
                class="flex items-center"
              >
                <RouterLink
                  v-if="row.dancer"
                  :to="{
                    name: 'competition.dancer',
                    params: { competitionId, dancerId: row.dancer.id },
                  }"
                  class="hover:bg-accent flex min-w-0 flex-1 items-center gap-3 px-1 py-3"
                >
                  <div
                    class="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-full font-serif text-xs font-medium tabular-nums"
                  >
                    {{ row.dancer.number ?? '–' }}
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="font-serif truncate text-[15px] font-medium tracking-tight">
                      {{ row.dancer.fullName || '?' }}
                    </div>
                    <div
                      v-if="row.dancer.location"
                      class="text-muted-foreground truncate text-[11.5px]"
                    >
                      {{ row.dancer.location }}
                    </div>
                  </div>
                </RouterLink>
                <div
                  v-else
                  class="text-muted-foreground flex flex-1 items-center gap-3 px-1 py-3 text-sm"
                >
                  Unknown dancer
                </div>
                <Place :place="row.place" :tied="row.tied" class="mr-2" />
                <FavoriteDancerButton
                  v-if="row.dancer"
                  :dancer="row.dancer"
                  class="mr-2"
                />
              </li>
            </ul>
            <div v-else class="text-muted-foreground font-serif px-1 text-sm italic">
              {{
                section.placings?.explicitlyEmpty
                  ? 'No placings for this dance.'
                  : 'Not yet posted.'
              }}
            </div>

            <div v-if="section.pointed.length" class="mt-3 space-y-2">
              <div
                class="text-muted-foreground px-1 text-[11px] font-bold tracking-[0.14em] uppercase"
              >
                Championship Points
              </div>
              <ul class="divide-y border-y">
                <li
                  v-for="dancer in section.pointed"
                  :key="dancer.id"
                  class="flex items-center"
                >
                  <RouterLink
                    :to="{
                      name: 'competition.dancer',
                      params: { competitionId, dancerId: dancer.id },
                    }"
                    class="hover:bg-accent flex min-w-0 flex-1 items-center gap-3 px-1 py-3"
                  >
                    <div
                      class="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-full font-serif text-xs font-medium tabular-nums"
                    >
                      {{ dancer.number ?? '–' }}
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="font-serif truncate text-[15px] font-medium tracking-tight">{{ dancer.fullName || '?' }}</div>
                      <div
                        v-if="dancer.location"
                        class="text-muted-foreground truncate text-[11.5px]"
                      >
                        {{ dancer.location }}
                      </div>
                    </div>
                  </RouterLink>
                  <Place :place="null" pointed class="mr-2" />
                  <FavoriteDancerButton :dancer="dancer" class="mr-2" />
                </li>
              </ul>
            </div>
          </template>
        </SmoothCollapse>
      </section>
    </template>
  </article>
</template>
