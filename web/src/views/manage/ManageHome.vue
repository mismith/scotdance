<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { Check, ChevronRight, Circle, Eye, EyeOff } from '@lucide/vue'
import SectionNav from '@/components/admin/SectionNav.vue'
import SwitchField from '@/components/admin/SwitchField.vue'
import { useManagedCompetition } from '@/composables/admin/useManagedCompetition'
import { useSidebar } from '@/composables/admin/useWide'
import { formatLongDate } from '@/lib/format'

const m = useManagedCompetition()
const sidebar = useSidebar()
const c = computed(() => m.competition.value)

interface Step {
  done: boolean
  title: string
  detail: string
  route: string
}

const steps = computed<Step[]>(() => {
  const groupsWithoutDances = m.groups.value.filter((g) => !m.groupDances(g.id).length).length
  const dancersWithoutGroup = m.dancers.value.filter((d) => !d.group).length
  return [
    {
      done: !!(c.value?.name && c.value?.date && (c.value?.venue || c.value?.location)),
      title: 'Details',
      detail: c.value?.date ? `${formatLongDate(c.value.date)}${c.value.venue ? ` · ${c.value.venue}` : ''}` : 'Add the date and where it is',
      route: 'manage.details',
    },
    {
      done: m.categories.value.length > 0 && m.groups.value.length > 0,
      title: 'Categories and age groups',
      detail: m.groups.value.length ? `${m.groups.value.length} age groups in ${m.categories.value.length} categories` : 'Add them, or import them with your dancers',
      route: 'manage.groups',
    },
    {
      done: m.dances.value.length > 0 && groupsWithoutDances === 0,
      title: 'Dances',
      detail: !m.dances.value.length
        ? 'Add the dances performed'
        : groupsWithoutDances
          ? `${groupsWithoutDances} ${groupsWithoutDances === 1 ? 'age group has' : 'age groups have'} no dances yet`
          : `${m.dances.value.length} dances, set for every age group`,
      route: m.dances.value.length ? 'manage.groups' : 'manage.dances',
    },
    {
      done: m.dancers.value.length > 0 && dancersWithoutGroup === 0,
      title: 'Dancers',
      detail: !m.dancers.value.length
        ? 'Import your entry list from Excel'
        : dancersWithoutGroup
          ? `${dancersWithoutGroup} ${dancersWithoutGroup === 1 ? 'dancer needs' : 'dancers need'} an age group`
          : `${m.dancers.value.length} dancers`,
      route: 'manage.dancers',
    },
    {
      done: !!m.schedule.value || m.scheduleHidden.value,
      title: 'Schedule',
      detail: m.scheduleHidden.value ? 'Hidden for this competition' : m.schedule.value ? 'Started' : 'Optional: sessions, events and platforms',
      route: 'manage.schedule',
    },
  ]
})

const doneCount = computed(() => steps.value.filter((s) => s.done).length)

const visibility = computed(() => {
  if (c.value?.published) return { icon: Eye, text: 'Published: everyone can see everything.' }
  if (c.value?.listed) return { icon: Eye, text: 'Listed: basic details are public; dancers, schedule and results aren’t yet.' }
  return { icon: EyeOff, text: 'Private: only admins can see this competition.' }
})
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-8 p-4 pb-[calc(2rem+var(--safe-bottom))] md:p-8">
    <header class="space-y-1">
      <p class="text-muted-foreground text-sm font-bold">{{ c?.date ? formatLongDate(c.date) : 'No date yet' }}</p>
      <h1 class="text-display">{{ c?.name || 'Untitled competition' }}</h1>
      <p class="text-muted-foreground flex items-center gap-1.5 text-base">
        <component :is="visibility.icon" class="size-4 shrink-0" /> {{ visibility.text }}
      </p>
    </header>

    <section class="bg-card space-y-1 rounded-2xl border px-4 py-2 shadow-sm">
      <SwitchField
        :model-value="!!c?.listed"
        label="Listed"
        description="Shows in the competitions list with its date, venue and judges."
        :save="(on) => m.writeInfo(on ? { listed: true } : { listed: false, published: false })"
      />
      <div class="border-t" />
      <SwitchField
        :model-value="!!c?.published"
        label="Published"
        description="Also shows dancers, the schedule and results."
        :save="(on) => m.writeInfo(on ? { published: true, listed: true } : { published: false })"
      />
    </section>

    <section class="space-y-3">
      <div class="flex items-baseline justify-between gap-2">
        <h2 class="text-heading">Getting ready</h2>
        <span class="text-muted-foreground text-sm font-semibold tabular-nums">{{ doneCount }} of {{ steps.length }} done</span>
      </div>
      <ol class="bg-card divide-y overflow-hidden rounded-2xl border shadow-sm">
        <li v-for="s in steps" :key="s.title">
          <RouterLink :to="{ name: s.route, params: { competitionId: m.competitionId.value } }" class="hover:bg-accent flex min-h-16 items-center gap-3 px-4 py-2.5">
            <span
              :class="[
                'flex size-7 shrink-0 items-center justify-center rounded-full',
                s.done ? 'bg-done text-done-foreground' : 'text-muted-foreground',
              ]"
            >
              <Check v-if="s.done" class="size-4" stroke-width="3" />
              <Circle v-else class="size-5" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-base font-bold">{{ s.title }}</span>
              <span class="text-muted-foreground block text-sm">{{ s.detail }}</span>
            </span>
            <ChevronRight class="text-muted-foreground size-5 shrink-0" />
          </RouterLink>
        </li>
      </ol>
    </section>

    <SectionNav v-if="!sidebar" />
  </div>
</template>
