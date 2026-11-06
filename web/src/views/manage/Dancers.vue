<script setup lang="ts">
import { computed } from 'vue'
import { FileSpreadsheet } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import CollectionEditor from '@/components/admin/CollectionEditor.vue'
import { useManagedCompetition, type MDancer } from '@/composables/admin/useManagedCompetition'
import { canEdit } from '@/lib/admin/write'
import type { CollectionSpec, FieldSpec } from '@/lib/admin/collection'
import { draftName, listToMembers, type MemberDraft } from '@/lib/admin/teamMembers'
import { ensemble, entryLine, entryName, isTeam, legacyNames, memberName, teamMembers } from '@/lib/entries'
import { idList } from '@/lib/schedule'

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

// --- Fields: the same for every entry (ADR 0012). One dancer, or (after
// "+ Add another dancer") a duet, a trio or a group. Routine and Studio are
// there once they have something in them, or "+ Add" opens them.
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const rowsOf = (v: Record<string, unknown>) => ((v.dancers as MemberDraft[] | undefined) ?? []).filter((r) => draftName(r))
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
  toRecord: (v) => {
    const keep = (r: Record<string, unknown>) => Object.fromEntries(Object.entries(r).filter(([, x]) => x != null && x !== ''))
    const rows = rowsOf(v).map((r) => ({ ...r, firstName: r.firstName.trim(), lastName: r.lastName.trim() }))
    const common = { number: text(v.number), groupId: text(v.groupId), title: text(v.title), studio: text(v.studio), location: text(v.location) }
    if (rowsOf(v).length < 2) return keep({ ...common, firstName: rows[0]?.firstName, lastName: rows[0]?.lastName })
    const team = keep({ ...common, team: true, members: listToMembers(rows, m.newKey) })
    // What v3 shows (ADR 0012 decision 3).
    return keep({ ...team, ...legacyNames(team) })
  },
  onChange: (d, key, value) => {
    const updates: Record<string, unknown> = {}
    // A dancer's category follows their age group (the import did the same).
    if (key === 'groupId') updates[`dancers/${d.id}/categoryId`] = (value && m.groupsById.value.get(String(value))?.categoryId) ?? null
    // A team's name for v3 follows its title, studio and number (its dancers save their own).
    if (isTeam(d) && ['title', 'studio', 'number'].includes(key)) {
      const v3 = legacyNames({ ...d, [key]: value })
      updates[`dancers/${d.id}/firstName`] = v3.firstName
      updates[`dancers/${d.id}/lastName`] = v3.lastName
    }
    return updates
  },
  impact: (ids) => {
    const updates: Record<string, unknown> = {}
    // Take their numbers out of their age group's draws (numbers are only
    // unique within an age group, so other groups' draws are left alone).
    const gone = new Map<string, Set<string>>()
    for (const id of ids) {
      const d = m.dancersById.value.get(id)
      if (!d?.groupId || !d.num) continue
      gone.set(d.groupId, (gone.get(d.groupId) ?? new Set()).add(d.num))
    }
    for (const [gid, nums] of gone) {
      for (const [did, raw] of Object.entries(m.draws.value[gid] ?? {})) {
        const order = idList(raw)
        const kept = order.filter((n) => !nums.has(n))
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
