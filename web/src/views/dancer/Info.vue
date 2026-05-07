<script setup lang="ts">
import { computed } from 'vue'
import { ChevronRight } from '@lucide/vue'
import { useDancerProfile } from '@/composables/useDancerProfile'
import CompChip from '@/components/CompChip.vue'
import SectionHeader from '@/components/SectionHeader.vue'

const profile = useDancerProfile()

const tiles = computed(() => [
  {
    k: 'Total comps',
    v: profile.totalComps.value > 0 ? String(profile.totalComps.value) : '—',
  },
  {
    k: 'This year',
    v: profile.compsThisYear.value > 0 ? String(profile.compsThisYear.value) : '—',
  },
  {
    k: 'Upcoming',
    v: profile.upcoming.value.length > 0 ? String(profile.upcoming.value.length) : '—',
  },
  {
    k: 'Past',
    v: profile.past.value.length > 0 ? String(profile.past.value.length) : '—',
  },
])

const recentComp = computed(() => profile.appearances.value[0] ?? null)
</script>

<template>
  <article class="space-y-6">
    <section>
      <div class="grid grid-cols-2 gap-2">
        <div
          v-for="t in tiles"
          :key="t.k"
          class="bg-card rounded-2xl border px-4 py-3"
        >
          <div
            class="text-muted-foreground text-[10px] font-bold tracking-[0.14em] uppercase"
          >
            {{ t.k }}
          </div>
          <div
            class="font-serif mt-1 text-2xl font-medium tabular-nums tracking-tight"
          >
            {{ t.v }}
          </div>
        </div>
      </div>
    </section>

    <section v-if="recentComp" class="space-y-2">
      <SectionHeader label="Last seen at" />
      <RouterLink
        :to="{
          name: 'competition.dancer',
          params: {
            competitionId: recentComp.hit.competitionId,
            dancerId: recentComp.hit.id,
          },
        }"
        class="flex items-center gap-3 px-2 py-3"
      >
        <CompChip
          :name="recentComp.competition?.name"
          :image="recentComp.competition?.image"
          :size="40"
        />
        <div class="min-w-0 flex-1">
          <div
            class="font-serif truncate text-[15px] leading-tight font-medium tracking-tight"
          >
            {{ recentComp.competition?.name ?? 'Loading…' }}
          </div>
          <div
            v-if="recentComp.hit.number != null"
            class="text-muted-foreground mt-1 text-[11.5px] tabular-nums"
          >
            #{{ recentComp.hit.number }}
          </div>
        </div>
        <ChevronRight class="text-muted-foreground size-4 shrink-0" />
      </RouterLink>
    </section>

    <p class="text-muted-foreground text-[11px]">
      Cross-comp profile is matched by name. Identity may be approximate when names
      are shared.
    </p>
  </article>
</template>
