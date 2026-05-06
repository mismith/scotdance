<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import GlobalBottomNav from '@/components/nav/GlobalBottomNav.vue'
import CompetitionBottomNav from '@/components/nav/CompetitionBottomNav.vue'
import DancerBottomNav from '@/components/nav/DancerBottomNav.vue'

const route = useRoute()

const navMode = computed<'competition' | 'dancer' | 'none' | 'global'>(() => {
  const name = String(route.name ?? '')
  if (name.startsWith('competition.')) return 'competition'
  if (name.startsWith('dancer.')) return 'dancer'
  if (name === 'search') return 'none'
  return 'global'
})
</script>

<template>
  <div class="flex min-h-svh flex-col pb-24">
    <slot />

    <CompetitionBottomNav v-if="navMode === 'competition'" />
    <DancerBottomNav v-else-if="navMode === 'dancer'" />
    <GlobalBottomNav v-else-if="navMode === 'global'" />
  </div>
</template>
