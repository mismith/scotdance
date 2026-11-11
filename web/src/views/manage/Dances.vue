<script setup lang="ts">
import { computed } from 'vue'
import CollectionEditor from '@/components/admin/CollectionEditor.vue'
import SwitchField from '@/components/admin/SwitchField.vue'
import { useManagedCompetition, type MDance } from '@/composables/admin/useManagedCompetition'
import { danceFullName } from '@/types/competition'
import type { CollectionSpec } from '@/lib/admin/collection'
import { planSetDanceGroup } from '@shared/plans/membership'
import { STANDARD_DANCES, tidySteps } from '@/lib/standardDances'

const m = useManagedCompetition()

// The standard dances, once for each of their usual steps.
const PRESETS = STANDARD_DANCES.flatMap(({ name, shortName, steps }) => (steps ?? ['']).map((step) => ({ name, shortName, steps: step })))

const groupsDoing = (d: MDance) => Object.values(d.groupIds ?? {}).filter(Boolean).length

const spec: CollectionSpec<MDance> = {
  path: 'dances',
  route: 'manage.dances',
  singular: 'dance',
  plural: 'dances',
  sortable: true,
  fields: [
    { key: 'name', label: 'Name', kind: 'text', required: true, placeholder: 'e.g. Highland Fling' },
    {
      key: 'steps',
      label: 'Steps',
      kind: 'text',
      half: true,
      placeholder: 'e.g. 4 or 2+1',
      hint: 'Shown after the name: “Highland Fling (4)”.',
      tidy: tidySteps,
    },
    { key: 'shortName', label: 'Short name', kind: 'text', half: true, placeholder: 'e.g. Fling', hint: 'For tight spaces.' },
  ],
  title: (d) => d.label,
  subtitle: (d) => {
    const n = groupsDoing(d)
    return [d.shortName, `${n} ${n === 1 ? 'age group' : 'age groups'}`].filter(Boolean).join(' · ')
  },
  presets: PRESETS.map((p) => ({
    label: danceFullName(p),
    values: Object.fromEntries(Object.entries(p).filter(([, v]) => v)) as Record<string, string>,
  })),
  presetsLead: 'The usual ones, with their steps. Rename them any time.',
  emptyHint: 'Add the dances performed. “Add common dances” has the usual ones with their steps.',
}

const items = computed(() => m.dances.value)

function setGroup(danceId: string, groupId: string, on: boolean) {
  const { data, summary } = planSetDanceGroup(m.state.value, danceId, groupId, on)
  return m.writeData(data, summary)
}
</script>

<template>
  <CollectionEditor :spec="spec" :items="items">
    <template #detail-extra="{ item }">
      <section v-if="m.groups.value.length" class="space-y-3">
        <div>
          <h3 class="text-heading">Age groups</h3>
          <p class="text-muted-foreground text-sm">Who dances it.</p>
        </div>
        <ul class="rows-engraved">
          <li v-for="g in m.groups.value" :key="g.id" class="py-1">
            <SwitchField :model-value="!!item.groupIds?.[g.id]" :label="g.label" :save="(on) => setGroup(item.id, g.id, on)" />
          </li>
        </ul>
      </section>
    </template>
  </CollectionEditor>
</template>
