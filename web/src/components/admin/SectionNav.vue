<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { ChevronRight } from '@lucide/vue'
import { MANAGE_SECTIONS } from '@/lib/admin/sections'
import { useManagedCompetition } from '@/composables/admin/useManagedCompetition'

// The Manage sections. `compact` is the sidebar; otherwise the big
// grouped list on the phone's Manage home.
const props = defineProps<{ compact?: boolean }>()

const route = useRoute()
const m = useManagedCompetition()

const counts = computed<Record<string, number | undefined>>(() => ({
  dancers: m.dancers.value.length,
  groups: m.groups.value.length,
  categories: m.categories.value.length,
  dances: m.dances.value.length,
  platforms: m.platforms.value.length,
  staff: m.staff.value.length,
}))

const isActive = (routeName: string) => route.matched.some((r) => r.name === routeName) || String(route.name ?? '').startsWith(`${routeName}.`)
</script>

<template>
  <nav :aria-label="'Manage sections'" :class="props.compact ? 'space-y-5' : 'space-y-6'">
    <section v-for="group in MANAGE_SECTIONS" :key="group.title" class="space-y-2">
      <h2 :class="props.compact ? 'text-muted-foreground px-3 text-sm font-bold' : 'text-heading px-1'">{{ group.title }}</h2>
      <ul v-if="props.compact" class="space-y-0.5">
        <li v-for="s in group.sections" :key="s.id">
          <RouterLink
            :to="{ name: s.route, params: { competitionId: m.competitionId.value } }"
            :aria-current="isActive(s.route) ? 'page' : undefined"
            :class="[
              'flex min-h-11 items-center gap-3 rounded-xl px-3 text-[0.9375rem] font-semibold',
              isActive(s.route) ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
            ]"
          >
            <component :is="s.icon" class="size-5 shrink-0" />
            <span class="min-w-0 flex-1 truncate">{{ s.title }}</span>
            <span v-if="counts[s.id] != null" class="text-sm tabular-nums opacity-70">{{ counts[s.id] }}</span>
          </RouterLink>
        </li>
      </ul>
      <ul v-else class="bg-card divide-y overflow-hidden rounded-2xl border shadow-sm">
        <li v-for="s in group.sections" :key="s.id">
          <RouterLink
            :to="{ name: s.route, params: { competitionId: m.competitionId.value } }"
            class="hover:bg-accent flex min-h-16 items-center gap-3 px-4 py-2.5"
          >
            <span class="bg-blue-paper text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
              <component :is="s.icon" class="size-5" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-base font-bold">{{ s.title }}</span>
              <span class="text-muted-foreground block truncate text-sm">{{ s.blurb }}</span>
            </span>
            <span v-if="counts[s.id] != null" class="text-muted-foreground text-sm font-semibold tabular-nums">{{ counts[s.id] }}</span>
            <ChevronRight class="text-muted-foreground size-5 shrink-0" />
          </RouterLink>
        </li>
      </ul>
    </section>
  </nav>
</template>
