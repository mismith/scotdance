<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useCompetition } from '@/composables/useCompetition'
import DrawDialog from '@/components/DrawDialog.vue'
import FavCount from '@/components/FavCount.vue'
import { dances as eventDances, getScheduleDanceName } from '@/lib/schedule'
import { findGroupDancers } from '@/lib/results'
import { staffMemberName } from '@/types/competition'
import type {
  EnrichedGroup,
  Platform,
  ScheduleDance,
  StaffMember,
} from '@/types/competition'
import { useFavoritesStore } from '@/stores/favorites'

const route = useRoute()
const {
  schedule,
  platforms,
  groups,
  dancers,
  dances,
  staff,
  loadSchedule,
  loadDancers,
  loadResults,
  loadStaff,
} = useCompetition()
const favorites = useFavoritesStore()

onMounted(async () => {
  await Promise.all([loadSchedule(), loadDancers(), loadResults(), loadStaff()])
})

const dayId = computed(() => String(route.params.dayId ?? ''))
const blockId = computed(() => String(route.params.blockId ?? ''))
const eventId = computed(() => String(route.params.eventId ?? ''))

const day = computed(() => schedule.value?.days?.[dayId.value] ?? null)
const block = computed(() => day.value?.blocks?.[blockId.value] ?? null)
const event = computed(() => block.value?.events?.[eventId.value] ?? null)

const eventDanceList = computed(() =>
  event.value ? eventDances({ dances: event.value.dances }) : [],
)

const eventPlatforms = computed<Platform[]>(() => {
  const ids = new Set<string>()
  for (const dance of eventDanceList.value) {
    if (!dance.platforms) continue
    for (const pid of Object.keys(dance.platforms)) ids.add(pid)
  }
  return platforms.value.filter((p) => ids.has(p.id))
})

interface DanceRow {
  dance: ScheduleDance
  // heats[heatIndex][platformIndex] — null = spacer/empty slot
  heats: Array<Array<EnrichedGroup | null>>
  judges: Map<string, StaffMember[]>
  hasAnyJudges: boolean
}

const danceRows = computed<DanceRow[]>(() => {
  const judgeById = new Map(staff.value.map((m) => [m.id, m]))
  const groupById = new Map(groups.value.map((g) => [g.id, g]))
  return eventDanceList.value
    .filter((d) => d.danceId)
    .map<DanceRow>((dance) => {
      const judgeMap = new Map<string, StaffMember[]>()
      let hasAnyJudges = false
      const perPlatformGroups: Array<Array<EnrichedGroup | null>> =
        eventPlatforms.value.map((platform) => {
          const slot = dance.platforms?.[platform.id]
          const cellJudges = (slot?.orderedJudgeIds ?? [])
            .map((id) => judgeById.get(id))
            .filter((j): j is StaffMember => Boolean(j) && j!.type === 'Judge')
          judgeMap.set(platform.id, cellJudges)
          if (cellJudges.length) hasAnyJudges = true
          return (slot?.orderedGroupIds ?? []).map((id) => groupById.get(id) ?? null)
        })
      const maxHeats = Math.max(0, ...perPlatformGroups.map((a) => a.length))
      const heats: Array<Array<EnrichedGroup | null>> =
        maxHeats === 0
          ? [eventPlatforms.value.map(() => null)]
          : Array.from({ length: maxHeats }, (_, i) =>
              perPlatformGroups.map((arr) => arr[i] ?? null),
            )
      return { dance, heats, judges: judgeMap, hasAnyJudges }
    })
})

function groupDancerCount(group: EnrichedGroup): number {
  return findGroupDancers(group.id, dancers.value).length
}

function groupFavoriteCount(group: EnrichedGroup): number {
  return findGroupDancers(group.id, dancers.value).filter((d) =>
    favorites.isFavoriteDancer(d.id),
  ).length
}

const drawGroup = ref<EnrichedGroup | null>(null)
const drawDance = ref<ScheduleDance | null>(null)

function openDraw(group: EnrichedGroup, dance: ScheduleDance) {
  drawGroup.value = group
  drawDance.value = dance
}

function closeDraw() {
  drawGroup.value = null
  drawDance.value = null
}

const drawDanceName = computed(() =>
  drawDance.value ? (getScheduleDanceName(drawDance.value, dances.value) ?? '') : '',
)

const gridStyle = computed(() => ({
  gridTemplateColumns: `minmax(9rem, max-content) repeat(${eventPlatforms.value.length}, minmax(10rem, 1fr))`,
}))
</script>

<template>
  <article class="space-y-6">
    <div
      v-if="schedule === null"
      class="text-muted-foreground text-lg italic"
    >
      Loading…
    </div>

    <div
      v-else-if="!event"
      class="text-muted-foreground text-lg italic"
    >
      Event not found.
    </div>

    <template v-else>
      <header class="space-y-2">
        <div
          class="text-foreground/65 text-xs text-eyebrow"
        >
          {{ day?.name }}<span v-if="block?.name"> · {{ block.name }}</span>
        </div>
        <h1 class="text-4xl leading-[1.04] font-medium tracking-tight">
          {{ event.name ?? 'Event' }}
        </h1>
        <p
          v-if="event.description"
          class="text-muted-foreground text-lg whitespace-pre-line"
        >
          {{ event.description }}
        </p>
      </header>

      <div
        v-if="!eventDanceList.length"
        class="text-muted-foreground text-lg italic"
      >
        No dances scheduled.
      </div>

      <div
        v-else-if="!eventPlatforms.length"
        class="text-muted-foreground text-lg italic"
      >
        Platforms not yet assigned.
      </div>

      <div v-else class="-mx-4 overflow-x-auto px-4 pb-2">
        <div class="grid min-w-full gap-x-6" :style="gridStyle">
          <div class="border-b pb-2"></div>
          <div
            v-for="platform in eventPlatforms"
            :key="`h-${platform.id}`"
            class="text-foreground/65 border-b pb-2 text-xs text-eyebrow"
          >
            {{ platform.name || 'Platform' }}
          </div>

          <template v-for="row in danceRows" :key="row.dance.id">
            <template v-for="(heat, heatIdx) in row.heats" :key="`${row.dance.id}-h${heatIdx}`">
              <div :class="[heatIdx === 0 ? 'pt-4 pb-1' : 'py-1']">
                <template v-if="heatIdx === 0">
                  <div class="text-item-title">
                    {{ getScheduleDanceName(row.dance, dances) || 'Dance' }}
                  </div>
                  <p
                    v-if="row.dance.description"
                    class="text-muted-foreground mt-0.5 text-sm whitespace-pre-line"
                  >
                    {{ row.dance.description }}
                  </p>
                </template>
              </div>
              <div
                v-for="(group, platIdx) in heat"
                :key="`g-${row.dance.id}-h${heatIdx}-p${platIdx}`"
                :class="[heatIdx === 0 ? 'pt-4 pb-1' : 'py-1']"
              >
                <button
                  v-if="group"
                  type="button"
                  class="flex w-full items-baseline gap-3 text-left"
                  @click="openDraw(group, row.dance)"
                >
                  <span class="flex-1 font-serif">{{
                    group.name || group.fullName
                  }}</span>
                  <FavCount
                    :favs="groupFavoriteCount(group)"
                    :total="groupDancerCount(group)"
                  />
                </button>
                <span v-else class="text-muted-foreground/40">—</span>
              </div>
            </template>

            <template v-if="row.hasAnyJudges">
              <div class="border-b"></div>
              <div
                v-for="platform in eventPlatforms"
                :key="`j-${row.dance.id}-${platform.id}`"
                class="text-muted-foreground border-b pt-1 pb-3 text-sm italic"
              >
                <template v-if="(row.judges.get(platform.id) ?? []).length">
                  <span
                    v-for="(judge, i) in row.judges.get(platform.id)"
                    :key="judge.id"
                  >
                    {{ staffMemberName(judge) || 'Judge'
                    }}<span
                      v-if="i < (row.judges.get(platform.id)?.length ?? 0) - 1"
                      >, </span
                    >
                  </span>
                </template>
                <span v-else>—</span>
              </div>
            </template>
            <template v-else>
              <div class="border-b"></div>
              <div
                v-for="platform in eventPlatforms"
                :key="`j-empty-${row.dance.id}-${platform.id}`"
                class="border-b"
              ></div>
            </template>
          </template>
        </div>
      </div>
    </template>

    <DrawDialog
      :group="drawGroup"
      :event-name="event?.name ?? undefined"
      :dance-name="drawDanceName"
      @close="closeDraw"
    />
  </article>
</template>
