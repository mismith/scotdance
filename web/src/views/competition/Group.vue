<script setup lang="ts">
import { computed, nextTick, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useLocalStorage } from '@vueuse/core'
import { ChevronDown } from '@lucide/vue'
import { useCompetition } from '@/composables/useCompetition'
import { injectChromeTitle } from '@/composables/useChromeTitle'
import FavoriteDancerButton from '@/components/FavoriteDancerButton.vue'
import Place from '@/components/Place.vue'
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

const ALL_ID = 'all'

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
    chromeTitle.value = g?.name ?? g?.fullName ?? null
  },
  { immediate: true },
)

const allDance: EnrichedDance = { id: ALL_ID, fullName: 'All Dancers' }
const callbacksDance: EnrichedDance = { id: CALLBACKS_ID, fullName: 'Callbacks' }
const overallDance: EnrichedDance = { id: OVERALL_ID, fullName: 'Overall' }

const danceList = computed<EnrichedDance[]>(() => {
  if (!group.value) return []
  const list: EnrichedDance[] = [allDance, callbacksDance]
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
  kind: 'all' | 'callbacks' | 'placings'
  count: number | null
  all?: EnrichedDancer[]
  callback?: ReturnType<typeof getCallbackResults>
  placings?: ReturnType<typeof getDanceResults>
  pointed: ReturnType<typeof findPointedDancers>
}

const sections = computed<DanceSection[]>(() => {
  if (!group.value) return []
  return danceList.value.map<DanceSection>((dance) => {
    if (dance.id === ALL_ID) {
      return {
        dance,
        kind: 'all',
        count: groupDancers.value.length,
        all: groupDancers.value,
        pointed: [],
      }
    }
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

const expanded = useLocalStorage<Record<string, Record<string, boolean>>>(
  'results:expandedDances',
  {},
)

function isExpanded(danceId: string): boolean {
  const map = expanded.value[groupId.value] ?? {}
  if (danceId in map) return map[danceId]
  return danceId !== ALL_ID
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
      <header v-if="group.category?.name">
        <div
          class="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase"
        >
          {{ group.category.name }}
        </div>
      </header>

      <section
        v-for="section in sections"
        :id="`dance-${section.dance.id}`"
        :key="section.dance.id"
        class="scroll-mt-20 space-y-2"
      >
        <button
          type="button"
          class="text-muted-foreground hover:text-foreground flex w-full items-center gap-2 px-1 py-1 text-xs font-bold tracking-[0.14em] uppercase"
          @click="toggle(section.dance.id)"
        >
          <ChevronDown
            :class="[
              'size-4 transition-transform',
              isExpanded(section.dance.id) ? '' : '-rotate-90',
            ]"
          />
          <span class="flex-1 text-left">{{ section.dance.fullName }}</span>
          <span
            v-if="section.count != null"
            class="text-xs font-normal tracking-normal normal-case"
          >
            {{ section.count }}
          </span>
        </button>

        <div v-if="isExpanded(section.dance.id)">
          <template v-if="section.kind === 'all'">
            <ul v-if="section.all?.length" class="divide-y rounded-md border">
              <li
                v-for="dancer in section.all"
                :key="dancer.id"
                class="flex items-center"
              >
                <RouterLink
                  :to="{
                    name: 'competition.dancer',
                    params: { competitionId, dancerId: dancer.id },
                  }"
                  class="hover:bg-accent flex min-w-0 flex-1 items-center gap-3 p-3"
                >
                  <div
                    class="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full font-mono text-xs tabular-nums"
                  >
                    {{ dancer.number ?? '–' }}
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="font-serif truncate font-medium tracking-tight">{{ dancer.fullName || '?' }}</div>
                    <div
                      v-if="dancer.location"
                      class="text-muted-foreground truncate text-xs"
                    >
                      {{ dancer.location }}
                    </div>
                  </div>
                </RouterLink>
                <FavoriteDancerButton :dancer="dancer" class="mr-2" />
              </li>
            </ul>
            <div v-else class="text-muted-foreground px-1 text-sm">
              No dancers in this group.
            </div>
          </template>

          <template v-else-if="section.kind === 'callbacks'">
            <ul v-if="section.callback?.hasResults" class="divide-y rounded-md border">
              <li
                v-for="entry in section.callback.dancers"
                :key="entry.dancerId"
                class="flex items-center"
              >
                <RouterLink
                  v-if="entry.dancer"
                  :to="{
                    name: 'competition.dancer',
                    params: { competitionId, dancerId: entry.dancer.id },
                  }"
                  class="hover:bg-accent flex min-w-0 flex-1 items-center gap-3 p-3"
                >
                  <div
                    class="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full font-mono text-xs tabular-nums"
                  >
                    {{ entry.dancer.number ?? '–' }}
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="font-serif truncate font-medium tracking-tight">
                      {{ entry.dancer.fullName || '?' }}
                    </div>
                    <div
                      v-if="entry.dancer.location"
                      class="text-muted-foreground truncate text-xs"
                    >
                      {{ entry.dancer.location }}
                    </div>
                  </div>
                </RouterLink>
                <div
                  v-else
                  class="text-muted-foreground flex flex-1 items-center gap-3 p-3 text-sm"
                >
                  Unknown dancer
                </div>
                <FavoriteDancerButton
                  v-if="entry.dancer"
                  :dancer="entry.dancer"
                  class="mr-2"
                />
              </li>
            </ul>
            <div v-else class="text-muted-foreground px-1 text-sm">
              {{
                section.callback?.explicitlyEmpty
                  ? 'No callbacks for this group.'
                  : 'Not yet posted.'
              }}
            </div>
          </template>

          <template v-else>
            <ul v-if="section.placings?.hasResults" class="divide-y rounded-md border">
              <li
                v-for="row in section.placings.rows"
                :key="row.dancerId"
                class="flex items-center"
              >
                <Place :place="row.place" :tied="row.tied" class="ml-3" />
                <RouterLink
                  v-if="row.dancer"
                  :to="{
                    name: 'competition.dancer',
                    params: { competitionId, dancerId: row.dancer.id },
                  }"
                  class="hover:bg-accent flex min-w-0 flex-1 items-center gap-3 p-3"
                >
                  <div
                    class="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full font-mono text-xs tabular-nums"
                  >
                    {{ row.dancer.number ?? '–' }}
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="font-serif truncate font-medium tracking-tight">
                      {{ row.dancer.fullName || '?' }}
                    </div>
                    <div
                      v-if="row.dancer.location"
                      class="text-muted-foreground truncate text-xs"
                    >
                      {{ row.dancer.location }}
                    </div>
                  </div>
                </RouterLink>
                <div
                  v-else
                  class="text-muted-foreground flex flex-1 items-center gap-3 p-3 text-sm"
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
            <div v-else class="text-muted-foreground px-1 text-sm">
              {{
                section.placings?.explicitlyEmpty
                  ? 'No placings for this dance.'
                  : 'Not yet posted.'
              }}
            </div>

            <div v-if="section.pointed.length" class="mt-3 space-y-2">
              <div
                class="text-muted-foreground px-1 text-xs font-semibold tracking-wide uppercase"
              >
                Championship Points
              </div>
              <ul class="divide-y rounded-md border">
                <li
                  v-for="dancer in section.pointed"
                  :key="dancer.id"
                  class="flex items-center"
                >
                  <Place :place="null" pointed class="ml-3" />
                  <RouterLink
                    :to="{
                      name: 'competition.dancer',
                      params: { competitionId, dancerId: dancer.id },
                    }"
                    class="hover:bg-accent flex min-w-0 flex-1 items-center gap-3 p-3"
                  >
                    <div
                      class="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full font-mono text-xs tabular-nums"
                    >
                      {{ dancer.number ?? '–' }}
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="font-serif truncate font-medium tracking-tight">{{ dancer.fullName || '?' }}</div>
                      <div
                        v-if="dancer.location"
                        class="text-muted-foreground truncate text-xs"
                      >
                        {{ dancer.location }}
                      </div>
                    </div>
                  </RouterLink>
                  <FavoriteDancerButton :dancer="dancer" class="mr-2" />
                </li>
              </ul>
            </div>
          </template>
        </div>
      </section>
    </template>
  </article>
</template>
