<script setup lang="ts">
import FavoriteButton from './FavoriteButton.vue'

const props = defineProps<{
  competitionId: string
}>()
</script>

<template>
  <FavoriteButton :id="props.competitionId" type="competitions" />
</template>
