<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { DnDProvider } from '@vue-dnd-kit/core'
import { CalendarClock, EyeOff, Trash2 } from '@lucide/vue'
import EmptyState from '@/components/EmptyState.vue'
import Button from '@/components/ui/Button.vue'
import SectionHeader from '@/components/admin/SectionHeader.vue'
import SectionMenu from '@/components/admin/SectionMenu.vue'
import BuilderPalette from '@/components/admin/schedule/BuilderPalette.vue'
import InlineEdit from '@/components/admin/schedule/InlineEdit.vue'
import ScheduleGrid from '@/components/admin/schedule/ScheduleGrid.vue'
import { isoDate, provideBuilder } from '@/components/admin/schedule/builder'
import { useHideTab } from '@/composables/admin/useHideTab'
import { useManagedCompetition } from '@/composables/admin/useManagedCompetition'
import { confirm } from '@/lib/admin/feedback'
import { canEdit } from '@/lib/admin/write'
import { dayLabel } from '@/lib/schedule'

// Manage › Schedule: drag dances, age groups and judges into a grid of
// sessions, events and platforms.

const route = useRoute()
const router = useRouter()
const m = useManagedCompetition()
const hideTab = useHideTab('schedule')
const b = provideBuilder(
  m,
  computed(() => (route.params.dayId ? String(route.params.dayId) : undefined)),
)

// Most competitions have one day, kept out of sight. Adding another (under
// the grid) brings tabs to switch days, and a row to name, date or delete
// the one showing.
const dayTabs = computed(() =>
  b.days.value.map(([id, d], i) => ({ id, label: dayLabel(d, i) })),
)
const day = computed(() => {
  const found = b.days.value.find(([id]) => id === b.dayId.value)
  return found && { id: found[0], ...found[1], label: b.dayName(found[0]) }
})
const showDay = (dayId?: string) =>
  router.replace({
    name: 'manage.schedule',
    params: { competitionId: m.competitionId.value, dayId },
  })

function renameDay(name: string) {
  if (day.value) void b.renameDay(day.value.id, name)
}
function setDayDate(e: Event) {
  if (day.value) void b.setDayDate(day.value.id, (e.target as HTMLInputElement).value)
}
async function removeDay() {
  if (!day.value) return
  const { id, label } = day.value
  const sessions = Object.keys(day.value.blocks ?? {}).length
  if (
    sessions &&
    !(await confirm({
      title: `Delete ${label}?`,
      message: `Its ${sessions === 1 ? 'session goes' : `${sessions} sessions go`} too. You can undo this straight after.`,
      confirmLabel: 'Delete',
      destructive: true,
    }))
  )
    return
  void showDay(undefined)
  void b.removeDay(id)
}

const missing = computed(() =>
  [
    !m.platforms.value.length && { route: 'manage.platforms', label: 'platforms' },
    !m.dances.value.length && { route: 'manage.dances', label: 'dances' },
    !m.groups.value.length && { route: 'manage.groups', label: 'age groups' },
  ].filter((x): x is { route: string; label: string } => !!x),
)
</script>

<template>
  <div v-if="hideTab.hidden.value" class="p-4 md:p-8">
    <SectionHeader title="Schedule" />
    <EmptyState
      :icon="CalendarClock"
      title="The schedule is hidden"
      description="The competition page has no Schedule tab."
    >
      <Button variant="primary" :disabled="!canEdit" @click="hideTab.show()">
        Show the Schedule tab
      </Button>
    </EmptyState>
  </div>

  <div
    v-else
    class="flex h-[calc(100dvh-var(--chrome-top))] flex-col md:h-full md:flex-row"
  >
    <DnDProvider preview-to="body">
      <aside
        class="shrink-0 overflow-y-auto overscroll-contain p-4 max-md:max-h-[40dvh] max-md:border-b md:w-68 md:border-r"
      >
        <SectionHeader title="Schedule" class="mb-6">
          <!-- Hiding the tab deletes the schedule, after asking. (With no
               schedule yet, the empty grid offers it instead.) -->
          <template v-if="b.days.value.length" #actions>
            <SectionMenu v-slot="{ row, close }" label="More for the schedule">
              <button type="button" :class="row" :disabled="!canEdit" @click="close(); hideTab.hide()">
                <EyeOff /> Hide the Schedule tab
              </button>
            </SectionMenu>
          </template>
        </SectionHeader>
        <BuilderPalette />
      </aside>

      <div class="flex min-h-0 min-w-0 flex-1 flex-col">
        <!-- Days, as tabs like those in results entry -->
        <nav
          v-if="dayTabs.length > 1"
          class="flex shrink-0 overflow-x-auto border-b px-2"
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
              'text-callout flex h-12 shrink-0 items-center border-b-2 px-3 font-semibold',
              d.id === b.dayId.value
                ? 'border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground border-transparent',
            ]"
          >
            {{ d.label }}
          </RouterLink>
        </nav>
        <div
          v-if="dayTabs.length > 1 && day"
          :key="day.id"
          class="group/day flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-3"
        >
          <h2 class="text-heading min-w-0">
            <InlineEdit
              :model-value="day.name ?? ''"
              :placeholder="day.label"
              label="Day name"
              :readonly="b.readonly.value"
              @update:model-value="renameDay"
            />
          </h2>
          <input
            type="date"
            :value="isoDate(day.date)"
            :aria-label="`Date of ${day.label}`"
            :disabled="b.readonly.value"
            class="field h-11 rounded-xl px-3 text-base disabled:opacity-(--disabled-opacity)"
            @change="setDayDate"
          />
          <button
            v-if="!b.readonly.value"
            type="button"
            :aria-label="`Delete ${day.label}`"
            class="press text-muted-foreground hover:text-destructive ml-auto flex size-11 items-center justify-center rounded-full opacity-0 transition-opacity group-hover/day:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
            @click="removeDay"
          >
            <Trash2 class="size-4" />
          </button>
        </div>
        <p
          v-if="missing.length"
          class="bg-next text-next-foreground mx-4 mt-3 rounded-xl px-4 py-2.5 text-sm"
        >
          To fill in the schedule, add
          <template v-for="(x, i) in missing" :key="x.route">
            <RouterLink
              :to="{ name: x.route, params: { competitionId: m.competitionId.value } }"
              class="font-semibold underline"
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
