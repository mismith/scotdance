<script setup lang="ts">
import { computed } from 'vue'
import { ExternalLink, MapPin } from '@lucide/vue'
import CompetitionDateRow from '@/components/CompetitionDateRow.vue'
import DateTile from '@/components/DateTile.vue'
import { competitionLinks, linkLabel, registrationLines, registrationOpen } from '@/lib/competitionInfo'
import { formatLongDate } from '@/lib/format'
import { sanitizeRichText } from '@/lib/sanitize'
import type { Competition } from '@/types/competition'

// Beside Manage › Details on wide screens: what people will see, in the
// competitions list and at the top of its page. Read only; it follows each
// field as it saves.
const props = defineProps<{ competition: Competition; competitionId: string }>()

const c = computed(() => props.competition)
const links = computed(() => competitionLinks(c.value))
const regLines = computed(() => registrationLines(c.value))
const regOpen = computed(() => registrationOpen(c.value))
const kicker = computed(() => [c.value.date ? formatLongDate(c.value.date) : null, c.value.location].filter(Boolean).join(' · '))
const where = computed(() => [c.value.address, c.value.location].filter(Boolean).join(', '))
</script>

<template>
  <div class="space-y-6" inert>
    <section class="space-y-2">
      <h3 class="text-muted-foreground text-sm font-medium">In the competitions list</h3>
      <ul class="surface divide-y overflow-hidden rounded-2xl">
        <CompetitionDateRow :competition="c" :to="{ name: 'competition.info', params: { competitionId } }" :mark-managed="false" />
      </ul>
    </section>

    <section class="space-y-2">
      <h3 class="text-muted-foreground text-sm font-medium">At the top of its page</h3>
      <div class="bg-background space-y-4 rounded-2xl p-4 shadow-(--shadow-card)">
        <header class="flex items-start gap-3">
          <img v-if="c.image" :src="c.image" alt="" class="size-14 shrink-0 rounded-xl object-cover" />
          <DateTile v-else :date="c.date" class="h-14" />
          <div class="min-w-0 flex-1">
            <p v-if="kicker" class="text-muted-foreground text-sm font-medium">{{ kicker }}</p>
            <p class="text-title">{{ c.name || 'Competition' }}</p>
          </div>
        </header>

        <div v-if="c.venue || where" class="surface flex items-center gap-3 rounded-xl p-3">
          <MapPin class="text-primary size-5 shrink-0" />
          <div class="min-w-0">
            <p v-if="c.venue" class="text-base font-semibold">{{ c.venue }}</p>
            <p v-if="where" class="text-muted-foreground text-sm">{{ where }}</p>
          </div>
        </div>

        <div v-if="c.registrationURL || links.length" class="space-y-2">
          <span
            v-if="c.registrationURL"
            :class="['bg-primary-fill text-primary-foreground flex h-12 items-center justify-center gap-2 rounded-full text-base font-semibold', !regOpen && 'opacity-(--disabled-opacity)']"
          >
            Register <ExternalLink class="size-4" />
          </span>
          <p v-for="line in regLines" :key="line" class="text-muted-foreground text-sm">{{ line }}</p>
          <div v-if="links.length" class="flex flex-wrap gap-2 pt-1">
            <span
              v-for="link in links"
              :key="link.id"
              class="surface text-callout inline-flex h-11 max-w-full items-center gap-1.5 rounded-full px-4 font-semibold"
            >
              <span class="truncate">{{ linkLabel(link) }}</span> <ExternalLink class="size-4 shrink-0" />
            </span>
          </div>
        </div>

        <!-- eslint-disable-next-line vue/no-v-html -- sanitised, as on the competition page -->
        <div v-if="c.description" class="text-base leading-relaxed [&_a]:text-primary [&_a]:underline [&_p+p]:mt-3" v-html="sanitizeRichText(c.description)" />

        <p v-if="c.sobhd" class="text-muted-foreground flex justify-between text-sm">
          <span>RSOBHD sanctioned</span>
          <span class="font-semibold tabular-nums">{{ c.sobhd }}</span>
        </p>
      </div>
    </section>
  </div>
</template>
