<script setup lang="ts">
import { computed } from 'vue'
import FavoriteButton from '@/components/FavoriteButton.vue'
import ProfileCompetitions from '@/components/ProfileCompetitions.vue'
import { initialsOf } from '@/lib/format'
import { sanitizeRichText } from '@/lib/sanitize'
import { injectInfoHeaderSetter } from '@/composables/useScrolledPast'
import type { Competition } from '@/types/competition'

// A judge's or piper's page: who they are, then where they've been and
// where they're going next. Parents mostly land here from a competition's
// Overview wondering "who's judging?"; organisers use it to plan.
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
</script>

<template>
  <article class="space-y-4">
    <header :ref="setHeader" class="flex items-center gap-4">
      <img v-if="image" :src="image" :alt="name" class="size-16 shrink-0 rounded-full object-cover" />
      <span
        v-else
        class="bg-blue-paper text-primary flex size-16 shrink-0 items-center justify-center rounded-full text-xl font-extrabold"
      >
        {{ initialsOf(name) }}
      </span>
      <div class="min-w-0">
        <h1 class="text-display">{{ name }}</h1>
        <p class="text-muted-foreground text-sm">{{ [label, location].filter(Boolean).join(' · ') }}</p>
      </div>
    </header>

    <FavoriteButton :id="id" :type="kind" :name="name" labelled class="self-start" />

    <section
      v-if="bio"
      class="bg-card rounded-2xl border p-4 text-base leading-relaxed shadow-sm [&_a]:text-primary [&_a]:underline [&_p+p]:mt-3"
      v-html="sanitizeRichText(bio)"
    />

    <ProfileCompetitions :items="items" :loading="loading" />
  </article>
</template>
