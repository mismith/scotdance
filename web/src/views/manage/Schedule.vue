<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { DnDProvider } from '@vue-dnd-kit/core'
import { CalendarClock } from '@lucide/vue'
import EmptyState from '@/components/EmptyState.vue'
import SwitchField from '@/components/admin/SwitchField.vue'
import BuilderPalette from '@/components/admin/schedule/BuilderPalette.vue'
import ScheduleGrid from '@/components/admin/schedule/ScheduleGrid.vue'
import { provideBuilder } from '@/components/admin/schedule/builder'
import { useManagedCompetition } from '@/composables/admin/useManagedCompetition'
import { confirm, toast } from '@/lib/admin/feedback'
import { formatWeekday } from '@/lib/format'

// Manage › Schedule: drag dances, age groups and judges into a grid of
// sessions, events and platforms.

const route = useRoute()
const m = useManagedCompetition()
const b = provideBuilder(
  m,
  computed(() => (route.params.dayId ? String(route.params.dayId) : undefined)),
)

// Days are kept for competitions that already have several; new schedules
// use one, unnamed and unseen.
const dayTabs = computed(() =>
  b.days.value.map(([id, d], i) => ({
    id,
    label: d.name?.trim() || formatWeekday(d.date) || `Day ${i + 1}`,
  })),
)

const missing = computed(() =>
  [
    !m.platforms.value.length && { route: 'manage.platforms', label: 'platforms' },
    !m.dances.value.length && { route: 'manage.dances', label: 'dances' },
    !m.groups.value.length && { route: 'manage.groups', label: 'age groups' },
  ].filter((x): x is { route: string; label: string } => !!x),
)

async function setHidden(hidden: boolean) {
  if (hidden) {
    const hasAny = b.days.value.length > 0
    const ok = await confirm({
      title: 'Hide the Schedule tab?',
      message: hasAny
        ? 'The schedule built so far is deleted, and the tab disappears from the competition page.'
        : 'The tab disappears from the competition page.',
      confirmLabel: 'Hide schedule',
      destructive: hasAny,
    })
    if (!ok) return
    const change = await m.writeData({ schedule: false }, 'Hid the Schedule tab')
    toast('Schedule tab hidden', {
      action: { label: 'Undo', run: () => m.undoChange(change) },
    })
  } else {
    await m.writeData({ schedule: null }, 'Showed the Schedule tab')
  }
}
</script>

<template>
  <div v-if="m.scheduleHidden.value" class="mx-auto max-w-2xl space-y-6 p-4 md:p-8">
    <EmptyState
      :icon="CalendarClock"
      title="The schedule is hidden"
      description="This competition doesn’t show a schedule. Turn the tab back on to build one."
    />
    <div class="bg-card rounded-2xl border px-4 py-2">
      <SwitchField
        :model-value="true"
        label="Hide the Schedule tab"
        description="For competitions that won’t share a schedule here."
        :save="setHidden"
      />
    </div>
  </div>

  <div
    v-else
    class="flex h-[calc(100dvh-var(--chrome-top))] flex-col md:h-full md:flex-row"
  >
    <DnDProvider preview-to="body">
      <aside
        class="max-md:bg-card shrink-0 overflow-y-auto overscroll-contain p-4 max-md:max-h-[40dvh] max-md:border-b md:w-60 md:border-r"
      >
        <BuilderPalette />
        <div class="mt-6 border-t pt-1">
          <SwitchField
            :model-value="false"
            label="Hide the Schedule tab"
            description="For competitions that won’t share a schedule here."
            :save="setHidden"
          />
        </div>
      </aside>

      <div class="flex min-h-0 min-w-0 flex-1 flex-col">
        <nav
          v-if="dayTabs.length > 1"
          class="flex gap-1 overflow-x-auto border-b px-4 py-2"
          aria-label="Days"
        >
          <RouterLink
            v-for="d in dayTabs"
            :key="d.id"
            :to="{
              name: 'manage.schedule',
              params: { competitionId: m.competitionId.value, dayId: d.id },
            }"
            replace
            :aria-current="d.id === b.dayId.value ? 'page' : undefined"
            :class="[
              'flex h-9 shrink-0 items-center rounded-full px-4 text-[0.9375rem] font-bold',
              d.id === b.dayId.value
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-accent',
            ]"
          >
            {{ d.label }}
          </RouterLink>
        </nav>
        <p
          v-if="missing.length"
          class="bg-next text-next-foreground mx-4 mt-3 rounded-xl px-4 py-2.5 text-sm"
        >
          To fill in the schedule, add
          <template v-for="(x, i) in missing" :key="x.route">
            <RouterLink
              :to="{ name: x.route, params: { competitionId: m.competitionId.value } }"
              class="font-bold underline"
              >{{ x.label }}</RouterLink
            >{{ i < missing.length - 2 ? ', ' : i === missing.length - 2 ? ' and ' : '' }}
          </template>
          first.
        </p>
        <ScheduleGrid class="min-h-0 flex-1" />
      </div>
    </DnDProvider>
  </div>
</template>
