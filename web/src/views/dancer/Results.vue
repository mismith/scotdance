<script setup lang="ts">
import { computed } from 'vue'
import { ChevronRight } from '@lucide/vue'
import { useDancerProfile } from '@/composables/useDancerProfile'
import { formatRelative } from '@/lib/format'

const profile = useDancerProfile()

const tiles = computed(() => [
  { k: '1st', v: '—', accent: 'text-secondary' },
  { k: 'Top 3', v: '—', accent: 'text-primary' },
  { k: 'Avg', v: '—', accent: 'text-foreground' },
])

const past = computed(() => profile.past.value)
</script>

<template>
  <article class="space-y-6">
    <section>
      <div class="grid grid-cols-3 gap-2">
        <div
          v-for="t in tiles"
          :key="t.k"
          class="bg-card rounded-2xl border px-3 py-3 text-center"
        >
          <div
            class="text-muted-foreground text-[10px] font-bold tracking-[0.14em] uppercase"
          >
            {{ t.k }}
          </div>
          <div
            :class="[
              'font-serif mt-1 text-2xl font-medium tabular-nums tracking-tight',
              t.accent,
            ]"
          >
            {{ t.v }}
          </div>
        </div>
      </div>
      <p class="text-muted-foreground mt-2 px-1 text-[11px]">
        Aggregated stats across comps need per-comp results loaded — coming soon.
      </p>
    </section>

    <section v-if="past.length" class="space-y-2">
      <h2
        class="text-muted-foreground px-1 text-[11px] font-bold tracking-[0.14em] uppercase"
      >
        Past comps · {{ past.length }}
      </h2>
      <ul class="divide-y border-y">
        <li v-for="a in past" :key="a.hit.id" class="flex items-center">
          <RouterLink
            :to="{
              name: 'competition.dancer',
              params: {
                competitionId: a.hit.competitionId,
                dancerId: a.hit.id,
              },
            }"
            class="hover:bg-accent flex flex-1 items-center gap-3 px-2 py-3"
          >
            <div class="min-w-0 flex-1">
              <div
                class="font-serif truncate text-[15px] font-medium tracking-tight"
              >
                {{ a.competition?.name ?? 'Loading…' }}
              </div>
              <div class="text-muted-foreground text-[11.5px]">
                <span v-if="a.competition?.date">{{
                  formatRelative(a.competition.date)
                }}</span>
                <span v-if="a.hit.number != null" class="ml-2 tabular-nums"
                  >#{{ a.hit.number }}</span
                >
              </div>
            </div>
            <ChevronRight class="text-muted-foreground size-4 shrink-0" />
          </RouterLink>
        </li>
      </ul>
    </section>

    <div
      v-else
      class="text-muted-foreground font-serif text-sm italic"
    >
      No past appearances on record.
    </div>
  </article>
</template>
