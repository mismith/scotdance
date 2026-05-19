<script setup lang="ts">
import { computed } from 'vue'
import FavoriteButton from './FavoriteButton.vue'
import type { Dancer } from '@/types/competition'
import { dancerFullName } from '@/types/competition'

const props = defineProps<{
  dancer: Pick<Dancer, 'id' | 'firstName' | 'lastName'>
}>()

const name = computed(() => dancerFullName(props.dancer))
</script>

<template>
  <FavoriteButton type="dancers" :id="props.dancer.id" :name="name" />
</template>
