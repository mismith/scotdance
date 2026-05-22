<script setup lang="ts">
import { computed } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { ChevronRight } from '@lucide/vue'
import { usePiperProfile, type PiperAppearance } from '@/composables/usePiperProfile'
import type { CompetitionListItem } from '@/composables/useCompetitions'
import CompetitionsCalendar from '@/components/CompetitionsCalendar.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import ViewModeTabs, { type ViewMode } from '@/components/ViewModeTabs.vue'
import { formatMonthAbbrev, isSameDay, parseDate } from '@/lib/format'

const profile = usePiperProfile()

const view = useLocalStorage<ViewMode>('piper:competitions:view', 'list')

interface DatedAppearance extends PiperAppearance {
  day: string
  month: string
  isLive: boolean
}

function dated(list: PiperAppearance[]): DatedAppearance[] {
  return list
    .filter((a) => a.competition?.date)
    .map<DatedAppearance>((a) => {
      const d = parseDate(a.competition!.date!)
      return {
        ...a,
        day: String(d.getDate()),
        month: formatMonthAbbrev(d).toUpperCase(),
        isLive: isSameDay(a.competition!.date!),
      }
    })
}

const upcoming = computed(() => dated(profile.upcoming.value))
const past = computed(() => dated(profile.past.value))

const piperCompetitions = computed<CompetitionListItem[]>(() => {
  const seen = new Set<string>()
  const list: CompetitionListItem[] = []
  for (const a of profile.appearances.value) {
    if (!a.competition || !a.raw.competitionId) continue
    if (seen.has(a.raw.competitionId)) continue
    seen.add(a.raw.competitionId)
    list.push({ id: a.raw.competitionId, ...a.competition })
  }
  return list
})

const calendarLinkTo = (c: CompetitionListItem) => ({
  name: 'competition.info',
  params: { competitionId: c.id },
})
</script>

<template>
  <article class="space-y-5">
    <ViewModeTabs v-model="view" />

    <div
      v-if="view === 'map'"
      class="text-muted-foreground rounded-2xl border border-dashed p-8 text-center text-lg italic"
    >
      Map view — stub.
    </div>

    <CompetitionsCalendar
      v-else-if="view === 'calendar'"
      :competitions="piperCompetitions"
      :link-to="calendarLinkTo"
    />

    <template v-else>
      <section v-if="upcoming.length" class="space-y-2">
        <SectionHeader label="Upcoming" :count="upcoming.length" />
        <ul>
          <li
            v-for="a in upcoming"
            :key="a.key"
            :class="['flex items-center', a.isLive && 'bg-secondary/10']"
          >
            <RouterLink
              :to="{
                name: 'competition.info',
                params: { competitionId: a.raw.competitionId },
              }"
              class="flex min-w-0 flex-1 items-center gap-4 px-2 py-3"
            >
              <div class="w-10 shrink-0 text-center">
                <div
                  :class="[
                    'text-4xl font-medium leading-none tabular-nums',
                    a.isLive ? 'text-secondary' : '',
                  ]"
                >
                  {{ a.day }}
                </div>
                <div
                  class="text-muted-foreground mt-1 text-sm font-bold tracking-[0.12em] uppercase"
                >
                  {{ a.month }}
                </div>
              </div>
              <div class="min-w-0 flex-1">
                <div class="text-item-title truncate">
                  {{ a.competition?.name ?? 'Loading…' }}
                </div>
                <div
                  v-if="a.competition?.location || a.isLive"
                  class="text-item-subtitle text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2"
                >
                  <span v-if="a.competition?.location">{{
                    a.competition.location
                  }}</span>
                  <span
                    v-if="a.isLive"
                    class="text-secondary font-sans text-sm font-bold not-italic tracking-[0.12em] uppercase"
                    >Piping now</span
                  >
                </div>
              </div>
              <ChevronRight class="text-muted-foreground size-4 shrink-0" />
            </RouterLink>
          </li>
        </ul>
      </section>

      <section v-if="past.length" class="space-y-2">
        <SectionHeader label="Past" :count="past.length" />
        <ul>
          <li v-for="a in past" :key="a.key" class="flex items-center">
            <RouterLink
              :to="{
                name: 'competition.info',
                params: { competitionId: a.raw.competitionId },
              }"
              class="flex min-w-0 flex-1 items-center gap-4 px-2 py-3"
            >
              <div class="w-10 shrink-0 text-center opacity-60">
                <div class="text-4xl font-medium leading-none tabular-nums">
                  {{ a.day }}
                </div>
                <div
                  class="text-muted-foreground mt-1 text-sm font-bold tracking-[0.12em] uppercase"
                >
                  {{ a.month }}
                </div>
              </div>
              <div class="min-w-0 flex-1 opacity-80">
                <div class="text-item-title truncate">
                  {{ a.competition?.name ?? 'Loading…' }}
                </div>
                <div
                  v-if="a.competition?.location"
                  class="text-item-subtitle text-muted-foreground mt-1"
                >
                  {{ a.competition.location }}
                </div>
              </div>
              <ChevronRight class="text-muted-foreground size-4 shrink-0" />
            </RouterLink>
          </li>
        </ul>
      </section>

      <div
        v-if="!upcoming.length && !past.length"
        class="text-muted-foreground text-lg italic"
      >
        No appearances on record.
      </div>
    </template>
  </article>
</template>
