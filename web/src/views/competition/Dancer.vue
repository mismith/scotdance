<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useCompetition } from '@/composables/useCompetition'
import FavoriteDancerButton from '@/components/FavoriteDancerButton.vue'
import Place from '@/components/Place.vue'
import { findGroupDances, getDancerPlace } from '@/lib/results'
import { groupHasOverall, overallDance } from '@/types/competition'

const route = useRoute()
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
    <div v-if="!dancers.length" class="text-muted-foreground text-sm">Loading…</div>

    <div v-else-if="!dancer" class="text-muted-foreground text-sm">Dancer not found.</div>

    <template v-else>
      <header class="flex flex-wrap gap-6">
        <img
          v-if="dancer.image"
          :src="dancer.image"
          :alt="dancer.fullName"
          class="bg-muted size-32 rounded-full object-cover shadow"
        />
        <div
          v-else
          class="bg-muted text-muted-foreground flex size-32 items-center justify-center rounded-full font-mono text-2xl"
        >
          {{ dancer.number ?? '–' }}
        </div>

        <div class="min-w-0 flex-1 space-y-2">
          <div class="text-muted-foreground text-xs tracking-wide uppercase">
            #{{ dancer.number ?? '?' }}
          </div>
          <div class="flex items-center gap-2">
            <h2 class="min-w-0 flex-1 truncate text-2xl font-semibold">
              {{ dancer.fullName || '?' }}
            </h2>
            <FavoriteDancerButton :dancer="dancer" size="md" />
          </div>
          <div v-if="dancer.group" class="text-sm">{{ dancer.group.fullName }}</div>
          <div v-if="dancer.location" class="text-muted-foreground text-sm">
            {{ dancer.location }}
          </div>
        </div>
      </header>

      <section v-if="dancer.group" class="space-y-2">
        <h3 class="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
          Results
        </h3>
        <div v-if="!groupDances.length" class="text-muted-foreground text-sm">
          No dances scheduled for this group.
        </div>
        <ul v-else class="divide-y rounded-md border">
          <li v-for="row in placedRows" :key="row.dance.id">
            <RouterLink
              :to="{
                name: 'competition.group',
                params: { competitionId, groupId: dancer.group.id },
                hash: `#dance-${row.dance.id}`,
              }"
              class="hover:bg-accent flex items-center gap-3 p-3"
            >
              <Place
                :place="row.result.place"
                :tied="row.result.tied"
                :pointed="row.result.pointed"
              />
              <div class="min-w-0 flex-1 truncate font-medium">
                {{ row.dance.fullName }}
              </div>
            </RouterLink>
          </li>
        </ul>
      </section>
    </template>
  </article>
</template>
