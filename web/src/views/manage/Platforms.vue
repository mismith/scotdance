<script setup lang="ts">
import { computed } from 'vue'
import CollectionEditor from '@/components/admin/CollectionEditor.vue'
import { useManagedCompetition, type MPlatform } from '@/composables/admin/useManagedCompetition'
import type { CollectionSpec } from '@/lib/admin/collection'
import { forEachScheduleDance } from '@/lib/admin/scheduleTree'

const m = useManagedCompetition()

const spec: CollectionSpec<MPlatform> = {
  path: 'platforms',
  route: 'manage.platforms',
  singular: 'platform',
  plural: 'platforms',
  sortable: true,
  fields: [
    { key: 'name', label: 'Name', kind: 'text', required: true, placeholder: 'e.g. A', hint: 'Shown as “Platform A”.' },
    { key: 'description', label: 'Description', kind: 'textarea', placeholder: 'e.g. Main hall, by the stage' },
  ],
  title: (p) => p.label,
  subtitle: (p) => p.description,
  presets: ['A', 'B', 'C', 'Stage'].map((name) => ({ label: name, values: { name } })),
  impact: (ids) => {
    const updates: Record<string, unknown> = {}
    forEachScheduleDance(m.schedule.value, (path, item) => {
      for (const id of ids) if (item.platforms?.[id]) updates[`${path}/platforms/${id}`] = null
    })
    const uses = Object.keys(updates).length
    return {
      updates,
      warnings: uses ? [`The schedule puts age groups on ${ids.length === 1 ? 'it' : 'them'} in ${uses} ${uses === 1 ? 'place' : 'places'}; those assignments will be removed.`] : [],
    }
  },
  emptyHint: 'Add the platforms (stages) dancers perform on.',
}

const items = computed(() => m.platforms.value)
</script>

<template>
  <CollectionEditor :spec="spec" :items="items" />
</template>
