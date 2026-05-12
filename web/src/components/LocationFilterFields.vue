<script setup lang="ts">
import { computed } from 'vue'
import { LocateFixed, X } from '@lucide/vue'
import type { CompetitionListItem } from '@/composables/useCompetitions'
import { useLocationFilter } from '@/composables/useLocationFilter'

const props = defineProps<{
  competitions: CompetitionListItem[]
}>()

const {
  country,
  region,
  locality,
  near,
  geo,
  geoCoords,
  enableNearMe,
  disableNearMe,
  clear,
  isActive,
  deriveOptions,
} = useLocationFilter()

const options = computed(() => deriveOptions(props.competitions))

function toggleNear(): void {
  if (near.value) disableNearMe()
  else enableNearMe()
}
</script>

<template>
  <div class="space-y-3">
    <button
      type="button"
      :class="[
        'flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left font-medium',
        near
          ? 'bg-primary text-primary-foreground'
          : 'bg-chip text-foreground hover:bg-accent',
      ]"
      :disabled="geo.error.value !== null"
      @click="toggleNear"
    >
      <LocateFixed class="size-4 shrink-0" />
      <span class="flex-1">{{ near ? 'Near me · on' : 'Use my location' }}</span>
      <span v-if="near && !geoCoords" class="text-xs opacity-80">locating…</span>
    </button>
    <div v-if="geo.error.value" class="text-muted-foreground px-1 text-xs">
      Location unavailable.
    </div>

    <div class="space-y-2">
      <label class="block">
        <span class="text-muted-foreground mb-1 block text-xs font-medium tracking-wide uppercase">
          Country
        </span>
        <select
          v-model="country"
          :disabled="near"
          class="bg-background w-full rounded-lg border px-3 py-2 disabled:opacity-50"
        >
          <option :value="null">All countries</option>
          <option v-for="c in options.countries" :key="c" :value="c">{{ c }}</option>
        </select>
      </label>

      <label v-if="country" class="block">
        <span class="text-muted-foreground mb-1 block text-xs font-medium tracking-wide uppercase">
          Region
        </span>
        <select
          v-model="region"
          :disabled="!country || near || !options.regions.length"
          class="bg-background w-full rounded-lg border px-3 py-2 disabled:opacity-50"
        >
          <option :value="null">All regions</option>
          <option v-for="r in options.regions" :key="r" :value="r">{{ r }}</option>
        </select>
      </label>

      <label v-if="region" class="block">
        <span class="text-muted-foreground mb-1 block text-xs font-medium tracking-wide uppercase">
          City
        </span>
        <select
          v-model="locality"
          :disabled="!region || near || !options.localities.length"
          class="bg-background w-full rounded-lg border px-3 py-2 disabled:opacity-50"
        >
          <option :value="null">All cities</option>
          <option v-for="l in options.localities" :key="l" :value="l">{{ l }}</option>
        </select>
      </label>
    </div>

    <button
      v-if="isActive"
      type="button"
      class="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 px-1 text-sm"
      @click="clear"
    >
      <X class="size-3.5" />
      Clear location
    </button>
  </div>
</template>
