<script setup lang="ts">
import { computed } from 'vue'
import { useJudgeProfile, type JudgeAppearance } from '@/composables/useJudgeProfile'
import { formatMonthAbbrev, initialsOf } from '@/lib/format'
import { sanitizeRichText } from '@/lib/sanitize'
import SectionHeader from '@/components/SectionHeader.vue'
import StatGrid from '@/components/StatGrid.vue'

const profile = useJudgeProfile()
const { displayName, location, image, bio, loading } = profile

const initials = computed(() => initialsOf(displayName.value))

function compRoute(a: JudgeAppearance | null) {
  if (!a?.raw.competitionId) return undefined
  return {
    name: 'competition.info',
    params: { competitionId: a.raw.competitionId },
  }
}

const tiles = computed(() => {
  const first = profile.firstSeen.value
  const last = profile.lastSeen.value
  const firstDate = profile.firstSeenDate.value
  const lastDate = profile.lastSeenDate.value
  return [
    {
      label: 'Competitions',
      value: profile.totalComps.value,
      to: { name: 'judge.competitions' },
    },
    { label: 'Venues', value: profile.venueCount.value },
    {
      label: 'First seen',
      caption: firstDate ? formatMonthAbbrev(firstDate).toUpperCase() : undefined,
      value: firstDate ? firstDate.getFullYear() : null,
      to: compRoute(first),
    },
    {
      label: 'Last seen',
      caption: lastDate ? formatMonthAbbrev(lastDate).toUpperCase() : undefined,
      value: lastDate ? lastDate.getFullYear() : null,
      to: compRoute(last),
    },
  ]
})
</script>

<template>
  <article class="space-y-6">
    <header class="space-y-3 pr-16">
      <div
        class="bg-muted text-muted-foreground flex size-20 items-center justify-center overflow-hidden rounded-full text-4xl font-medium [view-transition-class:nav-avatar] [view-transition-name:judge-avatar]"
      >
        <img
          v-if="image"
          :src="image"
          :alt="displayName"
          class="size-full object-cover"
        />
        <template v-else>{{ initials || '?' }}</template>
      </div>
      <div class="space-y-1">
        <h1
          class="text-title [view-transition-class:fit_nav-title] [view-transition-name:judge-name]"
        >
          {{ displayName }}
        </h1>
        <p
          v-if="location"
          class="text-muted-foreground text-lg italic"
        >
          {{ location }}
        </p>
      </div>
    </header>

    <section v-if="bio" class="space-y-2">
      <SectionHeader label="Bio" />
      <div
        class="text-foreground/90 wrap-break-word"
        v-html="sanitizeRichText(bio)"
      />
    </section>

    <StatGrid :stats="tiles" :loading="loading" />

    <p class="text-muted-foreground">
      Cross-comp profile is matched by name. Identity may be approximate when names
      are shared.
    </p>
  </article>
</template>
