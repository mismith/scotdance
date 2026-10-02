<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { Check, ChevronRight, LayoutDashboard, TriangleAlert } from '@lucide/vue'
import { ADMINS_SECTION, MANAGE_STEPS } from '@/lib/admin/sections'
import { useManagedCompetition } from '@/composables/admin/useManagedCompetition'
import { CALLBACKS, OVERALL, danceState } from '@/lib/admin/results'
import { formatLongDate } from '@/lib/format'
import { danceHasPlaceholder } from '@/lib/results'
import { groupHasOverall } from '@/types/competition'

// The Manage sections as numbered steps, in the order a competition comes
// together, each ticked once it's done. `compact` is the sidebar; otherwise
// the bigger list on the Manage home (on phones).
const props = defineProps<{ compact?: boolean }>()

const route = useRoute()
const m = useManagedCompetition()

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

const status = computed<Record<string, { done: boolean; detail: string; count?: number; toFix?: number }>>(() => {
  const c = m.competition.value
  const groups = m.groups.value
  const withoutDances = groups.filter((g) => !m.groupDances(g.id).length).length
  const withoutGroup = m.dancers.value.filter((d) => !d.group).length
  let entered = 0
  let total = 0
  // Results with a "?" stand-in (a number missed on the day): touch-ups to do.
  let fixes = 0
  for (const g of groups) {
    const ids = [CALLBACKS, ...m.groupDances(g.id).map((d) => d.id), ...(groupHasOverall(g) ? [OVERALL] : [])]
    total += ids.length
    entered += ids.filter((id) => danceState(m.results.value[g.id]?.[id]) !== 'todo').length
    fixes += ids.filter((id) => danceHasPlaceholder(m.results.value, m.points.value, g.id, id)).length
  }
  return {
    details: {
      done: !!(c?.name && c?.date && (c?.venue || c?.location)),
      detail: c?.date ? `${formatLongDate(c.date)}${c.venue ? ` · ${c.venue}` : ''}` : 'Add the date and where it is',
    },
    staff: {
      done: m.judges.value.length > 0,
      detail: m.staff.value.length ? plural(m.judges.value.length, 'judge', 'judges') : 'Add the judges',
      count: m.staff.value.length,
    },
    dances: { done: m.dances.value.length > 0, detail: m.dances.value.length ? plural(m.dances.value.length, 'dance', 'dances') : 'Add the dances performed', count: m.dances.value.length },
    categories: {
      done: m.categories.value.length > 0,
      detail: m.categories.value.length ? plural(m.categories.value.length, 'category', 'categories') : 'Or import them with your dancers',
      count: m.categories.value.length,
    },
    groups: {
      done: groups.length > 0 && !withoutDances,
      detail: !groups.length ? 'Or import them with your dancers' : withoutDances ? `${plural(withoutDances, 'age group has', 'age groups have')} no dances yet` : plural(groups.length, 'age group', 'age groups'),
      count: groups.length,
    },
    dancers: {
      done: m.dancers.value.length > 0 && !withoutGroup,
      detail: !m.dancers.value.length ? 'Import from Excel or Google Sheets' : withoutGroup ? `${plural(withoutGroup, 'dancer needs', 'dancers need')} an age group` : plural(m.dancers.value.length, 'dancer', 'dancers'),
      count: m.dancers.value.length,
    },
    platforms: { done: m.platforms.value.length > 0, detail: m.platforms.value.length ? plural(m.platforms.value.length, 'platform', 'platforms') : 'Where dancing happens', count: m.platforms.value.length },
    schedule: { done: !!m.schedule.value || m.scheduleHidden.value, detail: m.scheduleHidden.value ? 'Hidden' : m.schedule.value ? 'Started' : 'Optional' },
    results: {
      done: m.resultsHidden.value || (total > 0 && entered === total && !fixes),
      detail: m.resultsHidden.value ? 'Hidden' : total ? `${entered} of ${total} entered` : 'On the day',
      toFix: m.resultsHidden.value ? 0 : fixes,
    },
  }
})

const toFix = computed(() => status.value.results?.toFix ?? 0)
const toFixLabel = computed(() => `${toFix.value} ${toFix.value === 1 ? 'result needs' : 'results need'} fixing`)

const isActive = (routeName: string) => route.matched.some((r) => r.name === routeName) || String(route.name ?? '').startsWith(`${routeName}.`)
const to = (routeName: string) => ({ name: routeName, params: { competitionId: m.competitionId.value } })
</script>

<template>
  <nav aria-label="Manage sections" :class="props.compact ? 'space-y-4' : 'space-y-6'">
    <RouterLink
      v-if="props.compact"
      :to="to('manage')"
      :aria-current="route.name === 'manage' ? 'page' : undefined"
      :class="['flex min-h-11 items-center gap-3 rounded-xl px-2', route.name === 'manage' ? 'bg-blue-paper text-primary font-bold' : 'hover:bg-accent font-semibold']"
    >
      <span class="text-muted-foreground flex size-7 shrink-0 items-center justify-center"><LayoutDashboard class="size-5" /></span>
      <span class="text-[0.9375rem]">Overview</span>
    </RouterLink>
    <ol :class="!props.compact && 'bg-card overflow-hidden rounded-2xl border shadow-sm'">
      <li v-for="(s, i) in MANAGE_STEPS" :key="s.id" class="relative">
        <!-- The line joining one step to the next -->
        <span
          v-if="i < MANAGE_STEPS.length - 1"
          aria-hidden="true"
          :class="[
            'absolute w-0.5',
            props.compact ? 'top-9 -bottom-2 left-[1.3125rem]' : 'top-12 -bottom-4 left-[1.9375rem]',
            status[s.id]?.done ? 'bg-done' : 'bg-border',
          ]"
        />
        <RouterLink
          :to="to(s.route)"
          :aria-current="isActive(s.route) ? 'page' : undefined"
          :class="[
            'relative flex items-center gap-3',
            props.compact ? 'min-h-11 rounded-xl px-2' : 'min-h-16 px-4 py-2.5',
            isActive(s.route) ? 'bg-blue-paper' : 'hover:bg-accent',
          ]"
        >
          <span
            :class="[
              'flex shrink-0 items-center justify-center rounded-full font-extrabold tabular-nums',
              props.compact ? 'size-7 text-xs' : 'size-8 text-sm',
              status[s.id]?.done ? 'bg-done text-done-foreground' : isActive(s.route) ? 'bg-primary-fill text-primary-foreground' : 'bg-muted text-muted-foreground',
              isActive(s.route) && status[s.id]?.done && 'ring-primary ring-2 ring-offset-2 ring-offset-(--color-blue-paper)',
            ]"
          >
            <Check v-if="status[s.id]?.done" :class="props.compact ? 'size-4' : 'size-4.5'" stroke-width="3" />
            <template v-else>{{ i + 1 }}</template>
          </span>
          <template v-if="props.compact">
            <span :class="['min-w-0 flex-1 truncate text-[0.9375rem]', isActive(s.route) ? 'text-primary font-bold' : 'font-semibold']">{{ s.title }}</span>
            <span v-if="status[s.id]?.count" class="text-muted-foreground text-sm tabular-nums">{{ status[s.id]?.count }}</span>
          </template>
          <template v-else>
            <span class="min-w-0 flex-1">
              <span class="block text-base font-bold">{{ s.title }}</span>
              <span class="text-muted-foreground block truncate text-sm">{{ status[s.id]?.detail ?? s.blurb }}</span>
            </span>
          </template>
          <!-- Touch-ups to do, at a glance -->
          <span
            v-if="s.id === 'results' && toFix"
            class="bg-next text-next-foreground flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-extrabold tabular-nums"
          >
            <TriangleAlert class="size-3.5" stroke-width="2.5" aria-hidden="true" />
            <span aria-hidden="true">{{ toFix }}</span><span class="sr-only">{{ toFixLabel }}</span>
          </span>
          <ChevronRight v-if="!props.compact" class="text-muted-foreground size-5 shrink-0" />
        </RouterLink>
      </li>
    </ol>

    <div :class="props.compact ? 'border-t pt-4' : 'bg-card overflow-hidden rounded-2xl border shadow-sm'">
      <RouterLink
        :to="to(ADMINS_SECTION.route)"
        :aria-current="isActive(ADMINS_SECTION.route) ? 'page' : undefined"
        :class="[
          'flex items-center gap-3',
          props.compact ? 'min-h-11 rounded-xl px-2' : 'min-h-16 px-4 py-2.5',
          isActive(ADMINS_SECTION.route) ? 'bg-blue-paper' : 'hover:bg-accent',
        ]"
      >
        <span :class="['text-muted-foreground flex shrink-0 items-center justify-center', props.compact ? 'size-7' : 'size-8']">
          <component :is="ADMINS_SECTION.icon" class="size-5" />
        </span>
        <template v-if="props.compact">
          <span :class="['min-w-0 flex-1 truncate text-[0.9375rem]', isActive(ADMINS_SECTION.route) ? 'text-primary font-bold' : 'font-semibold']">{{ ADMINS_SECTION.title }}</span>
        </template>
        <template v-else>
          <span class="min-w-0 flex-1">
            <span class="block text-base font-bold">{{ ADMINS_SECTION.title }}</span>
            <span class="text-muted-foreground block truncate text-sm">{{ ADMINS_SECTION.blurb }}</span>
          </span>
          <ChevronRight class="text-muted-foreground size-5 shrink-0" />
        </template>
      </RouterLink>
    </div>
  </nav>
</template>
