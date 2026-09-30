<script setup lang="ts">
import { useMorph } from '@/lib/morph'
import MyDancerLine from '@/components/MyDancerLine.vue'
import ResultsMark from '@/components/ResultsMark.vue'
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { ChevronRight, Clock } from '@lucide/vue'
import { useCompetition } from '@/composables/useCompetition'
import { useFollowing } from '@/composables/useFollowing'
import { injectInfoHeaderSetter } from '@/composables/useScrolledPast'
import { usePageTitle } from '@/composables/usePageTitle'
import DrawDialog from '@/components/DrawDialog.vue'
import StaffDialog from '@/components/StaffDialog.vue'
import { dances as eventDances, getScheduleDanceName, slugline } from '@/lib/schedule'
import { findGroupDancers, getOrdinalSuffix } from '@/lib/results'
import { sanitizeRichText } from '@/lib/sanitize'
import {
  staffMemberName,
  type EnrichedDancer,
  type EnrichedGroup,
  type ScheduleDance,
  type StaffMember,
} from '@/types/competition'

// One event in the schedule: each dance, then each platform with its judges
// and the age groups in the order they'll dance. Your dancers are called out
// with where they fall in the dancing order; tapping a group shows the full
// order. Results link straight through once posted.
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

const blockTime = computed(() => slugline(block.value?.description))

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

function isPosted(groupId: string, danceId: string) {
  const raw = results.value?.[groupId]?.[danceId]
  return raw === false || (Array.isArray(raw) && raw.length > 0)
}

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
            posted: !!sd.danceId && isPosted(g.id, sd.danceId),
            mine: all
              .filter((d) => following.isFollowing(d))
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
      return { id: p.id, name: p.name || 'Platform', judges, groups: rows }
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
</script>

<template>
  <article class="space-y-4">
    <p v-if="schedule === null" class="text-muted-foreground py-6 text-base">Loading…</p>
    <p v-else-if="!event" class="text-muted-foreground py-6 text-base">
      This part of the schedule has changed. Go back to Schedule to see the latest.
    </p>

    <template v-else>
      <header :ref="setHeader" class="space-y-1">
        <p class="text-muted-foreground flex items-center gap-1.5 text-sm font-bold">
          <Clock class="size-4" />
          {{ [day?.name, block?.name, blockTime].filter(Boolean).join(' · ') }}
        </p>
        <h1 class="text-display">{{ event.name || 'Event' }}</h1>
        <div
          v-if="event.description"
          class="text-muted-foreground text-base [&_a]:text-primary [&_a]:underline"
          v-html="sanitizeRichText(event.description)"
        />
      </header>

      <p v-if="!sections.length" class="text-muted-foreground text-base">Nothing is scheduled in this part yet.</p>

      <section
        v-for="(s, i) in sections"
        :key="s.sd.id"
        class="bg-card overflow-hidden rounded-2xl border shadow-sm"
      >
        <header class="flex items-center justify-between gap-2 border-b py-2.5 pr-2.5 pl-4">
          <span class="min-w-0">
            <span class="text-heading block">{{ s.name ?? `Dance ${i + 1}` }}</span>
            <span v-if="s.realName" class="text-muted-foreground block text-sm">{{ s.realName }}</span>
          </span>
        </header>

        <div
          v-if="s.sd.description"
          class="border-b px-4 py-3 text-base [&_a]:text-primary [&_a]:underline"
          v-html="sanitizeRichText(s.sd.description)"
        />

        <p v-if="s.sd.danceId && !s.platforms.length" class="text-muted-foreground px-4 py-3 text-base">
          Platforms haven’t been assigned yet.
        </p>

        <div v-for="p in s.platforms" :key="p.id" class="border-t first:border-t-0">
          <div class="bg-muted/60 flex flex-wrap items-baseline justify-between gap-x-3 px-4 py-2">
            <span class="text-base font-extrabold">Platform {{ p.name }}</span>
            <span v-if="p.judges.length" class="text-muted-foreground text-sm">
              <template v-for="(j, ji) in p.judges" :key="j.id">
                <button type="button" class="hover:text-foreground font-semibold underline-offset-2 hover:underline" @click="openJudge($event, j)">
                  {{ staffMemberName(j) || 'Judge' }}</button><span v-if="ji < p.judges.length - 1">, </span>
              </template>
            </span>
          </div>
          <ul class="divide-y">
            <li v-for="g in p.groups" :key="g.group.id">
              <component
                :is="g.posted ? RouterLink : 'button'"
                v-bind="
                  g.posted
                    ? { to: { name: 'competition.group', params: { competitionId, groupId: g.group.id }, hash: `#dance-${s.sd.danceId}` } }
                    : { type: 'button' }
                "
                class="relative flex min-h-14 w-full items-center gap-3 py-2 pr-2 pl-4 text-left hover:bg-accent"
                :style="g.mine.length ? { '--dc': g.mine[0].color ?? 'var(--primary)' } : undefined"
                @click="!g.posted && openDraw($event, g.group, s.sd)"
              >
                <span v-if="g.mine.length" class="sash absolute inset-y-0 left-0 w-1.5" aria-hidden="true" />
                <span class="min-w-0 flex-1">
                  <span class="block text-base font-bold">{{ g.group.fullName }}</span>
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
                <ResultsMark v-if="g.posted" :posted="1" :total="1" />
                <span v-else class="text-primary shrink-0 text-sm font-bold">Order</span>
                <ChevronRight class="text-muted-foreground size-5 shrink-0" />
              </component>
            </li>
          </ul>
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
    <StaffDialog :member="activeJudge" :morph="judgeSheet" @close="judgeSheet.hide().then(() => (activeJudge = null))" />
  </article>
</template>
