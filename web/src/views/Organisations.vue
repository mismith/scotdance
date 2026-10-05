<script setup lang="ts">
import { computed } from 'vue'
import { Landmark } from '@lucide/vue'
import EntityIndex from '@/components/EntityIndex.vue'
import OrganisationMark from '@/components/OrganisationMark.vue'
import { useOrganisationCompetitions, useOrganisations } from '@/composables/useOrganisations'
import type { AggregateRow } from '@/composables/useEntityAggregates'

// Every organisation with a competition anyone can see: an empty one (just
// made, not yet approved or listed) waits until it has one.
const o = useOrganisations()
const { byOrganisation, loading: competitionsLoading } = useOrganisationCompetitions()

const rows = computed(() =>
  o.organisations.value.flatMap((org) => {
    const listed = (byOrganisation.value.get(org.id) ?? []).filter((c) => c.listed === true)
    if (!listed.length) return []
    const agg: AggregateRow = { ...org, appearanceCount: listed.length }
    return [{ id: org.id, agg }]
  }),
)
const source = {
  data: rows,
  loading: computed(() => !o.loaded.value || competitionsLoading.value),
  error: o.error,
  retry: o.retry,
}

function subtitleOf(agg: AggregateRow) {
  const count = agg.appearanceCount ?? 0
  const comps = count === 1 ? '1 competition' : `${count} competitions`
  return [agg.shortName, agg.location, comps].filter(Boolean).join(' · ')
}
</script>

<template>
  <EntityIndex
    namespace="organisations"
    route-prefix="organisation"
    id-param="organisationId"
    :subtitle-of="subtitleOf"
    placeholder="Find an organisation"
    :places="Landmark"
    :source="source"
  >
    <template #mark="{ row }">
      <OrganisationMark :organisation="row" />
    </template>
  </EntityIndex>
</template>
