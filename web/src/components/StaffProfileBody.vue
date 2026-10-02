<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import Avatar from '@/components/Avatar.vue'
import FavoriteButton from '@/components/FavoriteButton.vue'
import ProfileCompetitions from '@/components/ProfileCompetitions.vue'
import { daysFromToday, formatRelative, parseDate } from '@/lib/format'
import { profileColumns, profileHeader } from '@/lib/profile'
import { sanitizeRichText } from '@/lib/sanitize'
import { injectInfoHeaderSetter } from '@/composables/useScrolledPast'
import type { Competition } from '@/types/competition'

// A judge's or piper's page: who they are, where they're judging (or
// piping) next, then where they've been. Parents mostly land here from a
// competition's Overview wondering "who's judging?"; organisers use it to
// plan.
const props = defineProps<{
  kind: 'judges' | 'pipers'
  id: string
  name: string
  location: string | null
  image: string | null
  bio: string | null
  loading: boolean
  appearances: Array<{ raw: { competitionId?: string }; competition: Competition | null }>
}>()

const setHeader = injectInfoHeaderSetter()
const label = computed(() => (props.kind === 'judges' ? 'Judge' : 'Piper'))
const items = computed(() => {
  const seen = new Set<string>()
  return props.appearances.flatMap((a) => {
    const cid = a.raw.competitionId
    if (!cid || !a.competition || seen.has(cid)) return []
    seen.add(cid)
    return [{ competitionId: cid, competition: a.competition }]
  })
})
const next = computed(
  () =>
    items.value
      .filter((i) => i.competition.date && (daysFromToday(i.competition.date) ?? -1) >= 0)
      .sort((a, b) => parseDate(a.competition.date!).getTime() - parseDate(b.competition.date!).getTime())[0] ?? null,
)
</script>

<template>
  <article :class="profileColumns">
    <div :class="profileHeader">
      <header :ref="setHeader" class="flex items-center gap-4 lg:flex-col lg:items-start lg:gap-3">
        <Avatar :name="name" :image="image" size="lg" />
        <div class="min-w-0">
          <h1 class="text-display">{{ name }}</h1>
          <p class="text-muted-foreground text-sm">{{ [label, location].filter(Boolean).join(' · ') }}</p>
        </div>
      </header>
      <p v-if="next" class="text-callout">
        <span class="text-muted-foreground">{{ kind === 'judges' ? 'Judging' : 'Piping' }} next:</span>
        {{ ' ' }}
        <RouterLink
          :to="{ name: 'competition.info', params: { competitionId: next.competitionId } }"
          class="text-primary font-semibold underline-offset-2 hover:underline"
        >
          {{ next.competition.name }}</RouterLink
        >, {{ formatRelative(next.competition.date) }}
      </p>
      <FavoriteButton :id="id" :type="kind" :name="name" labelled variant="tonal" />
    </div>

    <div class="space-y-5">
      <section
        v-if="bio"
        class="surface rounded-2xl p-4 text-base leading-relaxed [&_a]:text-primary [&_a]:underline [&_p+p]:mt-3"
        v-html="sanitizeRichText(bio)"
      />
      <ProfileCompetitions :items="items" :loading="loading" />
    </div>
  </article>
</template>
