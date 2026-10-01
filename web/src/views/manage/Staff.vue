<script setup lang="ts">
import { computed } from 'vue'
import CollectionEditor from '@/components/admin/CollectionEditor.vue'
import { useManagedCompetition, type MStaff } from '@/composables/admin/useManagedCompetition'
import type { CollectionSpec } from '@/lib/admin/collection'
import { forEachScheduleDance } from '@/lib/admin/scheduleTree'

const m = useManagedCompetition()

const ROLES = ['Judge', 'Piper', 'Volunteer', 'Sponsor']

const spec: CollectionSpec<MStaff> = {
  path: 'staff',
  route: 'manage.staff',
  singular: 'person',
  plural: 'people',
  sortable: true,
  fields: [
    { key: 'type', label: 'Role', kind: 'select', required: true, bulk: true, placeholder: 'Choose a role', options: () => ROLES.map((r) => ({ value: r, label: r })) },
    { key: 'firstName', label: 'First name', kind: 'text', half: true, hint: 'For a sponsor, the organisation’s name.' },
    { key: 'lastName', label: 'Last name', kind: 'text', half: true },
    { key: 'location', label: 'Location', kind: 'text', placeholder: 'e.g. Scotland' },
    { key: 'image', label: 'Photo or logo', kind: 'image', storage: 'staff' },
    { key: 'description', label: 'About', kind: 'textarea', hint: 'A short bio, shown when someone taps their name.' },
    { key: 'website', label: 'Website', kind: 'url', placeholder: 'e.g. example.com' },
  ],
  title: (s) => s.label,
  subtitle: (s) => [s.type ?? 'No role', s.location].filter(Boolean).join(' · '),
  defaults: (prev) => ({ type: prev?.type ?? '' }),
  impact: (ids) => {
    // Take them off any platform they're judging in the schedule.
    const updates: Record<string, unknown> = {}
    forEachScheduleDance(m.schedule.value, (path, item) => {
      for (const [pid, p] of Object.entries(item.platforms ?? {})) {
        const judges = p?.orderedJudgeIds ?? []
        const kept = judges.filter((j) => !ids.includes(j))
        if (kept.length !== judges.length) updates[`${path}/platforms/${pid}/orderedJudgeIds`] = kept.length ? kept : null
      }
    })
    const n = Object.keys(updates).length
    return { updates, warnings: n ? [`They’re judging in ${n} ${n === 1 ? 'part' : 'parts'} of the schedule and will be taken off.`] : [] }
  },
  searchText: (s) => [s.type, s.location].join(' '),
  emptyHint: 'Add the judges, pipers, volunteers and sponsors to credit them on the competition page.',
}

const items = computed(() => m.staff.value)
</script>

<template>
  <CollectionEditor :spec="spec" :items="items" />
</template>
