<script setup lang="ts">
import { useMorph } from '@/lib/morph'
import MyDancerLine from '@/components/MyDancerLine.vue'
import { shortName } from '@/lib/entries'
import { groupColor } from '@/lib/groupColor'
import OnNowAsk, { type OnNowQuestion } from '@/components/OnNowAsk.vue'
import OnNowLine from '@/components/OnNowLine.vue'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { Check, ChevronRight, Clock } from '@lucide/vue'
import { useCompetition } from '@/composables/useCompetition'
import { useCompetitionProgress } from '@/composables/useCompetitionProgress'
import { useOnNow } from '@/composables/useOnNow'
import { usePageShowing } from '@/composables/usePageShowing'
import { useAuthStore } from '@/stores/auth'
import { askIndex, lineIndex, markAsked, platformTurns, turnKey, wasAsked, type Turn } from '@/lib/onNow'
import { oncePerPerson, useFollowing } from '@/composables/useFollowing'
import { injectInfoHeaderSetter } from '@/composables/useScrolledPast'
import { usePageTitle } from '@/composables/usePageTitle'
import DrawDialog from '@/components/DrawDialog.vue'
import Skeleton from '@/components/Skeleton.vue'
import PlatformSwiper from '@/components/PlatformSwiper.vue'
import StaffAvatar from '@/components/StaffAvatar.vue'
import StaffDialog from '@/components/StaffDialog.vue'
import { dances as eventDances, dayLabel, days, getScheduleDanceName, platformLabel, slugline } from '@/lib/schedule'
import { findGroupDancers, isPosted } from '@/lib/results'
import { sanitizeRichText } from '@/lib/sanitize'
import { heroTitle } from '@/lib/heroTitle'
import { clockMinutes } from '@/lib/scheduleProgress'
import { isDanced, trophyEventEntrants, turnResultId } from '@/lib/trophyEvents'
import {
  staffMemberName,
  type EnrichedDancer,
  type EnrichedGroup,
  type EnrichedTrophyEvent,
  type ScheduleDance,
  type StaffMember,
} from '@/types/competition'

// One event in the schedule: each dance, then each platform with its judges
// and the age groups in the order they'll dance. Your dancers are called out
// with where they fall in the dancing order; tapping a group always shows
// the full order, and a Results link goes to the placings once posted. A
// trophy event danced on its own (a Trophy Fling) is a row among them, and
// opens its own page instead.
const route = useRoute()
const setHeader = injectInfoHeaderSetter()
const {
  competitionId,
  competition,
  schedule,
  platforms,
  groups,
  trophyEvents,
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
  /** An age group or a trophy event's id: one turn. */
  id: string
  /** This turn as On now names it (lib/onNow). */
  turn: string
  label: string
  group: EnrichedGroup | null
  /** Set for a trophy event's turn (then `group` is null). */
  trophyEvent: EnrichedTrophyEvent | null
  /** null while only some dance a trophy event and they aren't picked yet. */
  count: number | null
  mine: Array<{ dancer: EnrichedDancer; color: string | null; pos: number | null }>
  posted: boolean
  /** Danced (a group after it on the platform is posted), its placings not in yet. */
  waiting: boolean
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

// The danced trophy events: their ids sit among a platform's age groups.
const trophyEventById = computed(() => new Map(trophyEvents.value.filter(isDanced).map((a) => [a.id, a])))
const trophyEventIds = computed(() => new Set(trophyEventById.value.keys()))

function platformsFor(sd: ScheduleDance): PlatformRow[] {
  const judgeById = new Map(staff.value.map((m) => [m.id, m]))
  const groupById = new Map(groups.value.map((g) => [g.id, g]))
  return platforms.value
    .map((p) => {
      const slot = sd.platforms?.[p.id]
      if (!slot) return null
      const rows = (slot.orderedGroupIds ?? [])
        .map<GroupRow | null>((id) => {
          const g = groupById.get(id)
          const trophyEvent = g ? undefined : trophyEventById.value.get(id)
          if (!g && !trophyEvent) return null
          const all = g ? findGroupDancers(g.id, dancers.value) : trophyEventEntrants(trophyEvent!, dancers.value, results.value)
          return {
            id,
            turn: turnKey(String(route.params.dayId), String(route.params.blockId), String(route.params.eventId), sd.id, id),
            label: g?.fullName ?? trophyEvent!.fullName,
            group: g ?? null,
            trophyEvent: trophyEvent ?? null,
            count: all.length,
            posted: !!sd.danceId && posted(id, turnResultId(id, sd.danceId, trophyEventIds.value)),
            waiting: false,
            mine: oncePerPerson(all.filter((d) => following.isFollowing(d)))
              .map((d) => ({
                dancer: d,
                color: following.colorFor(following.followedIn(d)),
                pos: sd.danceId && g ? drawPos(d, g.id, sd.danceId) : null,
              })),
          }
        })
        .filter((r): r is GroupRow => !!r)
      rows.forEach((r, i) => (r.waiting = !r.posted && rows.slice(i + 1).some((later) => later.posted)))
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
      platforms: (sd.danceId ? platformsFor(sd) : []).map((p) => {
        // Your dancers on it, for the dots on the peek when it's further along.
        const ids = new Set<string>()
        const dots = p.groups.flatMap((g) => g.mine).filter((m) => !ids.has(m.dancer.id) && ids.add(m.dancer.id))
        return { ...p, dots: dots.map((m) => ({ id: m.dancer.id, color: m.color })) }
      }),
    }
  }),
)

// On now (ADR 0020): on the competition's day, a pink line on the age group
// people say is dancing on each platform, and once per group a question about
// the next one, for the platform you're looking at. Signed in to answer.
const auth = useAuthStore()
const progress = useCompetitionProgress()
const showing = usePageShowing()
const isToday = computed(() => progress.value.dayOffset.get(String(route.params.dayId)) === 0)
const onNow = useOnNow(competitionId, isToday)
const groupIds = computed(() => new Set(groups.value.map((g) => g.id)))
const postedTurn = (t: Turn) => !!t.danceId && posted(t.id, turnResultId(t.id, t.danceId, trophyEventIds.value))

// Each platform's running order for the whole day, and where its line is.
const onNowPlatforms = computed(() => {
  if (!isToday.value || !day.value) return []
  const dayWithId = { ...day.value, id: String(route.params.dayId) }
  const known = (id: string) => groupIds.value.has(id) || trophyEventIds.value.has(id)
  return platforms.value.map((p) => {
    const turns = platformTurns(dayWithId, p.id, known)
    const line = onNow.lineFor(p.id)
    const at = lineIndex(line, turns, postedTurn, onNow.now.value)
    return { platform: p, turns, line: at != null ? { turn: turns[at].key, at: line!.at } : null, ask: askIndex(at, turns, postedTurn) }
  })
})
const lineOn = (platformId: string, turn: string) => {
  const l = onNowPlatforms.value.find((x) => x.platform.id === platformId)?.line
  return l?.turn === turn ? l : null
}

// One question per visit to the page: once its card has folded away, no more.
const askDone = ref(false)
// The question answered on this visit, for Undo.
const asked = ref<{ platformId: string; turn: string } | null>(null)
const resetAsk = () => {
  askDone.value = false
  asked.value = null
}
watch(showing, (on) => on && resetAsk())
watch(() => route.params.eventId, resetAsk)

// The platform in view in each dance (its first until you swipe).
const activePlatform = reactive<Record<string, string>>({})
const question = computed<(OnNowQuestion & { platformId: string; turn: string }) | null>(() => {
  if (!auth.isSignedIn || !showing.value || askDone.value || asked.value) return null
  const eventId = String(route.params.eventId)
  const candidates = onNowPlatforms.value
    .map((x) => ({ ...x, target: x.ask != null ? x.turns[x.ask] : null }))
    .filter((x) => x.target && x.target.eventId === eventId && !wasAsked(competitionId.value, x.platform.id, x.target.key))
  const inView = (x: (typeof candidates)[number]) => {
    const s = sections.value.find((s) => s.sd.id === x.target!.scheduleDanceId)
    return (activePlatform[s?.sd.id ?? ''] ?? s?.platforms[0]?.id) === x.platform.id
  }
  const pick = candidates.find(inView) ?? candidates[0]
  if (!pick?.target) return null
  const t = pick.target
  const section = sections.value.find((s) => s.sd.id === t.scheduleDanceId)
  const row = section?.platforms.find((p) => p.id === pick.platform.id)?.groups.find((g) => g.id === t.id)
  return {
    id: `${pick.platform.id}|${t.key}`,
    platformId: pick.platform.id,
    turn: t.key,
    label: row?.label ?? 'this age group',
    detail: [section?.name, platformLabel(pick.platform.name) || 'Platform'].filter(Boolean).join(' · '),
  }
})
// Asked once: shown is asked, whatever the answer.
watch(question, (q) => q && markAsked(competitionId.value, q.platformId, q.turn))
function answerQuestion(vote: 'yes' | 'no') {
  const q = question.value ?? asked.value
  if (!q) return
  asked.value = { platformId: q.platformId, turn: q.turn }
  onNow.answer(q.platformId, q.turn, vote)
}
function undoQuestion() {
  if (asked.value) onNow.answer(asked.value.platformId, asked.value.turn, 'undo')
}

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
  <article class="section-breaks space-y-4">
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
      <header :ref="setHeader" class="space-y-1 pt-0.5">
        <h1 :class="heroTitle(event.name)">{{ event.name || 'Event' }}</h1>
        <p class="text-muted-foreground flex items-center gap-1.5 text-base">
          <Clock v-if="blockTime" class="size-4 shrink-0" /> {{ [dayName, block?.name, blockTime].filter(Boolean).join(' · ') }}
        </p>
        <div
          v-if="event.description"
          class="text-base [&_a]:text-primary [&_a]:underline"
          v-html="sanitizeRichText(event.description)"
        />
      </header>

      <p v-if="!sections.length" class="text-muted-foreground text-base">Nothing is scheduled in this part yet.</p>

      <!-- Each dance: its name as a heading, then its platforms side by side
           (they dance at the same time), each over its age groups in order. -->
      <section v-for="(s, i) in sections" :key="s.sd.id" class="pt-2">
        <PlatformSwiper :platforms="s.platforms" @active="activePlatform[s.sd.id] = $event">
          <template #head>
            <div class="space-y-0.5 pb-2">
              <h2 class="text-section" :data-section="s.name ?? `Dance ${i + 1}`">{{ s.name ?? `Dance ${i + 1}` }}</h2>
              <p v-if="s.realName" class="text-muted-foreground text-sm">{{ s.realName }}</p>
              <div
                v-if="s.sd.description"
                class="text-muted-foreground text-callout [&_a]:text-primary [&_a]:underline"
                v-html="sanitizeRichText(s.sd.description)"
              />
            </div>
          </template>
          <template #default="{ platform: p }">
          <!-- The platform and its judges in one line over its age groups
               ("Platform 1 · Mary Munro"); each judge opens their sheet. -->
          <div class="flex items-start gap-x-1.5 px-4 pb-1">
            <h3 class="text-muted-foreground text-callout flex h-8 shrink-0 items-center font-semibold">{{ p.name }}</h3>
            <template v-if="p.judges.length">
              <span class="text-muted-foreground text-callout flex h-8 items-center" aria-hidden="true">·</span>
              <!-- (More than fit wrap under the first judge.) -->
              <span class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                <button
                  v-for="j in p.judges"
                  :key="j.id"
                  type="button"
                  class="press text-callout relative flex h-8 items-center gap-1.5 rounded-full font-medium after:absolute after:-inset-x-1 after:-inset-y-1.5"
                  @click="openJudge($event, j)"
                >
                  <StaffAvatar :member="j" :size="20" />
                  {{ staffMemberName(j) || 'Judge' }}
                </button>
              </span>
            </template>
          </div>
          <ul class="rows-engraved [--inset:1rem] [--inset-end:1rem]">
            <li v-for="g in p.groups" :key="g.id" class="relative">
              <OnNowLine
                v-if="lineOn(p.id, g.turn)"
                :label="g.label"
                :at="lineOn(p.id, g.turn)!.at"
                :now="onNow.now.value"
                :can-answer="auth.isSignedIn"
                @answer="onNow.answer(p.id, g.turn, $event)"
              />
              <!-- The whole row opens the order (its tint spans it); a posted
                   age group's Results link sits on top, at the right. A trophy
                   event's row opens its page, which has its dancers and placings. -->
              <component
                :is="g.trophyEvent ? RouterLink : 'button'"
                v-bind="g.trophyEvent ? { to: { name: 'competition.trophyEvent', params: { competitionId, trophyEventId: g.id } } } : { type: 'button' }"
                :class="['press-row focus-inset relative isolate flex min-h-14 w-full items-center gap-3 py-2 pl-4 text-left', g.posted && !g.trophyEvent ? 'pr-24' : 'pr-4']"
                :style="g.mine.length ? { '--dc': groupColor(g.mine.map((m) => m.color)) } : undefined"
                @click="g.group && openDraw($event, g.group, s.sd)"
              >
                <!-- An age group of yours is the row itself: its edge and wash in their colours. -->
                <span v-if="g.mine.length" class="dancer-sash" aria-hidden="true" />
                <span class="min-w-0 flex-1">
                  <span class="block text-base font-semibold">{{ g.label }}</span>
                  <span v-if="g.count != null" class="text-muted-foreground block text-sm">{{ g.count }} dancers</span>
                  <span v-else class="text-muted-foreground block text-sm">Dancers to be picked</span>
                  <!-- The row is where they are, so each is named (a summary
                       like "Your 3 dancers" is for pills, on things above). -->
                  <MyDancerLine v-for="m in g.mine" :key="m.dancer.id" :color="m.color" :name="shortName(m.dancer)" class="mt-1" />
                </span>
                <span v-if="g.waiting" class="text-muted-foreground text-footnote shrink-0 font-medium">Results to come</span>
                <span v-else-if="g.trophyEvent && g.posted" class="text-done-foreground text-footnote flex shrink-0 items-center gap-1 font-semibold">
                  <Check class="size-4" stroke-width="2.75" /> Results
                </span>
                <ChevronRight v-else-if="g.trophyEvent" class="text-muted-foreground size-5 shrink-0" />
                <span v-else-if="!g.posted" class="text-primary text-footnote shrink-0 font-medium">Dancing order</span>
              </component>
              <!-- Once posted, the placings are a tap away; the row still opens the order. -->
              <RouterLink
                v-if="g.posted && g.group"
                :to="{ name: 'competition.group', params: { competitionId, groupId: g.group.id }, hash: `#dance-${s.sd.danceId}` }"
                :aria-label="`${g.label} results`"
                class="press text-done-foreground text-footnote absolute top-1/2 right-4 flex h-8 -translate-y-1/2 items-center gap-1 rounded-full font-semibold after:absolute after:-inset-x-3 after:-inset-y-1.5"
              >
                <Check class="size-4" stroke-width="2.75" /> Results
              </RouterLink>
            </li>
          </ul>
          </template>
        </PlatformSwiper>
        <p v-if="s.sd.danceId && !s.platforms.length" class="text-muted-foreground pt-2 text-base">
          Platforms haven’t been assigned yet.
        </p>
      </section>
    </template>

    <OnNowAsk v-if="showing" :question="question" @answer="answerQuestion" @undo="undoQuestion" @done="askDone = true" />
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
