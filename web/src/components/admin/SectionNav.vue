<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'
import { Check, ChevronRight, LayoutDashboard, TriangleAlert } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import { ADMINS_SECTION, MANAGE_STEPS } from '@/lib/admin/sections'
import { useManagedCompetition } from '@/composables/admin/useManagedCompetition'
import { useSetup } from '@/composables/admin/useSetup'

// The Manage sections as steps, in the order a competition comes together,
// each ticked once it's done, and the first one still to do marked Next.
// `compact` is the sidebar, where a step's mark is a glyph (a number there
// reads as a count); otherwise the bigger numbered list on the Manage home
// (on phones), where Next also gets the button that does it.
const props = defineProps<{ compact?: boolean }>()

const route = useRoute()
const m = useManagedCompetition()
const { status, next, action, toFix } = useSetup()

const toFixLabel = () => `${toFix.value} ${toFix.value === 1 ? 'result needs' : 'results need'} fixing`

const isActive = (routeName: string) => route.matched.some((r) => r.name === routeName) || String(route.name ?? '').startsWith(`${routeName}.`)
const to = (routeName: string) => ({ name: routeName, params: { competitionId: m.competitionId.value } })
</script>

<template>
  <nav aria-label="Manage sections" :class="props.compact ? 'space-y-4' : 'space-y-6'">
    <RouterLink
      v-if="props.compact"
      :to="to('manage')"
      :aria-current="route.name === 'manage' ? 'page' : undefined"
      :class="[
        'press-row flex min-h-11 items-center gap-3 rounded-xl px-2',
        route.name === 'manage' ? 'bg-blue-paper text-primary font-semibold' : 'font-medium',
      ]"
    >
      <span class="text-muted-foreground flex size-7 shrink-0 items-center justify-center"><LayoutDashboard class="size-5" /></span>
      <span class="text-callout">Overview</span>
    </RouterLink>
    <ol :class="!props.compact && 'surface overflow-hidden rounded-2xl'">
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
            'press-row focus-inset relative flex items-center gap-3',
            props.compact ? 'min-h-11 rounded-xl px-2' : 'min-h-16 px-4 py-2.5',
            isActive(s.route) && 'bg-blue-paper',
          ]"
        >
          <span
            :class="[
              'flex shrink-0 items-center justify-center rounded-full font-bold tabular-nums',
              props.compact ? 'size-7 text-xs' : 'size-8 text-sm',
              status[s.id]?.done
                ? 'bg-done text-done-foreground'
                : next?.id === s.id || isActive(s.route)
                  ? props.compact
                    ? 'bg-card shadow-[inset_0_0_0_2px_var(--primary)]'
                    : 'bg-primary-fill text-primary-foreground'
                  : props.compact
                    ? 'bg-card shadow-[inset_0_0_0_1.5px_var(--strong)]'
                    : 'bg-muted text-muted-foreground',
              isActive(s.route) && status[s.id]?.done && 'ring-primary ring-2 ring-offset-2 ring-offset-(--color-blue-paper)',
            ]"
          >
            <Check v-if="status[s.id]?.done" :class="props.compact ? 'size-4' : 'size-4.5'" stroke-width="3" />
            <!-- In the sidebar: a dot for the one to do next, else an empty ring. -->
            <span v-else-if="props.compact" :class="['size-2 rounded-full', next?.id === s.id || isActive(s.route) ? 'bg-primary' : 'hidden']" />
            <template v-else>{{ i + 1 }}</template>
          </span>
          <template v-if="props.compact">
            <span :class="['text-callout min-w-0 flex-1 truncate', isActive(s.route) ? 'text-primary font-semibold' : 'font-medium']">{{ s.title }}</span>
            <span v-if="next?.id === s.id" class="bg-next text-next-foreground rounded-full px-2 py-0.5 text-xs font-semibold">Next</span>
            <span v-else-if="status[s.id]?.count" class="text-muted-foreground text-sm tabular-nums">{{ status[s.id]?.count }}</span>
          </template>
          <template v-else>
            <span class="min-w-0 flex-1">
              <span class="flex items-center gap-2">
                <span class="text-base font-semibold">{{ s.title }}</span>
                <span v-if="next?.id === s.id" class="bg-next text-next-foreground rounded-full px-2 py-0.5 text-xs font-semibold">Next</span>
              </span>
              <span class="text-muted-foreground block truncate text-sm">{{ status[s.id]?.detail ?? s.blurb }}</span>
            </span>
          </template>
          <!-- Touch-ups to do, at a glance -->
          <span
            v-if="s.id === 'results' && toFix"
            class="bg-next text-next-foreground flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-bold tabular-nums"
          >
            <TriangleAlert class="size-3.5" stroke-width="2.5" aria-hidden="true" />
            <span aria-hidden="true">{{ toFix }}</span><span class="sr-only">{{ toFixLabel() }}</span>
          </span>
          <ChevronRight v-if="!props.compact" class="text-muted-foreground size-5 shrink-0" />
        </RouterLink>
        <!-- Start here: the next step's own button -->
        <div v-if="!props.compact && next?.id === s.id" class="relative pr-4 pb-3.5 pl-16">
          <Button variant="primary" :to="action(s.id).to">{{ action(s.id).label }}</Button>
        </div>
      </li>
    </ol>

    <div :class="!props.compact && 'surface overflow-hidden rounded-2xl'">
      <RouterLink
        :to="to(ADMINS_SECTION.route)"
        :aria-current="isActive(ADMINS_SECTION.route) ? 'page' : undefined"
        :class="[
          'press-row focus-inset flex items-center gap-3',
          props.compact ? 'min-h-11 rounded-xl px-2' : 'min-h-16 px-4 py-2.5',
          isActive(ADMINS_SECTION.route) && 'bg-blue-paper',
        ]"
      >
        <span :class="['text-muted-foreground flex shrink-0 items-center justify-center', props.compact ? 'size-7' : 'size-8']">
          <component :is="ADMINS_SECTION.icon" class="size-5" />
        </span>
        <template v-if="props.compact">
          <span :class="['text-callout min-w-0 flex-1 truncate', isActive(ADMINS_SECTION.route) ? 'text-primary font-semibold' : 'font-medium']">{{ ADMINS_SECTION.title }}</span>
        </template>
        <template v-else>
          <span class="min-w-0 flex-1">
            <span class="block text-base font-semibold">{{ ADMINS_SECTION.title }}</span>
            <span class="text-muted-foreground block truncate text-sm">{{ ADMINS_SECTION.blurb }}</span>
          </span>
          <ChevronRight class="text-muted-foreground size-5 shrink-0" />
        </template>
      </RouterLink>
    </div>
  </nav>
</template>
