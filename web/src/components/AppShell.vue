<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import GlobalBottomNav from '@/components/nav/GlobalBottomNav.vue'

const route = useRoute()

// Competition + dancer routes render their own bottom nav from inside their
// layout (they need access to layout-provided context like hasSchedule).
const showGlobalNav = computed(() => {
  const name = String(route.name ?? '')
  if (name.startsWith('competition.')) return false
  if (name.startsWith('dancer.')) return false
  if (name === 'search') return false
  return true
})
</script>

<template>
  <div class="flex min-h-svh flex-col pb-safe-nav">
    <slot />

    <GlobalBottomNav v-if="showGlobalNav" />
  </div>
</template>
