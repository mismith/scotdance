<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useCompetition } from '@/composables/useCompetition'
import FavoriteDancerButton from '@/components/FavoriteDancerButton.vue'
import Place from '@/components/Place.vue'
import { findGroupDances, getDancerPlace } from '@/lib/results'
import { groupHasOverall, overallDance } from '@/types/competition'
import { useFavoritesStore } from '@/stores/favorites'

const route = useRoute()
const favorites = useFavoritesStore()
const { competitionId, dancers, dances, results, points, loadDancers, loadResults } =
  useCompetition()

onMounted(async () => {
  await loadDancers()
  await loadResults()
})

const dancerId = computed(() => String(route.params.dancerId ?? ''))
const dancer = computed(() => dancers.value.find((d) => d.id === dancerId.value) ?? null)

const groupDances = computed(() => {
  if (!dancer.value?.group) return []
  const list = findGroupDances(dancer.value.group, dances.value)
  if (groupHasOverall(dancer.value.group)) list.push(overallDance)
  return list
})

const placedRows = computed(() =>
  groupDances.value.map((dance) => ({
    dance,
    result: getDancerPlace(
      dancer.value!.id,
      dancer.value!.group?.id,
      dance.id,
      results.value,
      points.value,
    ),
  })),
)
</script>

<template>
  <article class="space-y-6">
    <div v-if="!dancers.length" class="text-muted-foreground font-serif italic text-sm">Loading…</div>

    <div
      v-else-if="!dancer"
      class="text-muted-foreground font-serif text-sm italic"
    >
      Dancer not found.
    </div>

    <template v-else>
      <header class="space-y-3">
        <div class="flex items-start gap-4">
          <img
            v-if="dancer.image"
            :src="dancer.image"
            :alt="dancer.fullName"
            class="bg-muted size-20 shrink-0 rounded-full object-cover shadow"
          />
          <div
            v-else
            :class="[
              'flex size-20 shrink-0 items-center justify-center rounded-full font-mono text-xl tabular-nums',
              favorites.isFavoriteDancer(dancer.id)
                ? 'bg-secondary text-secondary-foreground'
                : 'bg-muted text-muted-foreground',
            ]"
          >
            {{ dancer.number ?? '–' }}
          </div>

          <div class="min-w-0 flex-1 space-y-1 pt-1">
            <div
              class="text-foreground/65 text-[11px] font-semibold tracking-[0.14em] uppercase tabular-nums"
            >
              Dancer<span v-if="dancer.number != null"> · #{{ dancer.number }}</span>
            </div>
            <h1 class="font-serif text-3xl leading-[1.04] font-medium tracking-tight">
              {{ dancer.fullName }}
            </h1>
            <div
              v-if="dancer.group"
              class="text-muted-foreground font-serif text-sm italic"
            >
              {{ dancer.group.fullName }}<span v-if="dancer.location"> · {{ dancer.location }}</span>
            </div>
            <div
              v-else-if="dancer.location"
              class="text-muted-foreground font-serif text-sm italic"
            >
              {{ dancer.location }}
            </div>
          </div>
          <FavoriteDancerButton :dancer="dancer" size="md" />
        </div>
      </header>

      <section v-if="dancer.group" class="space-y-2">
        <h3
          class="text-foreground/65 px-1 text-[11px] font-bold tracking-[0.14em] uppercase"
        >
          Results
        </h3>
        <div
          v-if="!groupDances.length"
          class="text-muted-foreground font-serif text-sm italic"
        >
          No dances scheduled for this group.
        </div>
        <ul v-else class="divide-y border-y">
          <li v-for="row in placedRows" :key="row.dance.id">
            <RouterLink
              :to="{
                name: 'competition.group',
                params: { competitionId, groupId: dancer.group.id },
                hash: `#dance-${row.dance.id}`,
              }"
              class="flex items-center gap-3 px-1 py-3"
            >
              <div
                class="font-serif min-w-0 flex-1 truncate text-[15px] leading-tight font-medium tracking-tight"
              >
                {{ row.dance.fullName }}
              </div>
              <Place
                :place="row.result.place"
                :tied="row.result.tied"
                :pointed="row.result.pointed"
              />
            </RouterLink>
          </li>
        </ul>
      </section>
    </template>
  </article>
</template>
