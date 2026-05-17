<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import GlobalBottomNav from '@/components/nav/GlobalBottomNav.vue'

const route = useRoute()

// Routes that own their own bottom nav (entity layouts, competition layout)
// opt out via `meta.ownsBottomNav` — declared once on the layout route, applies
// to every child. Avoids brittle name-prefix matching against future entities.
// /search keeps GlobalBottomNav so the search input stays mounted across the
// home ↔ search transition — required for iOS to keep the soft keyboard up.
const showGlobalNav = computed(
  () => !route.matched.some((r) => r.meta.ownsBottomNav),
)
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <slot />

    <GlobalBottomNav v-if="showGlobalNav" />
  </div>
</template>
