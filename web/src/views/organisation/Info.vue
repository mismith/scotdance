<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { ExternalLink, Settings2 } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import FavoriteButton from '@/components/FavoriteButton.vue'
import OrganisationMark from '@/components/OrganisationMark.vue'
import ProfileCompetitions from '@/components/ProfileCompetitions.vue'
import { useOrganisationCompetitions, useOrganisations } from '@/composables/useOrganisations'
import { injectInfoHeaderSetter } from '@/composables/useScrolledPast'
import { competitionLinks, linkLabel } from '@/lib/competitionInfo'
import { formatExternalURL, formatHumanURL } from '@/lib/format'
import { profileColumns, profileHeader } from '@/lib/profile'
import { sanitizeRichText } from '@/lib/sanitize'
import { useMeStore } from '@/stores/me'

// An organisation: who they are, where to find out more, and their
// competitions, coming up and past.
const setHeader = injectInfoHeaderSetter()
const route = useRoute()
const me = useMeStore()
const id = computed(() => String(route.params.organisationId ?? ''))
const o = useOrganisations()
const org = computed(() => o.byId.value.get(id.value) ?? null)
const { byOrganisation, loading } = useOrganisationCompetitions()

const items = computed(() => (byOrganisation.value.get(id.value) ?? []).map((c) => ({ competitionId: c.id, competition: c })))
const links = computed(() => competitionLinks({ links: org.value?.links }))
const since = computed(() => {
  const years = items.value.map((i) => Number(String(i.competition.date ?? '').slice(0, 4))).filter((y) => y > 1900)
  return years.length ? Math.min(...years) : null
})
const subline = computed(() => {
  const n = items.value.length
  const count = n ? (n === 1 ? '1 competition' : `${n} competitions`) + (since.value && n > 1 ? ` since ${since.value}` : '') : null
  return [org.value?.shortName, org.value?.location, count].filter(Boolean).join(' · ')
})
</script>

<template>
  <article v-if="org" :class="profileColumns">
    <div :class="profileHeader">
      <header :ref="setHeader" class="flex items-center gap-4 lg:flex-col lg:items-start lg:gap-3">
        <OrganisationMark :organisation="org" size="lg" />
        <div class="min-w-0">
          <h1 class="text-display text-balance">{{ org.name }}</h1>
          <p v-if="subline" class="text-muted-foreground text-sm text-pretty">{{ subline }}</p>
        </div>
      </header>

      <div class="flex flex-wrap gap-2">
        <FavoriteButton :id="id" type="organisations" :name="org.name" labelled :variant="org.website || me.hasOrganisationPerm(id) ? 'tonal' : 'filled'" />
        <Button v-if="org.website" :href="formatExternalURL(org.website)" target="_blank" rel="noopener" class="max-w-full">
          <span class="truncate">{{ formatHumanURL(org.website) }}</span> <ExternalLink aria-hidden="true" />
        </Button>
        <Button v-if="me.hasOrganisationPerm(id)" :to="{ name: 'organisation.manage', params: { organisationId: id } }">
          <Settings2 aria-hidden="true" /> Manage
        </Button>
      </div>

      <section
        v-if="org.description"
        class="text-base leading-relaxed [&_a]:text-primary [&_a]:underline [&_p+p]:mt-3"
        v-html="sanitizeRichText(org.description)"
      />

      <div v-if="links.length" class="flex flex-wrap gap-2">
        <Button v-for="link in links" :key="link.id" :href="formatExternalURL(link.url)" target="_blank" rel="noopener" class="max-w-full">
          <span class="truncate">{{ linkLabel(link) }}</span> <ExternalLink aria-hidden="true" />
        </Button>
      </div>
    </div>

    <div class="space-y-5">
      <ProfileCompetitions :items="items" :loading="loading" empty-text="No competitions listed yet." :within="id" />
    </div>
  </article>
</template>
