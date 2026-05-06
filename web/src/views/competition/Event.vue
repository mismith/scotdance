<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useLocalStorage } from '@vueuse/core'
import { ChevronDown, Star } from '@lucide/vue'
import { useCompetition } from '@/composables/useCompetition'
import { injectChromeTitle } from '@/composables/useChromeTitle'
import { dances as eventDances, getScheduleDanceName } from '@/lib/schedule'
import { findGroupDancers } from '@/lib/results'
import { staffMemberName } from '@/types/competition'
import type { EnrichedGroup, ScheduleDance, StaffMember } from '@/types/competition'
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

const chromeTitle = injectChromeTitle()
watch(
  event,
  (e) => {
    chromeTitle.value = e?.name ?? null
  },
  { immediate: true },
)

const eventDanceList = computed(() =>
  event.value ? eventDances({ dances: event.value.dances }) : [],
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
      const judges = (slot.orderedJudgeIds ?? [])
        .map((id) => judgeById.get(id))
        .filter((j): j is StaffMember => Boolean(j) && j!.type === 'Judge')
      const platformGroups = (slot.orderedGroupIds ?? [])
        .map((id) => groupById.get(id))
        .filter((g): g is EnrichedGroup => Boolean(g))
      if (!judges.length && !platformGroups.length) return null
      return {
        id: platform.id,
        name: platform.name || 'Platform',
        judges,
        groups: platformGroups,
      }
    })
    .filter((p): p is PlatformPool => p !== null)
}

function groupDancerCount(group: EnrichedGroup): number {
  return findGroupDancers(group.id, dancers.value).length
}

function groupHasFavorite(group: EnrichedGroup): boolean {
  return findGroupDancers(group.id, dancers.value).some((d) =>
    favorites.isFavoriteDancer(d.id),
  )
}
</script>

<template>
  <article class="space-y-6">
    <div v-if="schedule === null" class="text-muted-foreground text-sm">Loading…</div>

    <div v-else-if="!event" class="text-muted-foreground text-sm">Event not found.</div>

    <template v-else>
      <header>
        <div
          class="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase"
        >
          {{ day?.name }} <span v-if="block?.name">· {{ block.name }}</span>
        </div>
        <p v-if="event.description" class="mt-3 text-sm whitespace-pre-line">
          {{ event.description }}
        </p>
      </header>

      <div v-if="!eventDanceList.length" class="text-muted-foreground text-sm">
        No dances scheduled.
      </div>

      <section v-for="dance in eventDanceList" :key="dance.id" class="space-y-2">
        <button
          type="button"
          class="text-muted-foreground hover:text-foreground flex w-full items-center gap-2 px-1 py-1 text-sm font-semibold tracking-wide uppercase"
          :disabled="!danceHasContent(dance)"
          @click="toggle(dance.id, danceHasContent(dance))"
        >
          <ChevronDown
            v-if="danceHasContent(dance)"
            :class="[
              'size-4 transition-transform',
              isExpanded(dance.id, danceHasContent(dance)) ? '' : '-rotate-90',
            ]"
          />
          <span v-else class="size-4 shrink-0" />
          <span class="flex-1 text-left">
            {{ getScheduleDanceName(dance, dances) || 'Dance' }}
          </span>
        </button>

        <div
          v-if="danceHasContent(dance) && isExpanded(dance.id, danceHasContent(dance))"
          class="space-y-3"
        >
          <p v-if="dance.description" class="px-1 text-sm whitespace-pre-line">
            {{ dance.description }}
          </p>

          <div
            v-if="dance.danceId && buildPools(dance).length"
            class="grid gap-3 sm:grid-cols-2"
          >
            <div
              v-for="pool in buildPools(dance)"
              :key="pool.id"
              class="space-y-3 rounded-md border p-3"
            >
              <div
                class="text-muted-foreground text-xs font-semibold tracking-wide uppercase"
              >
                {{ pool.name }}
              </div>

              <div v-if="pool.judges.length" class="flex flex-wrap gap-1.5">
                <span
                  v-for="judge in pool.judges"
                  :key="judge.id"
                  class="bg-primary/10 text-primary inline-flex items-center rounded-full px-2 py-1 text-xs font-medium"
                >
                  {{ staffMemberName(judge) || 'Judge' }}
                </span>
              </div>

              <ul v-if="pool.groups.length" class="space-y-1">
                <li
                  v-for="group in pool.groups"
                  :key="group.id"
                  class="flex items-center gap-2 text-sm"
                >
                  <span
                    :class="[
                      'inline-flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-xs',
                      groupHasFavorite(group)
                        ? 'bg-secondary text-secondary-foreground'
                        : 'bg-muted text-muted-foreground',
                    ]"
                  >
                    {{ groupDancerCount(group) }}
                  </span>
                  <span class="truncate">{{ group.name || group.fullName }}</span>
                  <Star
                    v-if="groupHasFavorite(group)"
                    class="text-secondary size-3 shrink-0 fill-current"
                  />
                </li>
              </ul>
            </div>
          </div>

          <div v-else-if="dance.danceId" class="text-muted-foreground px-1 text-xs">
            Platforms not yet assigned.
          </div>
        </div>
      </section>
    </template>
  </article>
</template>
