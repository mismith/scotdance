<script setup lang="ts">
import { computed } from 'vue'
import { Plus } from '@lucide/vue'
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
const matches = computed(() => props.existing ? suggestions.value.existing.filter((o) => !props.allowed || props.allowed.includes(o.id)) : [])
</script>

<template>
  <div v-if="orgs.loaded.value && !orgs.error.value && (matches.length || suggestions.fresh.length)" class="space-y-2" aria-label="Suggested organisations">
    <p class="text-muted-foreground text-sm">From the competition’s name</p>
    <div class="rows-engraved">
      <button v-for="org in matches" :key="org.id" type="button" :disabled="disabled" class="press-row focus-inset flex min-h-16 w-full items-center gap-3 py-2 text-left" @click="emit('pick', org)">
        <OrganisationMark :organisation="org" />
        <span class="min-w-0 flex-1"><span class="block text-base font-semibold">{{ org.name }}</span><span class="text-muted-foreground block text-sm">Add existing organisation</span></span>
        <Plus class="size-5 shrink-0" aria-hidden="true" />
      </button>
      <button v-for="org in suggestions.fresh" :key="org.name" type="button" :disabled="disabled" class="press-row focus-inset flex min-h-16 w-full items-center gap-3 py-2 text-left" @click="emit('create', { ...org, location }, $event)">
        <OrganisationMark :organisation="org" />
        <span class="min-w-0 flex-1"><span class="block text-base font-semibold">{{ org.name }}</span><span class="text-muted-foreground block text-sm">Create organisation…</span></span>
        <Plus class="size-5 shrink-0" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>
