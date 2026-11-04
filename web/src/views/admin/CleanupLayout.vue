<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Segmented from '@/components/ui/Segmented.vue'

// System admin › Cleanup: one check at a time, each its own page (they each
// read every competition, so they aren't all loaded at once).
const route = useRoute()
const router = useRouter()
const CHECKS = [
  { value: 'admin.venues', label: 'Venues' },
  { value: 'admin.dancers', label: 'Dancers' },
] as const
const current = computed(() => CHECKS.find((c) => c.value === route.name)?.value ?? 'admin.venues')
</script>

<template>
  <div>
    <div class="max-w-3xl px-4 pt-4">
      <Segmented :model-value="current" :options="CHECKS" label="Check" @update:model-value="(name) => router.replace({ name })" />
    </div>
    <RouterView />
  </div>
</template>
