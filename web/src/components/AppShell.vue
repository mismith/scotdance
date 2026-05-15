<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import GlobalBottomNav from '@/components/nav/GlobalBottomNav.vue'

const route = useRoute()

// Competition + dancer routes render their own bottom nav from inside their
// layout (they need access to layout-provided context like hasSchedule).
// /search shares GlobalBottomNav so the search input stays mounted across the
// home ↔ search transition — required for iOS to keep the soft keyboard up.
const showGlobalNav = computed(() => {
  const name = String(route.name ?? '')
  if (name.startsWith('competition.')) return false
  if (name.startsWith('dancer.')) return false
  return true
})
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <slot />

    <GlobalBottomNav v-if="showGlobalNav" />
  </div>
</template>
