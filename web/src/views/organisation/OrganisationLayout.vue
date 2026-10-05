<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import EntityLayout from '@/components/EntityLayout.vue'
import { useOrganisations } from '@/composables/useOrganisations'
import { useRecentEntities } from '@/composables/useRecentEntities'

const route = useRoute()
const id = computed(() => String(route.params.organisationId ?? ''))
const o = useOrganisations()
const organisation = computed(() => o.byId.value.get(id.value) ?? null)
const recent = useRecentEntities('organisations')
watch(
  organisation,
  (org) => {
    if (org?.name) recent.record(id.value, org.name)
  },
  { immediate: true },
)
</script>

<template>
  <EntityLayout
    scope="organisation"
    section-route-name="organisations"
    :display-name="organisation?.name ?? ''"
    :loading="!o.loaded.value"
    :not-found="o.loaded.value && !organisation"
    empty-title="Organisation not found"
    empty-description="It may have been removed, or the link is out of date."
  />
</template>
