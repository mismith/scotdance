<script setup lang="ts">
import { computed } from 'vue'
import OrganisationMark from '@/components/OrganisationMark.vue'
import { useOrganisations } from '@/composables/useOrganisations'
import { organisationSuggestions, type OrganisationDraft } from '@/lib/organisationSuggestions'
import type { OrganisationListItem } from '@/types/organisation'

const props = withDefaults(defineProps<{
  name: string
  location?: string
  chosen?: string[]
  drafts?: OrganisationDraft[]
  existing?: boolean
  allowed?: string[]
  disabled?: boolean
}>(), { chosen: () => [], drafts: () => [], existing: true, location: undefined, allowed: undefined, disabled: false })
const emit = defineEmits<{ pick: [org: OrganisationListItem]; create: [draft: OrganisationDraft, event: MouseEvent] }>()
const orgs = useOrganisations()
const suggestions = computed(() => organisationSuggestions(props.name, orgs.organisations.value, props.chosen, props.drafts))
// A button's label, not a + that reads as already added.
const ADD = 'bg-blue-paper text-primary shrink-0 rounded-full px-3 py-1 text-sm font-semibold'
const matches = computed(() => props.existing ? suggestions.value.existing.filter((o) => !props.allowed || props.allowed.includes(o.id)) : [])
</script>

<template>
  <div v-if="orgs.loaded.value && !orgs.error.value && (matches.length || suggestions.fresh.length)" class="space-y-2" aria-label="Suggested organisations">
    <p class="text-muted-foreground text-sm">Suggested from the competition’s name</p>
    <div class="rows-engraved">
      <button v-for="org in matches" :key="org.id" type="button" :disabled="disabled" class="press-row focus-inset flex min-h-16 w-full items-center gap-3 py-2 text-left" @click="emit('pick', org)">
        <OrganisationMark :organisation="org" ghost />
        <span class="text-muted-foreground min-w-0 flex-1"><span class="block text-base">{{ org.name }}</span><span class="block text-sm">On ScotDance.app</span></span>
        <span :class="ADD">Add</span>
      </button>
      <button v-for="org in suggestions.fresh" :key="org.name" type="button" :disabled="disabled" class="press-row focus-inset flex min-h-16 w-full items-center gap-3 py-2 text-left" @click="emit('create', { ...org, location }, $event)">
        <OrganisationMark :organisation="org" ghost />
        <span class="text-muted-foreground min-w-0 flex-1"><span class="block text-base">{{ org.name }}</span><span class="block text-sm">New organisation</span></span>
        <span :class="ADD">Add…</span>
      </button>
    </div>
  </div>
</template>
