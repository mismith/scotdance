<script setup lang="ts">
import { computed } from 'vue'
import FavoriteButton from './FavoriteButton.vue'
import type { Dancer } from '@/types/competition'
import { dancerFullName } from '@/types/competition'

// Key dancer favourites by the AGGREGATE id (back-pointer field
// `dancerId` written by the aggregator), not the per-comp push key.
// One dancer = one favourite entry, consistent with judges/pipers/venues/comps.
//
// If `dancerId` is missing (aggregator trigger hasn't run yet for this record,
// or back-pointer backfill not run), hide the button — favouriting by per-comp
// id is no longer supported.

const props = defineProps<{
  dancer: Pick<Dancer, 'id' | 'firstName' | 'lastName' | 'dancerId'>
}>()

const name = computed(() => dancerFullName(props.dancer))
const aggregateId = computed(() => props.dancer.dancerId ?? '')
</script>

<template>
  <FavoriteButton
    v-if="aggregateId"
    :id="aggregateId"
    type="dancers"
    :name="name"
  />
</template>
