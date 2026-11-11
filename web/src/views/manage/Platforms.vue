<script setup lang="ts">
import { computed } from 'vue'
import CollectionEditor from '@/components/admin/CollectionEditor.vue'
import { useManagedCompetition, type MPlatform } from '@/composables/admin/useManagedCompetition'
import type { CollectionSpec } from '@/lib/admin/collection'
import { htmlToText, looksLikeHtml } from '@/lib/admin/richText'

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
  // Older descriptions are HTML: the one-line subtitle shows just the words.
  subtitle: (p) => (p.description && looksLikeHtml(p.description) ? htmlToText(p.description) : p.description),
  presets: ['A', 'B', 'C', 'Stage'].map((name) => ({ label: name, values: { name } })),
  emptyHint: 'Add the platforms (stages) dancers perform on.',
}

const items = computed(() => m.platforms.value)
</script>

<template>
  <CollectionEditor :spec="spec" :items="items" />
</template>
