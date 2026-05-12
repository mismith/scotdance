<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useLocalStorage } from '@vueuse/core'
import { useCompetition } from '@/composables/useCompetition'
import DisclosureHeader from '@/components/DisclosureHeader.vue'
import SmoothCollapse from '@/components/SmoothCollapse.vue'
import DrawDialog from '@/components/DrawDialog.vue'
import StaffDialog from '@/components/StaffDialog.vue'
import FavCount from '@/components/FavCount.vue'
import { dances as eventDances, getScheduleDanceName } from '@/lib/schedule'
import { findGroupDancers } from '@/lib/results'
import { staffMemberName } from '@/types/competition'
import type { EnrichedGroup, ScheduleDance, StaffMember } from '@/types/competition'
import { useFavoritesStore } from '@/stores/favorites'
import { useVtScope } from '@/lib/viewTransitionFocus'

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

// Tag the current event as the view-transition source so back-nav re-tags
// the right row before Schedule remounts.
useVtScope('event').syncFocus(eventId)

const day = computed(() => schedule.value?.days?.[dayId.value] ?? null)
const block = computed(() => day.value?.blocks?.[blockId.value] ?? null)
const event = computed(() => block.value?.events?.[eventId.value] ?? null)

const eventDanceList = computed(() =>
  event.value ? eventDances({ dances: event.value.dances }) : [],
)

const wrappableEventName = computed(() =>
  (event.value?.name ?? 'Event').replace(/\//g, '/​'),
)

const expanded = useLocalStorage<Record<string, Record<string, boolean>>>(
  'schedule:expandedDances',
  {},
)

function danceHasContent(dance: ScheduleDance): boolean {
  return Boolean(dance.description || (dance.danceId && dance.platforms))
}

function isExpanded(danceId: string, hasContent: boolean): boolean {
  const map = expanded.value[eventId.value] ?? {}
  if (danceId in map) return map[danceId]
  return hasContent
}

function toggle(danceId: string, hasContent: boolean) {
  const current = expanded.value[eventId.value] ?? {}
  expanded.value = {
    ...expanded.value,
    [eventId.value]: { ...current, [danceId]: !isExpanded(danceId, hasContent) },
  }
}

interface PlatformPool {
  id: string
  name: string
  judges: StaffMember[]
  groups: EnrichedGroup[]
}

function buildPools(dance: ScheduleDance): PlatformPool[] {
  const judgeById = new Map(staff.value.map((m) => [m.id, m]))
  const groupById = new Map(groups.value.map((g) => [g.id, g]))
  return platforms.value
    .map<PlatformPool | null>((platform) => {
      const slot = dance.platforms?.[platform.id]
      if (!slot) return null
      const platformJudges = (slot.orderedJudgeIds ?? [])
        .map((id) => judgeById.get(id))
        .filter((j): j is StaffMember => Boolean(j) && j!.type === 'Judge')
      const platformGroups = (slot.orderedGroupIds ?? [])
        .map((id) => groupById.get(id))
        .filter((g): g is EnrichedGroup => Boolean(g))
      if (!platformJudges.length && !platformGroups.length) return null
      return {
        id: platform.id,
        name: platform.name || 'Platform',
        judges: platformJudges,
        groups: platformGroups,
      }
    })
    .filter((p): p is PlatformPool => p !== null)
}

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

const activeJudge = ref<StaffMember | null>(null)
function openJudge(judge: StaffMember) {
  activeJudge.value = judge
}
function closeJudge() {
  activeJudge.value = null
}
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
        <div class="text-foreground/65 text-xs text-eyebrow">
          {{ day?.name }}<span v-if="block?.name"> · {{ block.name }}</span>
        </div>
        <h1
          class="text-4xl leading-[1.04] font-medium tracking-tight [view-transition-class:fit_nav-title] [view-transition-name:event-name]"
        >
          {{ wrappableEventName }}
        </h1>
        <p
          v-if="event.description"
          class="text-muted-foreground text-lg whitespace-pre-line"
        >
          {{ event.description }}
        </p>
      </header>

      <div
        v-if="!eventDanceList.length && !event.description"
        class="text-muted-foreground text-lg italic"
      >
        No dances scheduled.
      </div>

      <section v-for="dance in eventDanceList" :key="dance.id" class="space-y-1">
        <DisclosureHeader
          :label="getScheduleDanceName(dance, dances) || 'Dance'"
          :expanded="isExpanded(dance.id, danceHasContent(dance))"
          :disabled="!danceHasContent(dance)"
          @toggle="toggle(dance.id, danceHasContent(dance))"
        />

        <SmoothCollapse
          :open="danceHasContent(dance) && isExpanded(dance.id, danceHasContent(dance))"
        >
          <div class="space-y-3 pl-12">
            <p v-if="dance.description" class="text-lg whitespace-pre-line">
              {{ dance.description }}
            </p>

            <div
              v-if="dance.danceId && buildPools(dance).length"
              class="-mr-4 overflow-x-auto pr-4 pb-2"
            >
              <div class="flex items-start gap-8 snap-x snap-mandatory">
                <div
                  v-for="pool in buildPools(dance)"
                  :key="pool.id"
                  class="flex min-w-56 flex-1 shrink-0 snap-start flex-col gap-4"
                >
                  <div>
                    <div
                      class="font-serif text-2xl leading-none font-medium tracking-tight"
                    >
                      {{ pool.name }}
                    </div>
                    <div
                      v-if="pool.judges.length"
                      class="text-muted-foreground mt-1 text-sm italic"
                    >
                      <template
                        v-for="(judge, i) in pool.judges"
                        :key="judge.id"
                      >
                        <button
                          type="button"
                          class="hover:text-foreground"
                          @click="openJudge(judge)"
                        >
                          {{ staffMemberName(judge) || 'Judge' }}
                        </button><span v-if="i < pool.judges.length - 1">, </span>
                      </template>
                    </div>
                  </div>

                  <ul v-if="pool.groups.length">
                    <li v-for="group in pool.groups" :key="group.id">
                      <button
                        type="button"
                        class="flex w-full items-baseline gap-3 py-2 text-left"
                        @click="openDraw(group, dance)"
                      >
                        <span class="text-item-title flex-1 truncate">{{
                          group.name || group.fullName
                        }}</span>
                        <FavCount
                          :favs="groupFavoriteCount(group)"
                          :total="groupDancerCount(group)"
                        />
                      </button>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div
              v-else-if="dance.danceId"
              class="text-muted-foreground italic"
            >
              Platforms not yet assigned.
            </div>
          </div>
        </SmoothCollapse>
      </section>
    </template>

    <DrawDialog
      :group="drawGroup"
      :event-name="event?.name ?? undefined"
      :dance-name="drawDanceName"
      @close="closeDraw"
    />

    <StaffDialog :member="activeJudge" @close="closeJudge" />
  </article>
</template>
