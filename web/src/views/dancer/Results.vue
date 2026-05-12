<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useLocalStorage } from '@vueuse/core'
import { ChevronRight } from '@lucide/vue'
import { useDancerProfile, type DancerAppearance } from '@/composables/useDancerProfile'
import type { CompetitionListItem } from '@/composables/useCompetitions'
import CompetitionsCalendar from '@/components/CompetitionsCalendar.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import ViewModeTabs, { type ViewMode } from '@/components/ViewModeTabs.vue'
import { formatMonthAbbrev, isSameDay, parseDate } from '@/lib/format'

const profile = useDancerProfile()
const route = useRoute()

const view = useLocalStorage<ViewMode>('dancer:results:view', 'list')

const tiles = computed(() => [
  { k: '1st', v: '—', accent: 'text-secondary' },
  { k: 'Top 3', v: '—', accent: 'text-primary' },
  { k: 'Avg', v: '—', accent: 'text-foreground' },
])

interface DatedAppearance extends DancerAppearance {
  day: string
  month: string
  isLive: boolean
}

function dated(list: DancerAppearance[]): DatedAppearance[] {
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

const dancerCompetitions = computed<CompetitionListItem[]>(() => {
  const seen = new Set<string>()
  const list: CompetitionListItem[] = []
  for (const a of profile.appearances.value) {
    if (!a.competition || seen.has(a.hit.competitionId)) continue
    seen.add(a.hit.competitionId)
    list.push({ id: a.hit.competitionId, ...a.competition })
  }
  return list
})

const dancerSlug = computed(() => String(route.params.dancerId ?? ''))
const calendarLinkTo = (c: CompetitionListItem) => ({
  name: 'competition.dancer',
  params: { competitionId: c.id, dancerId: dancerSlug.value },
})
</script>

<template>
  <article class="space-y-5">
    <section>
      <div class="grid grid-cols-3 gap-2">
        <div
          v-for="t in tiles"
          :key="t.k"
          class="bg-card rounded-2xl border px-3 py-3 text-center"
        >
          <div
            class="text-foreground/65 text-xs text-eyebrow"
          >
            {{ t.k }}
          </div>
          <div
            :class="[
              'mt-1 text-4xl font-medium tabular-nums tracking-tight',
              t.accent,
            ]"
          >
            {{ t.v }}
          </div>
        </div>
      </div>
      <p class="text-muted-foreground mt-2 px-1">
        Aggregated stats across comps need per-comp results loaded — coming soon.
      </p>
    </section>

    <ViewModeTabs v-model="view" />

    <div
      v-if="view === 'map'"
      class="text-muted-foreground rounded-2xl border border-dashed p-8 text-center text-lg italic"
    >
      Map view — stub.
    </div>

    <CompetitionsCalendar
      v-else-if="view === 'calendar'"
      :competitions="dancerCompetitions"
      :link-to="calendarLinkTo"
    />

    <template v-else>
      <section v-if="upcoming.length" class="space-y-2">
        <SectionHeader label="Upcoming" :count="upcoming.length" />
        <ul>
          <li
            v-for="a in upcoming"
            :key="a.hit.id"
            :class="['flex items-center', a.isLive && 'bg-secondary/10']"
          >
            <RouterLink
              :to="{
                name: 'competition.dancer',
                params: {
                  competitionId: a.hit.competitionId,
                  dancerId: a.hit.id,
                },
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
                <div
                  class="text-item-title truncate"
                >
                  {{ a.competition?.name ?? 'Loading…' }}
                </div>
                <div
                  class="text-item-subtitle text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2"
                >
                  <span v-if="a.hit.number != null" class="tabular-nums not-italic"
                    >#{{ a.hit.number }}</span
                  >
                  <span v-if="a.competition?.location">{{
                    a.competition.location
                  }}</span>
                  <span
                    v-if="a.isLive"
                    class="text-secondary font-sans text-sm font-bold not-italic tracking-[0.12em] uppercase"
                    >Dancing now</span
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
          <li v-for="a in past" :key="a.hit.id" class="flex items-center">
            <RouterLink
              :to="{
                name: 'competition.dancer',
                params: {
                  competitionId: a.hit.competitionId,
                  dancerId: a.hit.id,
                },
              }"
              class="flex min-w-0 flex-1 items-center gap-4 px-2 py-3"
            >
              <div class="w-10 shrink-0 text-center opacity-60">
                <div
                  class="text-4xl font-medium leading-none tabular-nums"
                >
                  {{ a.day }}
                </div>
                <div
                  class="text-muted-foreground mt-1 text-sm font-bold tracking-[0.12em] uppercase"
                >
                  {{ a.month }}
                </div>
              </div>
              <div class="min-w-0 flex-1 opacity-80">
                <div
                  class="text-item-title truncate"
                >
                  {{ a.competition?.name ?? 'Loading…' }}
                </div>
                <div
                  v-if="a.hit.number != null"
                  class="text-item-subtitle text-muted-foreground mt-1 tabular-nums"
                >
                  #{{ a.hit.number }}
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
