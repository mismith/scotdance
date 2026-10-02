<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { ChevronRight, Eye, EyeOff, Trophy } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import SectionNav from '@/components/admin/SectionNav.vue'
import SwitchField from '@/components/admin/SwitchField.vue'
import { useManagedCompetition } from '@/composables/admin/useManagedCompetition'
import { useSetup } from '@/composables/admin/useSetup'
import { useSidebar } from '@/composables/admin/useWide'
import { formatLongDate } from '@/lib/format'

const m = useManagedCompetition()
const sidebar = useSidebar()
const { status, next, action, problems, today, carryOn } = useSetup()
const c = computed(() => m.competition.value)

const visibility = computed(() => {
  if (c.value?.published) return { icon: Eye, text: 'Published: everyone can see everything.' }
  if (c.value?.listed) return { icon: Eye, text: 'Listed: basic details are public; dancers, schedule and results aren’t yet.' }
  return { icon: EyeOff, text: 'Private: only admins can see this competition.' }
})
const results = computed(() => ({ name: 'manage.results', params: { competitionId: m.competitionId.value } }))
</script>

<template>
  <div class="max-w-3xl space-y-8 p-4 pb-[calc(2rem+var(--safe-bottom))]">
    <header class="space-y-1">
      <p class="text-muted-foreground text-sm font-medium">{{ c?.date ? formatLongDate(c.date) : 'No date yet' }}</p>
      <h1 class="text-display">{{ c?.name || 'Untitled competition' }}</h1>
      <!-- On the day, the line under the name is the way into results
           entry, at the dance to carry on with (who can see it is below). -->
      <RouterLink
        v-if="today"
        :to="carryOn?.to ?? results"
        class="press-row focus-inset -mx-2 flex min-h-12 items-center gap-3 rounded-xl px-2 py-1"
      >
        <span class="bg-live-paper text-live flex size-9 shrink-0 items-center justify-center rounded-full">
          <Trophy class="size-4.5" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="text-primary block text-base font-semibold">Enter results</span>
          <span class="text-muted-foreground block truncate text-sm">{{ carryOn ? `Carry on: ${carryOn.label}` : 'Everything’s entered so far' }}</span>
        </span>
        <ChevronRight class="text-muted-foreground size-5 shrink-0" />
      </RouterLink>
      <p v-else class="text-muted-foreground flex items-start gap-1.5 text-base">
        <component :is="visibility.icon" class="mt-1 size-4 shrink-0" /> {{ visibility.text }}
      </p>
    </header>

    <section class="surface rounded-2xl px-4 py-1.5">
      <SwitchField
        :model-value="!!c?.listed"
        label="Listed"
        description="Shows in the competitions list with its date, venue and judges."
        :save="(on) => m.writeInfo(on ? { listed: true } : { listed: false, published: false }, on ? 'Listed' : 'Unlisted')"
      />
      <div class="border-t" />
      <SwitchField
        :model-value="!!c?.published"
        label="Published"
        description="Also shows dancers, the schedule and results."
        :save="(on) => m.writeInfo(on ? { published: true, listed: true } : { published: false }, on ? 'Published' : 'Unpublished')"
      />
    </section>

    <!-- With the steps in the sidebar, the Overview says what's next and what needs fixing instead. -->
    <template v-if="sidebar">
      <section v-if="next" class="space-y-3">
        <h2 class="text-heading">Up next</h2>
        <div class="surface flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl p-4">
          <span class="bg-blue-paper text-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
            <component :is="next.icon" class="size-5" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-base font-semibold">{{ next.title }}</span>
            <span class="text-muted-foreground block text-sm">{{ status[next.id]?.detail ?? next.blurb }}</span>
          </span>
          <Button variant="primary" :to="action(next.id).to">{{ action(next.id).label }}</Button>
        </div>
      </section>

      <section v-if="problems.length" class="space-y-3">
        <h2 class="text-heading">To fix</h2>
        <ul class="surface divide-y overflow-hidden rounded-2xl">
          <li v-for="p in problems" :key="p.id">
            <RouterLink :to="p.to" class="press-row focus-inset flex min-h-14 items-center gap-3 py-2 pr-3 pl-4">
              <!-- Caution tape: unfinished, not broken. -->
              <span
                aria-hidden="true"
                class="h-8 w-1.5 shrink-0 rounded-full bg-[repeating-linear-gradient(135deg,var(--next-foreground)_0_3px,var(--next)_3px_6px)]"
              />
              <span class="min-w-0 flex-1 text-base font-medium">{{ p.text }}</span>
              <span class="text-primary text-sm font-semibold">Fix</span>
              <ChevronRight class="text-muted-foreground size-5 shrink-0" />
            </RouterLink>
          </li>
        </ul>
      </section>

      <p v-if="!next && !problems.length" class="text-muted-foreground text-base">Every step is done.</p>
    </template>

    <section v-else class="space-y-3">
      <h2 class="text-heading">Step by step</h2>
      <SectionNav />
    </section>
  </div>
</template>
