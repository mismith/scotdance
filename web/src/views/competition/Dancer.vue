<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useCompetition } from '@/composables/useCompetition'
import { injectChromeTitle } from '@/composables/useChromeTitle'
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

const chromeTitle = injectChromeTitle()
watch(
  dancer,
  (d) => {
    chromeTitle.value = d?.fullName ?? null
  },
  { immediate: true },
)

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

    <div v-else-if="!dancer" class="text-muted-foreground text-sm">Dancer not found.</div>

    <template v-else>
      <header class="flex items-center gap-4">
        <img
          v-if="dancer.image"
          :src="dancer.image"
          :alt="dancer.fullName"
          class="bg-muted size-20 rounded-full object-cover shadow"
        />
        <div
          v-else
          class="bg-muted text-muted-foreground flex size-20 items-center justify-center rounded-full font-mono text-xl tabular-nums"
        >
          {{ dancer.number ?? '–' }}
        </div>

        <div class="min-w-0 flex-1 space-y-1">
          <div
            class="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase tabular-nums"
          >
            #{{ dancer.number ?? '?' }}
          </div>
          <div v-if="dancer.group" class="font-serif text-base font-medium tracking-tight">
            {{ dancer.group.fullName }}
          </div>
          <div v-if="dancer.location" class="text-muted-foreground text-sm">
            {{ dancer.location }}
          </div>
        </div>
        <FavoriteDancerButton :dancer="dancer" size="md" />
      </header>

      <section v-if="dancer.group" class="space-y-2">
        <h3 class="text-muted-foreground text-xs font-bold tracking-[0.14em] uppercase">
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
              <div class="font-serif min-w-0 flex-1 truncate font-medium tracking-tight">
                {{ row.dance.fullName }}
              </div>
            </RouterLink>
          </li>
        </ul>
      </section>
    </template>
  </article>
</template>
