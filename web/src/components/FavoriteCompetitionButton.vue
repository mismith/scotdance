<script setup lang="ts">
import FavoriteButton from './FavoriteButton.vue'

const props = defineProps<{
  competitionId: string
}>()
</script>

<template>
  <FavoriteButton type="competitions" :id="props.competitionId" />
</template>
