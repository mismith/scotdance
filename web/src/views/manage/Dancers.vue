<script setup lang="ts">
import { computed } from 'vue'
import { FileSpreadsheet } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import CollectionEditor from '@/components/admin/CollectionEditor.vue'
import { useManagedCompetition, type MDancer } from '@/composables/admin/useManagedCompetition'
import { canEdit } from '@/lib/admin/write'
import type { CollectionSpec, FieldSpec } from '@/lib/admin/collection'
import type { MemberDraft } from '@/lib/admin/teamMembers'
import { dancerRecord } from '@shared/plans/dancers'
import { ensemble, entryLine, entryName, isTeam, memberName, teamMembers } from '@/lib/entries'

// Every entry: a dancer, or a duet, trio or group (ADR 0012), each a number in an age group.
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

// --- Fields: the same for every entry (ADR 0012). One dancer, or (after
// "+ Add another dancer") a duet, a trio or a group. Routine and Studio are
// there once they have something in them, or "+ Add" opens them.
/** How many dance in it: on the add form, its rows (an empty new one counts); saved, its members. */
const dancerCount = (v: Record<string, unknown>) =>
  Array.isArray(v.dancers) ? v.dancers.length : v.team === true ? teamMembers(v as never).length || 2 : 1

const DANCERS: FieldSpec = {
  key: 'dancers',
  label: 'Dancers',
  kind: 'dancers',
  check: (_, values) => {
    const rows = ((values.dancers as MemberDraft[] | undefined) ?? []).filter((r) => r.firstName.trim() || r.lastName.trim())
    if (!rows.length) return 'First name can’t be empty.'
    return rows.some((r) => !r.firstName.trim()) ? 'Each dancer needs a first name.' : null
  },
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
        if (!/^\d+[a-z]?$/i.test(v)) return 'Use digits, like 101 or 101A.'
        const groupId = values.groupId as string | undefined
        if (!groupId) return null
        const clash = m.dancers.value.find((d) => d.num === v && d.id !== id && d.groupId === groupId)
        return clash ? `${v} is already ${clash.label} in this age group.` : null
      },
    },
    { key: 'groupId', label: 'Age group', kind: 'select', required: true, half: true, bulk: true, options: groupOptions, placeholder: 'Choose an age group' },
    DANCERS,
    { key: 'location', label: 'Location', kind: 'text', placeholder: 'e.g. Calgary, AB' },
    { key: 'title', label: 'Routine', kind: 'text', placeholder: 'e.g. Ghillies Up', optional: true, addLabel: 'a routine' },
    { key: 'studio', label: 'Studio', kind: 'text', placeholder: 'e.g. Thistle School of Dance', optional: true, addLabel: 'a studio' },
    // Saved by the Dancers rows; here for their names in Undo and errors.
    { key: 'firstName', label: 'First name', kind: 'text' },
    { key: 'lastName', label: 'Last name', kind: 'text' },
  ],
  fieldsFor: () => {
    const f = (key: string) => spec.fields.find((x) => x.key === key)!
    return [f('number'), f('groupId'), DANCERS, f('location'), f('title'), f('studio')]
  },
  // "Add dancer", "Add duet", "Add trio", "Add group".
  singularFor: (v) => (dancerCount(v) > 1 ? ensemble(dancerCount(v)) : 'dancer'),
  // A team by its own name, never v3's copy in firstName and lastName.
  title: (d) => (isTeam(d) ? entryName(d) : d.label),
  subtitle: (d) => {
    const group = d.group?.label ?? (d.groupId ? 'Missing age group' : 'No age group')
    return [group, entryLine(d)].filter(Boolean).join(' · ')
  },
  // Open, a team's dancers are right below: just its age group.
  detailSubtitle: (d) => (isTeam(d) ? (d.group?.label ?? null) : spec.subtitle!(d)),
  badge: (d) => d.num,
  searchText: (d) => [d.num, d.title, d.studio, ...teamMembers(d).map(([, x]) => memberName(x))].filter(Boolean).join(' '),
  // The next number, and the age group and studio (entries arrive a studio at a time).
  defaults: (prev) => ({ number: nextNumber(prev?.number), groupId: prev?.groupId ?? '', studio: prev?.studio ?? '' }),
  toRecord: (v) => dancerRecord(v as never, m.newKey),
  emptyHint: 'Import them from your entry list in Excel or Google Sheets, or add them one at a time.',
}
</script>

<template>
  <CollectionEditor :spec="spec" :items="items">
    <template #list-actions="{ variant }">
      <Button :variant="variant" :to="{ name: 'manage.dancers.import', params: { competitionId: m.competitionId.value } }" :disabled="!canEdit">
        <FileSpreadsheet /> Import
      </Button>
    </template>
  </CollectionEditor>
</template>
