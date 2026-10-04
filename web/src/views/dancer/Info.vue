<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { ChevronRight } from '@lucide/vue'
import { useDancerProfile } from '@/composables/useDancerProfile'
import { useDancerCards } from '@/composables/useDancerCards'
import { useFollowing } from '@/composables/useFollowing'
import { useCrisp } from '@/composables/useCrisp'
import { useHiddenAs } from '@/composables/useHiddenAs'
import { injectInfoHeaderSetter } from '@/composables/useScrolledPast'
import Avatar from '@/components/Avatar.vue'
import DancerDayCard from '@/components/DancerDayCard.vue'
import DateTile from '@/components/DateTile.vue'
import FollowButton from '@/components/FollowButton.vue'
import Medal from '@/components/Medal.vue'
import NumberCard from '@/components/NumberCard.vue'
import Skeleton from '@/components/Skeleton.vue'
import VisibilityChip from '@/components/VisibilityChip.vue'
import { fetchEntrySummary, type EntrySummary } from '@/lib/entrySummary'
import { parseDate } from '@/lib/format'
import { profileColumns, profileHeader } from '@/lib/profile'
import { useMeStore } from '@/stores/me'
import type { Competition } from '@/types/competition'

// A dancer across every competition. Their number is different at each one,
// so it's shown per competition, never as who they are.
const setHeader = injectInfoHeaderSetter()
const route = useRoute()
const me = useMeStore()
const profile = useDancerProfile()
const following = useFollowing()
const crisp = useCrisp()
const hiddenAs = useHiddenAs()

const dancerId = computed(() => String(route.params.dancerId ?? ''))
const name = computed(() => profile.displayName.value)
const color = computed(() => following.colorFor(dancerId.value))
const subtitle = computed(() => {
  const n = profile.totalComps.value
  const since = profile.firstSeenDate.value?.getFullYear()
  const record = n ? `${n} competition${n === 1 ? '' : 's'}${since ? ` since ${since}` : ''}` : null
  return [profile.location.value, record].filter(Boolean).join(' · ')
})

const person = computed(() => (dancerId.value ? [{ id: dancerId.value, name: name.value }] : []))
const { cards } = useDancerCards(person)
const focus = computed(() => cards.value[0]?.focus ?? null)
const focusLabel = computed(() => {
  const f = focus.value
  if (!f) return ''
  return f.phase === 'today' ? `Today at ${f.competition.name}` : f.phase === 'before' ? `Next: ${f.competition.name}` : `Last: ${f.competition.name}`
})

// One row per competition (entries in two age groups share a number), a
// year at a time, most recent first. Today's is the card above, not a row.
interface Row {
  competitionId: string
  competition: Competition
  numbers: number[]
  entryIds: string[]
}
const rows = computed<Row[]>(() => {
  const map = new Map<string, Row>()
  for (const a of profile.appearances.value) {
    const cid = a.raw.competitionId
    if (!cid || !a.competition) continue
    const r = map.get(cid) ?? { competitionId: cid, competition: a.competition, numbers: [], entryIds: [] }
    if (a.raw.number != null && !r.numbers.includes(Number(a.raw.number))) r.numbers.push(Number(a.raw.number))
    if (a.raw.dancerId && !r.entryIds.includes(a.raw.dancerId)) r.entryIds.push(a.raw.dancerId)
    map.set(cid, r)
  }
  return [...map.values()]
})
// Their day as a card only while it's to come or on; once it's over, that
// competition is just the top of the list (its rosettes named there), not
// shown twice.
const showFocus = computed(() => !!focus.value?.days.length && focus.value.phase !== 'after')
const byYear = computed(() => {
  const today = showFocus.value ? focus.value!.competitionId : null
  const out = new Map<string, Row[]>()
  for (const r of rows.value) {
    if (r.competitionId === today) continue
    const y = r.competition.date ? String(parseDate(r.competition.date).getFullYear()) : 'Date to be announced'
    out.set(y, [...(out.get(y) ?? []), r])
  }
  return [...out.entries()]
})

const summaries = ref<Record<string, EntrySummary[]>>({})
watch(
  rows,
  async (list) => {
    for (const r of list.slice(0, 20)) {
      if (summaries.value[r.competitionId]) continue
      const got = await Promise.all(r.entryIds.map((id) => fetchEntrySummary(r.competitionId, id)))
      summaries.value = { ...summaries.value, [r.competitionId]: got.filter((x): x is EntrySummary => !!x) }
    }
  },
  { immediate: true },
)

function medals(cid: string) {
  const list = summaries.value[cid] ?? []
  const overall = list.map((s) => s.overall).find(Boolean)
  const best = list.flatMap((s) => s.placings).sort((a, b) => a.place - b.place).slice(0, 3)
  return { overall, best, groups: list.map((s) => s.groupName).filter(Boolean) as string[] }
}
</script>

<template>
  <article :class="profileColumns">
    <div :class="profileHeader">
      <header :ref="setHeader" class="flex flex-col items-center gap-4">
        <Avatar :name="name" :image="profile.image.value" :color="color" size="xl" />
        <div class="min-w-0">
          <h1 class="text-display">{{ name }}</h1>
          <p v-if="subtitle" class="text-muted-foreground text-callout mt-1">{{ subtitle }}</p>
        </div>
      </header>
      <FollowButton :dancer="{ dancerId, fullName: name }" size="block" class="w-auto! min-w-48" />
    </div>

    <div class="space-y-5">
      <section v-if="focus && showFocus" class="space-y-2">
        <h2 :class="['text-heading', focus.phase === 'today' && 'text-live']">{{ focusLabel }}</h2>
        <DancerDayCard :days="focus.days" :competition-id="focus.competitionId" :color="color" size="lg" />
      </section>

      <div v-if="profile.loading.value && !rows.length" class="surface rows-inset overflow-hidden rounded-2xl [--inset:4.5rem]" aria-busy="true">
        <span class="sr-only">Loading competitions…</span>
        <div v-for="i in 3" :key="i" class="flex min-h-16 items-center gap-3 py-2.5 pr-3 pl-4">
          <Skeleton class="h-14 w-11 shrink-0 rounded-xl!" />
          <div class="flex-1 space-y-2">
            <Skeleton class="h-4 w-3/4" />
            <Skeleton class="h-3.5 w-1/3" />
          </div>
        </div>
      </div>
      <section v-if="byYear.length" class="space-y-2">
        <h2 class="text-heading flex items-baseline justify-between">
          {{ showFocus ? 'Other competitions' : 'Competitions' }}
          <span class="text-muted-foreground text-sm font-normal tabular-nums">{{ byYear.reduce((n, [, l]) => n + l.length, 0) }}</span>
        </h2>
        <template v-for="[year, list] in byYear" :key="year">
          <h3 class="text-heading flex items-baseline justify-between pt-2">
            {{ year }} <span class="text-muted-foreground text-sm font-normal tabular-nums">{{ list.length }}</span>
          </h3>
          <ul class="surface rows-inset overflow-hidden rounded-2xl [--inset:4.5rem]">
            <li v-for="r in list" :key="r.competitionId">
              <RouterLink
                :to="
                  r.entryIds[0]
                    ? { name: 'competition.dancer', params: { competitionId: r.competitionId, dancerId: r.entryIds[0] } }
                    : { name: 'competition.info', params: { competitionId: r.competitionId } }
                "
                class="press-row focus-inset flex min-h-16 items-center gap-3 py-2.5 pr-3 pl-4"
              >
                <DateTile :date="r.competition.date" :managed="me.organises(r.competitionId)" />
                <span class="min-w-0 flex-1">
                  <span class="line-clamp-2 text-base leading-snug font-semibold">{{ r.competition.name }}</span>
                  <span v-if="medals(r.competitionId).groups.length" class="text-muted-foreground block text-sm">
                    {{ medals(r.competitionId).groups.join(' · ') }}
                  </span>
                  <span v-if="hiddenAs(r.competitionId, r.competition)" class="mt-0.5 flex"><VisibilityChip :visibility="hiddenAs(r.competitionId, r.competition)" /></span>
                  <!-- The number they wore there, then what they won, pinned on as on their day card. -->
                  <span
                    v-if="r.numbers.length || medals(r.competitionId).best.length || medals(r.competitionId).overall"
                    class="mt-2 flex flex-wrap items-center gap-x-1 gap-y-1.5"
                  >
                    <NumberCard v-for="n in r.numbers" :key="n" :number="n" :color="color" size="xs" class="mr-1.5" />
                    <Medal v-for="m in medals(r.competitionId).best" :key="m.danceId" :place="m.place" :tied="m.tied" :dance="m.name" />
                    <span v-if="medals(r.competitionId).overall" class="ml-1.5 inline-flex items-center gap-1.5 border-l pl-2.5">
                      <Medal :place="medals(r.competitionId).overall!.place" dance="Overall" />
                      <span class="text-muted-foreground text-sm font-semibold" aria-hidden="true">Overall</span>
                    </span>
                  </span>
                </span>
                <ChevronRight class="text-muted-foreground size-5 shrink-0" aria-hidden="true" />
              </RouterLink>
            </li>
          </ul>
        </template>
      </section>

      <p class="text-muted-foreground text-sm">
        Entries are matched to {{ name.split(' ')[0] }} by name, so two dancers who share a name can get mixed up.
        <button v-if="crisp.available" type="button" class="text-primary font-semibold underline-offset-2 hover:underline" @click="crisp.open()">
          Report a mix-up
        </button>
      </p>
    </div>
  </article>
</template>
