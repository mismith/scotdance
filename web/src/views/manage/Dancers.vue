<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { FileSpreadsheet } from '@lucide/vue'
import CollectionEditor from '@/components/admin/CollectionEditor.vue'
import { useManagedCompetition, type MDancer } from '@/composables/admin/useManagedCompetition'
import { canEdit } from '@/lib/admin/write'
import type { CollectionSpec } from '@/lib/admin/collection'

const m = useManagedCompetition()

const items = computed(() => m.dancers.value)

const groupOptions = () =>
  m.groups.value.map((g) => ({ value: g.id, label: g.label, group: g.category?.label }))

function nextNumber(previous: string | undefined) {
  const n = Number.parseInt(previous ?? '', 10)
  if (!Number.isFinite(n)) return ''
  let next = n + 1
  const taken = new Set(m.dancers.value.map((d) => d.num))
  while (taken.has(String(next))) next += 1
  return String(next)
}

// Which results mention a dancer (placings, callbacks or points).
function resultMentions(id: string) {
  let count = 0
  for (const byDance of Object.values(m.results.value)) {
    for (const placings of Object.values(byDance ?? {})) {
      if (Array.isArray(placings) && placings.some((p) => p === id || p === `${id}:tie`)) count += 1
    }
  }
  for (const byDance of Object.values(m.points.value)) {
    for (const byJudge of Object.values(byDance ?? {})) {
      if (Object.values(byJudge ?? {}).some((ids) => Array.isArray(ids) && ids.includes(id))) count += 1
    }
  }
  return count
}

const spec: CollectionSpec<MDancer> = {
  path: 'dancers',
  route: 'manage.dancers',
  singular: 'dancer',
  plural: 'dancers',
  fields: [
    {
      key: 'number',
      label: 'Number',
      kind: 'text',
      required: true,
      half: true,
      inputmode: 'numeric',
      // The same dancer can be in two age groups with one number; within an
      // age group, numbers must be unique.
      validate: (v, id, values) => {
        const groupId = values.groupId as string | undefined
        if (!groupId) return null
        const clash = m.dancers.value.find((d) => d.num === v && d.id !== id && d.groupId === groupId)
        return clash ? `${v} is already ${clash.label} in this age group.` : null
      },
    },
    { key: 'groupId', label: 'Age group', kind: 'select', required: true, half: true, bulk: true, options: groupOptions, placeholder: 'Choose an age group' },
    { key: 'firstName', label: 'First name', kind: 'text', required: true, half: true },
    { key: 'lastName', label: 'Last name', kind: 'text', half: true },
    { key: 'location', label: 'Location', kind: 'text', placeholder: 'e.g. Ontario', hint: 'Where they’re from: a town, province, state or country.' },
  ],
  title: (d) => d.label,
  subtitle: (d) => [d.group?.label ?? (d.groupId ? 'Missing age group' : 'No age group'), d.location].filter(Boolean).join(' · '),
  badge: (d) => d.num,
  searchText: (d) => d.num,
  defaults: (prev) => ({ number: nextNumber(prev?.number), groupId: prev?.groupId ?? '' }),
  // A dancer's category follows their age group (the import did the same).
  onChange: (d, key, value) =>
    key === 'groupId' ? { [`dancers/${d.id}/categoryId`]: (value && m.groupsById.value.get(value)?.categoryId) ?? null } : {},
  impact: (ids) => {
    const updates: Record<string, unknown> = {}
    // Take their numbers out of any draws.
    const numbers = new Map(ids.map((id) => [id, m.dancersById.value.get(id)?.num]))
    for (const [gid, byDance] of Object.entries(m.draws.value)) {
      for (const [did, order] of Object.entries(byDance ?? {})) {
        if (!Array.isArray(order)) continue
        const kept = order.filter((n) => ![...numbers.values()].includes(String(n)))
        if (kept.length !== order.length) updates[`draws/${gid}/${did}`] = kept.length ? kept : null
      }
    }
    const withResults = ids.filter((id) => resultMentions(id) > 0)
    const warnings: string[] = []
    if (withResults.length) {
      warnings.push(
        withResults.length === 1 && ids.length === 1
          ? 'They have results entered. Those places will show as an unknown dancer (?) until changed.'
          : `${withResults.length} of them have results entered. Those places will show as an unknown dancer (?) until changed.`,
      )
    }
    return { updates, warnings }
  },
  emptyHint: 'Import them from your Excel entry list, or add them one at a time.',
}
</script>

<template>
  <CollectionEditor :spec="spec" :items="items">
    <template #list-actions>
      <RouterLink
        :to="{ name: 'manage.dancers.import', params: { competitionId: m.competitionId.value } }"
        :class="[
          'bg-card border-strong hover:bg-accent flex h-11 items-center gap-1.5 rounded-xl border px-4 text-[0.9375rem] font-bold',
          !canEdit && 'pointer-events-none opacity-50',
        ]"
      >
        <FileSpreadsheet class="size-4" /> Import
      </RouterLink>
    </template>
  </CollectionEditor>
</template>
