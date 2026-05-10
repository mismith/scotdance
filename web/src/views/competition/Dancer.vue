<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useCompetition } from '@/composables/useCompetition'
import FavoriteDancerButton from '@/components/FavoriteDancerButton.vue'
import Place from '@/components/Place.vue'
import SectionHeader from '@/components/SectionHeader.vue'
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
    <div v-if="!dancers.length" class="text-muted-foreground font-serif text-lg italic">
      Loading…
    </div>

    <div v-else-if="!dancer" class="text-muted-foreground font-serif text-lg italic">
      Dancer not found.
    </div>

    <template v-else>
      <header class="relative space-y-3">
        <FavoriteDancerButton
          :dancer="dancer"
          size="md"
          class="float-right -mr-1 flex size-12 items-center justify-center rounded-full"
        />
        <img
          v-if="dancer.image"
          :src="dancer.image"
          :alt="dancer.fullName"
          class="bg-muted size-20 shrink-0 rounded-full object-cover shadow"
        />
        <div
          v-else
          :class="[
            'flex size-20 shrink-0 items-center justify-center rounded-full font-mono text-3xl tabular-nums',
            favorites.isFavoriteDancer(dancer.id)
              ? 'bg-secondary text-secondary-foreground'
              : 'bg-muted text-muted-foreground',
          ]"
        >
          {{ dancer.number ?? '–' }}
        </div>

        <div class="min-w-0">
          <h1 class="mb-1 font-serif text-4xl leading-[1.04] font-medium tracking-tight">
            {{ dancer.fullName }}
          </h1>
          <div
            v-if="dancer.location"
            class="text-muted-foreground font-serif text-lg italic"
          >
            {{ dancer.location }}
          </div>
          <div
            v-if="dancer.group"
            class="text-muted-foreground font-serif text-sm italic"
          >
            {{ dancer.group.fullName }}
          </div>
        </div>
      </header>

      <section v-if="dancer.group" class="space-y-2">
        <SectionHeader label="Results" />
        <div
          v-if="!groupDances.length"
          class="text-muted-foreground font-serif text-lg italic"
        >
          No dances scheduled for this group.
        </div>
        <ul v-else>
          <li
            v-for="row in placedRows"
            :key="row.dance.id"
            :class="row.dance.id === overallDance.id ? 'mt-1 border-t pt-1' : ''"
          >
            <RouterLink
              :to="{
                name: 'competition.group',
                params: { competitionId, groupId: dancer.group.id },
                hash: `#dance-${row.dance.id}`,
              }"
              class="flex items-center gap-3 px-1 py-3"
            >
              <Place
                :place="row.result.place"
                :tied="row.result.tied"
                :pointed="row.result.pointed"
              />
              <div
                class="text-item-title min-w-0 flex-1 truncate"
              >
                {{ row.dance.fullName }}
              </div>
            </RouterLink>
          </li>
        </ul>
      </section>
    </template>
  </article>
</template>
