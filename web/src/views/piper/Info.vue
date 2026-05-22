<script setup lang="ts">
import { computed } from 'vue'
import { ChevronRight } from '@lucide/vue'
import { usePiperProfile } from '@/composables/usePiperProfile'
import { useFavoritesStore } from '@/stores/favorites'
import { initialsOf } from '@/lib/format'
import { sanitizeRichText } from '@/lib/sanitize'
import CompChip from '@/components/CompChip.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import Skeleton from '@/components/Skeleton.vue'
import StatGrid from '@/components/StatGrid.vue'

const profile = usePiperProfile()
const { displayName, location, image, bio, loading } = profile

const favorites = useFavoritesStore()
const initials = computed(() => initialsOf(displayName.value))

const resultsRoute = { name: 'piper.results' }
const tiles = computed(() => [
  { label: 'Total', value: profile.totalComps.value, to: resultsRoute },
  { label: 'This year', value: profile.compsThisYear.value },
  { label: 'Upcoming', value: profile.upcoming.value.length, to: resultsRoute },
  { label: 'Past', value: profile.past.value.length, to: resultsRoute },
])

const recentComp = computed(() => profile.appearances.value[0] ?? null)
</script>

<template>
  <article class="space-y-6">
    <header class="space-y-3 pr-16">
      <div
        class="bg-muted text-muted-foreground flex size-20 items-center justify-center overflow-hidden rounded-full text-4xl font-medium [view-transition-class:nav-avatar] [view-transition-name:piper-avatar]"
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
          class="text-title [view-transition-class:fit_nav-title] [view-transition-name:piper-name]"
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

    <StatGrid header="Competitions" :stats="tiles" :loading="loading" />

    <section v-if="loading" class="space-y-2">
      <Skeleton class="h-3 w-24" />
      <Skeleton class="h-14 w-full" />
    </section>
    <section v-else-if="recentComp" class="space-y-2">
      <SectionHeader label="Most recent" />
      <RouterLink
        :to="{
          name: 'competition.info',
          params: { competitionId: recentComp.raw.competitionId },
        }"
        class="flex items-center gap-3 px-2 py-3"
      >
        <CompChip
          :name="recentComp.competition?.name"
          :image="recentComp.competition?.image"
          :favorite="favorites.isFavorite('competitions', recentComp.raw.competitionId ?? '')"
          class="size-10 rounded-xl"
        />
        <div class="min-w-0 flex-1">
          <div class="text-item-title truncate">
            {{ recentComp.competition?.name ?? 'Loading…' }}
          </div>
        </div>
        <ChevronRight class="text-muted-foreground size-4 shrink-0" />
      </RouterLink>
    </section>

    <p class="text-muted-foreground">
      Cross-comp profile is matched by name. Identity may be approximate when names
      are shared.
    </p>
  </article>
</template>
