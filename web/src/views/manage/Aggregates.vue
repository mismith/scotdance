<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import CollectionEditor from '@/components/admin/CollectionEditor.vue'
import SwitchField from '@/components/admin/SwitchField.vue'
import { useManagedCompetition, type MAggregate, type MGroup } from '@/composables/admin/useManagedCompetition'
import type { CollectionSpec } from '@/lib/admin/collection'
import { OVERALL, parsePlacings } from '@/lib/admin/results'

const m = useManagedCompetition()

const PRESETS = ['Dancer of the Day', 'Most Points']

const spec: CollectionSpec<MAggregate> = {
  path: 'aggregates',
  route: 'manage.aggregates',
  singular: 'aggregate',
  plural: 'aggregates',
  sortable: true,
  fields: [
    { key: 'name', label: 'Name', kind: 'text', required: true, placeholder: 'e.g. Premier Dancer of the Day' },
    { key: 'trophy', label: 'Trophy', kind: 'text', half: true, placeholder: 'e.g. Adeline Duncan Memorial' },
    {
      key: 'sponsor',
      label: 'Trophy sponsor',
      kind: 'select',
      half: true,
      placeholder: 'None',
      // As on an age group: a sponsor from Staff (stored by id), or a name
      // typed in an older competition, which stays choosable as it is.
      options: () => {
        const ids = new Set(m.staff.value.map((s) => s.id))
        const typed = [
          ...new Set([...m.groups.value, ...m.aggregates.value].map((x) => x.sponsor?.trim()).filter((s): s is string => !!s && !ids.has(s))),
        ]
        return [
          ...m.sponsors.value.map((s) => ({ value: s.id, label: s.label, group: typed.length ? 'Sponsors' : undefined })),
          ...typed.map((name) => ({ value: name, label: name, group: 'Typed names' })),
        ]
      },
      hint: m.sponsors.value.length ? undefined : 'Add sponsors under Staff first.',
    },
  ],
  title: (a) => a.label,
  subtitle: (a) => {
    if (!a.openTo) return 'No age groups yet'
    const n = m.aggregateDancers(a.id).length
    // Dancers first, as on age groups here and in Results.
    return `${n} ${n === 1 ? 'dancer' : 'dancers'} · ${a.openTo}`
  },
  searchText: (a) => a.trophy ?? '',
  presets: PRESETS.map((name) => ({ label: name, values: { name } })),
  presetsLead: 'Rename them any time.',
  impact: (ids) => {
    const updates: Record<string, unknown> = {}
    let placed = 0
    for (const id of ids) {
      const stored = m.results.value[id]
      if (stored && Object.keys(stored).length) updates[`results/${id}`] = null
      if (parsePlacings(stored?.[OVERALL]).entries.length) placed++
    }
    // Only warn when there are placings to lose (not for a "No results" mark).
    const warnings = placed ? [`${ids.length === 1 ? 'Its' : 'Their'} placings will be deleted too.`] : []
    return { updates, warnings }
  },
  emptyHint: 'An aggregate is one trophy for dancers from several age groups, like Dancer of the Day. Choose who can win it here, then pick the winners in Results.',
}

const items = computed(() => m.aggregates.value)

// Who can win: each category's age groups, with a switch for the whole
// category as a shortcut. Only age groups are saved. Age groups without a
// category sit under Other.
interface Block {
  id: string
  /** Shown as "All {name}" above its age groups, when it has more than one. */
  name: string
  groups: MGroup[]
}
const blocks = computed<Block[]>(() => {
  const out: Block[] = m.categories.value
    .map((c) => ({ id: c.id, name: c.label, groups: m.groups.value.filter((g) => g.categoryId === c.id) }))
    .filter((b) => b.groups.length)
  const other = m.groups.value.filter((g) => !g.category)
  if (other.length) out.push({ id: '', name: 'Other', groups: other })
  return out
})

const groupName = (g: MGroup) => g.name?.trim() || g.label

function setGroup(a: MAggregate, g: MGroup, on: boolean) {
  return m.writeData({ [`aggregates/${a.id}/groupIds/${g.id}`]: on || null }, `${on ? 'Added' : 'Removed'} ${g.label} ${on ? 'to' : 'from'} ${a.label}`)
}
function setBlock(a: MAggregate, b: Block, on: boolean) {
  const updates = Object.fromEntries(b.groups.map((g) => [`aggregates/${a.id}/groupIds/${g.id}`, on || null]))
  return m.writeData(updates, `${on ? 'Added' : 'Removed'} all ${b.name} ${on ? 'to' : 'from'} ${a.label}`)
}
const allOn = (a: MAggregate, b: Block) => b.groups.every((g) => !!a.groupIds?.[g.id])
// Part of a category on: say how much, since its switch reads as off.
const partly = (a: MAggregate, b: Block) => {
  const n = b.groups.filter((g) => !!a.groupIds?.[g.id]).length
  return n && n < b.groups.length ? `${n} of its ${b.groups.length} age groups` : undefined
}
</script>

<template>
  <CollectionEditor :spec="spec" :items="items">
    <template #detail-extra="{ item }">
      <section class="space-y-3">
        <div>
          <h3 class="text-heading">Who can win</h3>
          <p class="text-muted-foreground text-sm">The age groups whose dancers can be picked for it in Results.</p>
        </div>
        <ul v-if="blocks.length" class="rows-engraved">
          <template v-for="b in blocks" :key="b.id">
            <!-- A category with one age group needs only its one switch. -->
            <li v-if="b.id && b.groups.length === 1" class="py-1">
              <SwitchField :model-value="!!item.groupIds?.[b.groups[0].id]" :label="b.groups[0].label" :save="(on) => setGroup(item, b.groups[0], on)" />
            </li>
            <template v-else>
              <li v-if="b.id" class="py-1">
                <SwitchField :model-value="allOn(item, b)" :label="`All ${b.name}`" :description="partly(item, b)" :save="(on) => setBlock(item, b, on)" />
              </li>
              <li v-else class="text-muted-foreground pt-3 pb-1 text-sm font-semibold">{{ b.name }}</li>
              <li v-for="g in b.groups" :key="g.id" class="py-1 pl-6">
                <SwitchField :model-value="!!item.groupIds?.[g.id]" :label="groupName(g)" :context="b.id && g.name?.trim() ? b.name : undefined" :save="(on) => setGroup(item, g, on)" />
              </li>
            </template>
          </template>
        </ul>
        <p v-else class="text-muted-foreground text-base">
          No age groups yet.
          <RouterLink :to="{ name: 'manage.groups', params: { competitionId: m.competitionId.value } }" class="text-primary font-semibold">Add age groups</RouterLink>
        </p>
      </section>
    </template>
  </CollectionEditor>
</template>
