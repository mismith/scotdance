<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { CalendarDays, ChevronRight, ChevronsUp, EyeOff, Footprints, History } from '@lucide/vue'
import { useDancerProfile } from '@/composables/useDancerProfile'
import { BASIC_LATEST, useDancerRecord } from '@/composables/useDancerRecord'
import { useFollowing } from '@/composables/useFollowing'
import { useCrisp } from '@/composables/useCrisp'
import { injectInfoHeaderSetter } from '@/composables/useScrolledPast'
import Avatar from '@/components/Avatar.vue'
import CompetitionList from '@/components/dancer/CompetitionList.vue'
import DancerDayCard from '@/components/DancerDayCard.vue'
import DancerLookButton from '@/components/DancerLookButton.vue'
import FollowButton from '@/components/FollowButton.vue'
import Skeleton from '@/components/Skeleton.vue'
import Button from '@/components/ui/Button.vue'
import { KIND_NAMES } from '@/lib/danceKinds'
import { danceWheel } from '@/lib/danceWheel'
import { heroTitle } from '@/lib/heroTitle'
import { profileColumns, profileHeader } from '@/lib/profile'
import { useAuthStore } from '@/stores/auth'

// A dancer across every competition. Their number is different at each one,
// so it's shown per competition, never as who they are. Signed in: who they
// are, a few counted facts and the latest competitions (Progress and Results
// have the rest). Otherwise the basic profile: the latest ten competitions
// and a way in to the rest.
const setHeader = injectInfoHeaderSetter()
const route = useRoute()
const auth = useAuthStore()
const profile = useDancerProfile()
const record = useDancerRecord()
const following = useFollowing()
const crisp = useCrisp()

const dancerId = computed(() => String(route.params.dancerId ?? ''))
const name = computed(() => profile.displayName.value)
const first = computed(() => name.value.split(' ')[0])
const color = computed(() => following.colorFor(dancerId.value))
const { focus, showFocus, facts } = record
const subtitle = computed(() => {
  const n = profile.totalComps.value
  const since = profile.firstSeenDate.value?.getFullYear()
  const line = n ? `${n} competition${n === 1 ? '' : 's'}${since ? ` since ${since}` : ''}` : null
  return [profile.location.value, line].filter(Boolean).join(' · ')
})
const focusLabel = computed(() => {
  const f = focus.value
  if (!f) return ''
  return f.phase === 'today' ? `Today at ${f.competition.name}` : f.phase === 'before' ? `Next: ${f.competition.name}` : `Last: ${f.competition.name}`
})

const flat = (rows: ReturnType<typeof record.latest>) => [['', rows]] as const
const latest3 = computed(() => flat(record.latest(3)))
const latestBasic = computed(() => flat(record.latest(BASIC_LATEST)))
const loadingRows = computed(() => profile.loading.value && !record.rows.value.length)

const total = computed(() => profile.totalComps.value)
// Signed out, there's more behind signing in; hidden, there isn't.
const moreBehind = computed(() => !auth.isSignedIn && total.value > BASIC_LATEST)
const signIn = () => auth.openLogin()
const level = computed(() => facts.value.level)
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
const wheel = computed(() => danceWheel(record.points.value))
// The kind of dance they do most, by times danced.
const mostly = computed(() => {
  const top = wheel.value.kinds.reduce<(typeof wheel.value.kinds)[number] | null>((a, k) => (!a || k.times > a.times ? k : a), null)
  return top ? KIND_NAMES[top.kind] : null
})
// The counted facts, as tiles: the level, seasons and dances lead to
// Progress (the saltire and journey), the competitions to Results.
const tiles = computed(() => {
  const ready = record.ready.value
  const lv = level.value
  const word = (n: number, w: string) => plural(n, w).replace(/^\d+ /, '')
  return [
    ...(!ready || lv
      ? [{ key: 'level', icon: ChevronsUp, to: 'dancer.progress', value: lv?.level ?? null, label: lv ? `since ${new Date(lv.since).getFullYear()}` : '' }]
      : []),
    { key: 'competitions', icon: CalendarDays, to: 'dancer.results', value: facts.value.competitions, label: word(facts.value.competitions, 'competition') },
    {
      key: 'seasons',
      icon: History,
      to: 'dancer.progress',
      value: facts.value.seasons,
      label: `${word(facts.value.seasons, 'season')}${facts.value.since ? ` since ${facts.value.since}` : ''}`,
    },
    {
      key: 'dances',
      icon: Footprints,
      to: 'dancer.progress',
      value: ready ? facts.value.dances : null,
      label: `${word(facts.value.dances, 'dance')}${mostly.value ? `, mostly ${mostly.value}` : ''}`,
    },
  ]
})
</script>

<template>
  <article :class="profileColumns">
    <!-- A system admin sees past a hidden profile; this says what everyone else gets. -->
    <p
      v-if="record.rich.value && record.hiddenInfo.value"
      class="bg-card border-foreground/40 flex items-center gap-3 rounded-2xl border px-4 py-2.5 text-sm"
    >
      <EyeOff class="size-5 shrink-0" aria-hidden="true" />
      <span><span class="font-semibold">Hidden:</span> everyone else sees the latest {{ BASIC_LATEST }} competitions only.</span>
    </p>

    <div :class="profileHeader">
      <header :ref="setHeader" class="flex flex-col items-center gap-4">
        <DancerLookButton :dancer-id="dancerId" :name="name">
          <Avatar :name="name" :image="profile.image.value" :color="color" size="xl" />
        </DancerLookButton>
        <div class="min-w-0">
          <h1 :class="heroTitle(name)">{{ name }}</h1>
          <p v-if="subtitle" class="text-muted-foreground text-callout mt-1.5">{{ subtitle }}</p>
        </div>
      </header>
      <FollowButton :dancer="{ dancerId, fullName: name }" size="block" class="w-auto! min-w-48" />
    </div>

    <div class="space-y-5">
      <section v-if="focus && showFocus" class="space-y-2">
        <h2 :class="['text-section', focus.phase === 'today' && 'text-live']">{{ focusLabel }}</h2>
        <DancerDayCard class="-mx-4" :days="focus.days" :competition-id="focus.competitionId" :color="color" size="lg" />
      </section>

      <!-- Until it's known who is looking, nothing below the day card. -->
      <div v-if="record.pending.value" class="space-y-3" aria-busy="true">
        <span class="sr-only">Loading…</span>
        <Skeleton class="h-5 w-1/3" />
        <Skeleton class="h-24 w-full rounded-2xl!" />
      </div>

      <template v-else-if="record.rich.value">
        <section class="space-y-2">
          <h2 class="text-section">On ScotDance.app</h2>
          <!-- Four tiles, two by two, each a way into the tab with the rest of it. -->
          <div class="grid grid-cols-2 gap-2">
            <RouterLink
              v-for="tile in tiles"
              :key="tile.key"
              :to="{ name: tile.to, params: { dancerId } }"
              replace
              class="surface press rounded-2xl p-3 odd:last:col-span-2"
            >
              <span class="flex items-center justify-between">
                <component :is="tile.icon" class="text-primary size-5" aria-hidden="true" />
                <ChevronRight class="text-muted-foreground size-4" aria-hidden="true" />
              </span>
              <template v-if="tile.value != null">
                <span class="mt-2 block truncate text-xl font-bold tabular-nums">{{ tile.value }}</span>
                <span class="text-muted-foreground block text-sm leading-snug">{{ tile.label }}</span>
              </template>
              <span v-else class="mt-2 block space-y-1.5">
                <Skeleton class="h-6 w-16" />
                <Skeleton class="h-4 w-24" />
              </span>
            </RouterLink>
          </div>
        </section>

        <section v-if="record.rows.value.length || loadingRows" class="space-y-2">
          <h2 class="text-section">Latest</h2>
          <CompetitionList :years="latest3" :dancer-id="dancerId" :loading="loadingRows" />
          <RouterLink
            :to="{ name: 'dancer.results', params: { dancerId } }"
            replace
            class="press-row focus-inset text-primary -mx-4 flex min-h-12 items-center justify-between px-4 font-semibold"
          >
            See all in Results <ChevronRight class="size-5" aria-hidden="true" />
          </RouterLink>
        </section>
      </template>

      <template v-else>
        <section v-if="!auth.isSignedIn" class="bg-card border-border space-y-3 rounded-2xl border p-4">
          <p v-if="total > BASIC_LATEST">Sign in to see all {{ total }} of {{ first }}’s competitions, progress and results by dance.</p>
          <p v-else>Sign in to see {{ first }}’s progress and results by dance.</p>
          <Button variant="primary" @click="signIn">Sign in</Button>
        </section>

        <section v-if="record.rows.value.length || loadingRows" class="space-y-2">
          <h2 class="text-section">Latest competitions</h2>
          <CompetitionList :years="latestBasic" :dancer-id="dancerId" :loading="loadingRows" />
          <button
            v-if="moreBehind"
            type="button"
            class="press-row focus-inset text-primary -mx-4 flex min-h-12 w-[calc(100%+2rem)] items-center justify-between px-4 text-left font-semibold"
            @click="signIn"
          >
            Sign in to see all {{ total }} <ChevronRight class="size-5" aria-hidden="true" />
          </button>
        </section>
      </template>

      <p class="text-muted-foreground text-sm">
        Entries are matched to {{ first }} by name, so two dancers who share a name can get mixed up.
        <button v-if="crisp.available" type="button" class="text-primary font-semibold underline-offset-2 hover:underline" @click="crisp.open()">
          Report a mix-up
        </button>
      </p>
    </div>
  </article>
</template>
