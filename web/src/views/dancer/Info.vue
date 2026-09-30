<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { ChevronRight } from '@lucide/vue'
import { useDancerProfile } from '@/composables/useDancerProfile'
import { useDancerCards } from '@/composables/useDancerCards'
import { useFollowing } from '@/composables/useFollowing'
import { useCrisp } from '@/composables/useCrisp'
import { injectInfoHeaderSetter } from '@/composables/useScrolledPast'
import DancerDayCard from '@/components/DancerDayCard.vue'
import DancerTartan from '@/components/DancerTartan.vue'
import DateTile from '@/components/DateTile.vue'
import FollowButton from '@/components/FollowButton.vue'
import Medal from '@/components/Medal.vue'
import { fetchEntrySummary, type EntrySummary } from '@/lib/entrySummary'
import { initialsOf, isSameDay } from '@/lib/format'
import type { Competition } from '@/types/competition'

// A dancer across every competition. Their number is different at each one,
// so it's shown per competition, never as who they are.
const setHeader = injectInfoHeaderSetter()
const route = useRoute()
const profile = useDancerProfile()
const following = useFollowing()
const crisp = useCrisp()

const dancerId = computed(() => String(route.params.dancerId ?? ''))
const name = computed(() => profile.displayName.value)
const color = computed(() => following.colorFor(dancerId.value))
const initials = computed(() => initialsOf(name.value))
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

// One row per competition (entries in two age groups share a number).
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
  <article class="space-y-4">
    <header :ref="setHeader" class="flex items-center gap-4">
      <img v-if="profile.image.value" :src="profile.image.value" :alt="name" class="size-16 shrink-0 rounded-full object-cover" />
      <span
        v-else
        class="cloth flex size-16 shrink-0 items-center justify-center rounded-full text-xl font-extrabold text-white [text-shadow:0_1px_3px_rgb(0_0_0/0.7)]"
        :style="following.paint(dancerId, 'var(--strong)')"
      >
        {{ initials }}
      </span>
      <div class="min-w-0">
        <h1 class="text-display">{{ name }}</h1>
        <p v-if="subtitle" class="text-muted-foreground text-sm">{{ subtitle }}</p>
      </div>
    </header>

    <FollowButton :dancer="{ dancerId, fullName: name }" size="block" />

    <section v-if="focus && focus.days.length" class="space-y-2">
      <h2 class="text-heading pt-1">{{ focusLabel }}</h2>
      <DancerDayCard :days="focus.days" :competition-id="focus.competitionId" :color="color" />
    </section>

    <DancerTartan :dancer-id="dancerId" :dancer-name="name" />

    <section class="space-y-2">
      <h2 class="text-heading flex items-baseline justify-between pt-1">
        Competitions
        <span class="text-muted-foreground text-sm font-semibold">{{ rows.length }}</span>
      </h2>
      <p v-if="profile.loading.value && !rows.length" class="text-muted-foreground text-base">Loading…</p>
      <ul v-else class="bg-card divide-y overflow-hidden rounded-2xl border shadow-sm">
        <li v-for="r in rows" :key="r.competitionId">
          <RouterLink
            :to="
              r.entryIds[0]
                ? { name: 'competition.dancer', params: { competitionId: r.competitionId, dancerId: r.entryIds[0] } }
                : { name: 'competition.info', params: { competitionId: r.competitionId } }
            "
            class="flex min-h-16 items-center gap-3 px-3 py-2.5 hover:bg-accent"
          >
            <DateTile :date="r.competition.date" below="year" />
            <span class="min-w-0 flex-1">
              <span class="line-clamp-2 text-base leading-snug font-bold">{{ r.competition.name }}</span>
              <span class="text-muted-foreground block truncate text-sm">
                {{ [r.numbers.length ? r.numbers.map((n) => `#${n}`).join(', ') : null, ...medals(r.competitionId).groups].filter(Boolean).join(' · ') }}
              </span>
              <span v-if="isSameDay(r.competition.date)" class="text-live text-sm font-bold">Today</span>
              <span v-if="medals(r.competitionId).best.length || medals(r.competitionId).overall" class="mt-1 flex flex-wrap items-center gap-1">
                <template v-if="medals(r.competitionId).overall">
                  <Medal :place="medals(r.competitionId).overall!.place" size="sm" />
                  <span class="mr-1 text-sm font-bold">Overall</span>
                </template>
                <Medal v-for="m in medals(r.competitionId).best" :key="m.danceId" :place="m.place" :tied="m.tied" size="sm" />
              </span>
            </span>
            <ChevronRight class="text-muted-foreground size-5 shrink-0" />
          </RouterLink>
        </li>
      </ul>
    </section>

    <p class="text-muted-foreground text-sm">
      Entries are matched to {{ name.split(' ')[0] }} by name, so two dancers who share a name can get mixed up.
      <button v-if="crisp.available" type="button" class="text-primary font-bold" @click="crisp.open()">
        Report a mix-up
      </button>
    </p>
  </article>
</template>
