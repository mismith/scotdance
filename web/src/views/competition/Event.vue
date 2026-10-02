<script setup lang="ts">
import { useMorph } from '@/lib/morph'
import MyDancerLine from '@/components/MyDancerLine.vue'
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { Check, Clock } from '@lucide/vue'
import { useCompetition } from '@/composables/useCompetition'
import { oncePerPerson, useFollowing } from '@/composables/useFollowing'
import { injectInfoHeaderSetter } from '@/composables/useScrolledPast'
import { usePageTitle } from '@/composables/usePageTitle'
import DrawDialog from '@/components/DrawDialog.vue'
import Skeleton from '@/components/Skeleton.vue'
import StaffAvatar from '@/components/StaffAvatar.vue'
import StaffDialog from '@/components/StaffDialog.vue'
import { dances as eventDances, dayLabel, days, getScheduleDanceName, platformLabel, slugline } from '@/lib/schedule'
import { findGroupDancers, getOrdinalSuffix, isPosted } from '@/lib/results'
import { sanitizeRichText } from '@/lib/sanitize'
import { clockMinutes } from '@/lib/scheduleProgress'
import {
  staffMemberName,
  type EnrichedDancer,
  type EnrichedGroup,
  type ScheduleDance,
  type StaffMember,
} from '@/types/competition'

// One event in the schedule: each dance, then each platform with its judges
// and the age groups in the order they'll dance. Your dancers are called out
// with where they fall in the dancing order; tapping a group always shows
// the full order, and a Results pill goes to the placings once posted.
const route = useRoute()
const setHeader = injectInfoHeaderSetter()
const {
  competitionId,
  competition,
  schedule,
  platforms,
  groups,
  dancers,
  dances,
  staff,
  results,
  draws,
  loadSchedule,
  loadDancers,
  loadResults,
  loadStaff,
} = useCompetition()
const following = useFollowing()

onMounted(() => Promise.all([loadSchedule(), loadDancers(), loadResults(), loadStaff()]))

const day = computed(() => schedule.value?.days?.[String(route.params.dayId)] ?? null)
const block = computed(() => day.value?.blocks?.[String(route.params.blockId)] ?? null)
const event = computed(() => block.value?.events?.[String(route.params.eventId)] ?? null)

usePageTitle(() => [event.value?.name, competition.value?.name])

// The time, once and as the organisers wrote it (never reformatted): the
// event's own, when its description leads with one ("9:45 am"), shown as
// they wrote it under the title; otherwise the session's ("8:30 am").
const ownTime = computed(() => clockMinutes(slugline(event.value?.description)) != null)
const blockTime = computed(() => (ownTime.value ? null : slugline(block.value?.description)))
// The day only when there are several (a single day stays out of sight, as on Schedule).
const dayName = computed(() => {
  const all = days(schedule.value)
  const i = all.findIndex((d) => d.id === String(route.params.dayId))
  return all.length > 1 && i >= 0 ? dayLabel(all[i], i) : null
})

interface GroupRow {
  group: EnrichedGroup
  count: number
  mine: Array<{ dancer: EnrichedDancer; color: string | null; pos: number | null }>
  posted: boolean
}
interface PlatformRow {
  id: string
  name: string
  judges: StaffMember[]
  groups: GroupRow[]
}

const posted = (groupId: string, danceId: string) => isPosted(results.value?.[groupId]?.[danceId])

function drawPos(d: EnrichedDancer, groupId: string, danceId: string) {
  const list = draws.value?.[groupId]?.[danceId]
  if (!Array.isArray(list) || d.number == null) return null
  const i = list.map(String).indexOf(String(d.number))
  return i >= 0 ? i + 1 : null
}

function platformsFor(sd: ScheduleDance): PlatformRow[] {
  const judgeById = new Map(staff.value.map((m) => [m.id, m]))
  const groupById = new Map(groups.value.map((g) => [g.id, g]))
  return platforms.value
    .map((p) => {
      const slot = sd.platforms?.[p.id]
      if (!slot) return null
      const rows = (slot.orderedGroupIds ?? [])
        .map((id) => groupById.get(id))
        .filter((g): g is EnrichedGroup => !!g)
        .map<GroupRow>((g) => {
          const all = findGroupDancers(g.id, dancers.value)
          return {
            group: g,
            count: all.length,
            posted: !!sd.danceId && posted(g.id, sd.danceId),
            mine: oncePerPerson(all.filter((d) => following.isFollowing(d)))
              .map((d) => ({
                dancer: d,
                color: following.colorFor(d.dancerId),
                pos: sd.danceId ? drawPos(d, g.id, sd.danceId) : null,
              })),
          }
        })
      const judges = (slot.orderedJudgeIds ?? [])
        .map((id) => judgeById.get(id))
        .filter((j): j is StaffMember => !!j)
      if (!rows.length && !judges.length) return null
      return { id: p.id, name: platformLabel(p.name) || 'Platform', judges, groups: rows }
    })
    .filter((x): x is PlatformRow => !!x)
}

const sections = computed(() =>
  (event.value ? eventDances({ dances: event.value.dances }) : []).map((sd) => {
    const dance = dances.value.find((d) => d.id === sd.danceId)
    // Organisers sometimes name a slot just "1"; prefer the real dance name.
    const custom = sd.name?.trim() && !/^\d+$/.test(sd.name.trim()) ? sd.name.trim() : null
    return {
      sd,
      name: dance?.fullName || custom || null,
      realName: custom && dance?.name && custom !== dance.name && custom !== dance.fullName ? custom : null,
      platforms: sd.danceId ? platformsFor(sd) : [],
    }
  }),
)

const drawGroup = ref<EnrichedGroup | null>(null)
const drawDance = ref<ScheduleDance | null>(null)
const drawDanceName = computed(() => (drawDance.value ? getScheduleDanceName(drawDance.value, dances.value) : ''))
const activeJudge = ref<StaffMember | null>(null)
// Both sheets grow out of the row or name that opened them (lib/morph).
const drawSheet = useMorph()
const judgeSheet = useMorph()
function openDraw(e: MouseEvent, group: EnrichedGroup, dance: ScheduleDance) {
  drawGroup.value = group
  drawDance.value = dance
  drawSheet.show(e)
}
function openJudge(e: MouseEvent, judge: StaffMember) {
  activeJudge.value = judge
  judgeSheet.show(e)
}

// Why you tapped a judge: where they're judging in this event, and what.
// "Platform A · Highland Fling, Sword Dance".
const judging = computed(() => {
  const j = activeJudge.value
  if (!j) return null
  const byPlatform = new Map<string, string[]>()
  sections.value.forEach((s, i) => {
    for (const p of s.platforms) {
      if (!p.judges.some((x) => x.id === j.id)) continue
      byPlatform.set(p.name, [...(byPlatform.get(p.name) ?? []), s.name ?? `Dance ${i + 1}`])
    }
  })
  return [...byPlatform].map(([platform, names]) => `${platform} · ${names.join(', ')}`).join('; ') || null
})
</script>

<template>
  <article class="space-y-4">
    <!-- The page's shape, if it's slow to come (skeletons wait 150ms). -->
    <div v-if="schedule === null" class="space-y-4" aria-busy="true">
      <span class="sr-only">Loading…</span>
      <div class="space-y-2"><Skeleton class="h-4 w-1/3" /><Skeleton class="h-8 w-1/2" /></div>
      <Skeleton class="h-72 w-full rounded-2xl!" />
    </div>
    <p v-else-if="!event" class="text-muted-foreground py-6 text-base">
      This part of the schedule has changed. Go back to Schedule to see the latest.
    </p>

    <template v-else>
      <header :ref="setHeader" class="space-y-1">
        <p class="text-muted-foreground text-sm font-medium">
          {{ [dayName, block?.name].filter(Boolean).join(' · ') }}
        </p>
        <h1 class="text-display">{{ event.name || 'Event' }}</h1>
        <p v-if="blockTime" class="flex items-center gap-1.5 text-base"><Clock class="text-muted-foreground size-4" /> {{ blockTime }}</p>
        <div
          v-if="event.description"
          class="text-base [&_a]:text-primary [&_a]:underline"
          v-html="sanitizeRichText(event.description)"
        />
      </header>

      <p v-if="!sections.length" class="text-muted-foreground text-base">Nothing is scheduled in this part yet.</p>

      <!-- Each dance: its name as a heading, then one card of platforms. -->
      <section v-for="(s, i) in sections" :key="s.sd.id" class="space-y-2 pt-2">
        <div class="space-y-0.5">
          <h2 class="text-heading">{{ s.name ?? `Dance ${i + 1}` }}</h2>
          <p v-if="s.realName" class="text-muted-foreground text-sm">{{ s.realName }}</p>
          <div
            v-if="s.sd.description"
            class="text-muted-foreground text-callout [&_a]:text-primary [&_a]:underline"
            v-html="sanitizeRichText(s.sd.description)"
          />
        </div>

        <div class="surface divide-y overflow-hidden rounded-2xl">
          <p v-if="s.sd.danceId && !s.platforms.length" class="text-muted-foreground px-4 py-3 text-base">
            Platforms haven’t been assigned yet.
          </p>

          <div v-for="p in s.platforms" :key="p.id">
            <div class="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pt-3 pb-2">
              <h3 class="text-callout font-semibold">{{ p.name }}</h3>
              <!-- Judges: chips that open each one's sheet. -->
              <div v-if="p.judges.length" class="flex flex-wrap gap-1.5">
                <button
                  v-for="j in p.judges"
                  :key="j.id"
                  type="button"
                  class="press bg-muted text-callout relative flex h-9 items-center gap-2 rounded-full pr-3 pl-1 font-medium after:absolute after:inset-x-0 after:-inset-y-1"
                  @click="openJudge($event, j)"
                >
                  <StaffAvatar :member="j" :size="28" />
                  {{ staffMemberName(j) || 'Judge' }}
                </button>
              </div>
            </div>
            <ul class="rows-inset">
              <li v-for="g in p.groups" :key="g.group.id" class="relative">
                <!-- The whole row opens the order (its tint spans it); a posted
                     age group's Results pill sits on top, at the right. -->
                <button
                  type="button"
                  :class="['press-row focus-inset relative flex min-h-14 w-full items-center gap-3 py-2 pl-4 text-left', g.posted ? 'pr-28' : 'pr-4']"
                  :style="g.mine.length ? { '--dc': g.mine[0].color ?? 'var(--primary)' } : undefined"
                  @click="openDraw($event, g.group, s.sd)"
                >
                  <span v-if="g.mine.length" class="sash absolute inset-y-0 left-0 w-1.5" aria-hidden="true" />
                  <span class="min-w-0 flex-1">
                    <span class="block text-base font-semibold">{{ g.group.fullName }}</span>
                    <span class="text-muted-foreground block text-sm">{{ g.count }} dancers</span>
                    <MyDancerLine
                      v-for="m in g.mine"
                      :key="m.dancer.id"
                      :color="m.color"
                      :name="m.dancer.firstName ?? ''"
                      :details="[`#${m.dancer.number}`, m.pos ? `${m.pos}${getOrdinalSuffix(m.pos)} to dance` : null]"
                      class="mt-1"
                    />
                  </span>
                  <span v-if="!g.posted" class="text-primary text-footnote shrink-0 font-medium">Dancing order</span>
                </button>
                <!-- Once posted, the placings are a tap away; the row still opens the order. -->
                <RouterLink
                  v-if="g.posted"
                  :to="{ name: 'competition.group', params: { competitionId, groupId: g.group.id }, hash: `#dance-${s.sd.danceId}` }"
                  :aria-label="`${g.group.fullName} results`"
                  class="press bg-done text-done-foreground text-footnote absolute top-1/2 right-3 flex h-8 -translate-y-1/2 items-center gap-1 rounded-full pr-3 pl-2 font-semibold after:absolute after:-inset-1.5"
                >
                  <Check class="size-4" stroke-width="2.75" /> Results
                </RouterLink>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </template>

    <DrawDialog
      :group="drawGroup"
      :dance="drawDance"
      :event-name="event?.name ?? undefined"
      :dance-name="drawDanceName"
      :morph="drawSheet"
      @close="drawSheet.hide().then(() => (drawGroup = null))"
    />
    <StaffDialog
      :member="activeJudge"
      :judging="judging"
      :morph="judgeSheet"
      @close="judgeSheet.hide().then(() => (activeJudge = null))"
    />
  </article>
</template>
