<script setup lang="ts">
import { computed } from 'vue'
import CollectionEditor from '@/components/admin/CollectionEditor.vue'
import ImportTip from '@/components/admin/ImportTip.vue'
import { useManagedCompetition, type MCategory } from '@/composables/admin/useManagedCompetition'
import type { CollectionSpec } from '@/lib/admin/collection'

const m = useManagedCompetition()

const CATEGORIES = ['Primary', 'Beginner', 'Novice', 'Intermediate', 'Premier', 'Restricted Premier', 'Premier Special']

const groupsIn = (id: string) => m.groups.value.filter((g) => g.categoryId === id).length

const spec: CollectionSpec<MCategory> = {
  path: 'categories',
  route: 'manage.categories',
  singular: 'category',
  plural: 'categories',
  sortable: true,
  fields: [{ key: 'name', label: 'Name', kind: 'text', required: true, placeholder: 'e.g. Premier', hint: 'Primary has no overall results; every other category does.' }],
  title: (c) => c.label,
  subtitle: (c) => {
    const n = groupsIn(c.id)
    return `${n} ${n === 1 ? 'age group' : 'age groups'}`
  },
  presets: CATEGORIES.map((name) => ({ label: name, values: { name } })),
  importFirst: true,
  impact: (ids) => {
    const n = ids.reduce((sum, id) => sum + groupsIn(id), 0)
    return { warnings: n ? [`${n} ${n === 1 ? 'age group uses' : 'age groups use'} ${ids.length === 1 ? 'it' : 'them'} and will need another category.`] : [] }
  },
  emptyHint: 'Categories group the age groups: Primary, Beginner, Novice, Intermediate, Premier.',
}

const items = computed(() => m.categories.value)
</script>

<template>
  <CollectionEditor :spec="spec" :items="items">
    <template #list-intro><ImportTip /></template>
  </CollectionEditor>
</template>
