<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useOrganisations } from '@/composables/useOrganisations'
import { competitionTitle } from '@/lib/competitionTitle'
import type { Competition } from '@/types/competition'

// A competition's name, led by its organisation's short name in another
// colour ("CHDA Winter Wonderland"; lib/competitionTitle drops it from the
// name when it's there already). With `link`, the short name goes to the
// organisation's page: for where the name isn't inside a link already.
const props = defineProps<{
  competition: Pick<Competition, 'name' | 'organisations'>
  link?: boolean
  /** On this organisation's own page: its name comes off the front, and nothing goes in front. */
  within?: string | null
  fallback?: string
}>()
const organisations = useOrganisations()
const title = computed(() => competitionTitle(props.competition, organisations.byId.value, { fallback: props.fallback, within: props.within }))
</script>

<template>
  <RouterLink
    v-if="title.prefix && link"
    :to="{ name: 'organisation.info', params: { organisationId: title.organisationId } }"
    class="text-primary focus-inset rounded-sm hover:underline"
    >{{ title.prefix }}</RouterLink
  ><span v-else-if="title.prefix" class="text-muted-foreground">{{ title.prefix }}</span>{{ title.prefix ? ` ${title.name}` : title.name }}
</template>
