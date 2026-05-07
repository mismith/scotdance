<script setup lang="ts">
import { computed } from 'vue'
import { ChevronRight } from '@lucide/vue'
import { useDancerProfile, type DancerAppearance } from '@/composables/useDancerProfile'
import { isSameDay } from '@/lib/format'

const profile = useDancerProfile()

interface DatedAppearance extends DancerAppearance {
  day: string
  month: string
  isLive: boolean
}

function dated(list: DancerAppearance[]): DatedAppearance[] {
  return list
    .filter((a) => a.competition?.date)
    .map<DatedAppearance>((a) => {
      const d = new Date(a.competition!.date!)
      return {
        ...a,
        day: String(d.getDate()),
        month: d.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
        isLive: isSameDay(a.competition!.date!),
      }
    })
}

const upcoming = computed(() => dated(profile.upcoming.value))
const past = computed(() => dated(profile.past.value))
</script>

<template>
  <article class="space-y-6">
    <section v-if="upcoming.length" class="space-y-2">
      <div
        class="text-muted-foreground flex items-baseline justify-between px-1 text-[11px] font-bold tracking-[0.14em] uppercase"
      >
        <span>Upcoming · {{ upcoming.length }}</span>
        <span class="text-secondary">Across every comp</span>
      </div>
      <ul class="divide-y border-y">
        <li
          v-for="a in upcoming"
          :key="a.hit.id"
          :class="['flex items-center', a.isLive && 'bg-secondary/10']"
        >
          <RouterLink
            :to="{
              name: 'competition.dancer',
              params: {
                competitionId: a.hit.competitionId,
                dancerId: a.hit.id,
              },
            }"
            class="hover:bg-accent flex flex-1 items-center gap-4 px-2 py-3"
          >
            <div class="w-10 shrink-0 text-center">
              <div
                :class="[
                  'font-serif text-2xl font-medium leading-none tabular-nums',
                  a.isLive ? 'text-secondary' : '',
                ]"
              >
                {{ a.day }}
              </div>
              <div
                class="text-muted-foreground mt-1 text-[10px] font-bold tracking-[0.12em] uppercase"
              >
                {{ a.month }}
              </div>
            </div>
            <div class="min-w-0 flex-1">
              <div
                class="font-serif truncate text-[15px] font-medium tracking-tight leading-tight"
              >
                {{ a.competition?.name ?? 'Loading…' }}
              </div>
              <div
                class="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 text-[11.5px]"
              >
                <span v-if="a.hit.number != null" class="tabular-nums"
                  >#{{ a.hit.number }}</span
                >
                <span v-if="a.competition?.location">{{
                  a.competition.location
                }}</span>
                <span
                  v-if="a.isLive"
                  class="text-secondary text-[11px] font-bold tracking-[0.12em] uppercase"
                  >Dancing now</span
                >
              </div>
            </div>
            <ChevronRight class="text-muted-foreground size-4 shrink-0" />
          </RouterLink>
        </li>
      </ul>
    </section>

    <section v-if="past.length" class="space-y-2">
      <div
        class="text-muted-foreground px-1 text-[11px] font-bold tracking-[0.14em] uppercase"
      >
        Past · {{ past.length }}
      </div>
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
            class="hover:bg-accent flex flex-1 items-center gap-4 px-2 py-3"
          >
            <div class="w-10 shrink-0 text-center opacity-60">
              <div
                class="font-serif text-2xl font-medium leading-none tabular-nums"
              >
                {{ a.day }}
              </div>
              <div
                class="text-muted-foreground mt-1 text-[10px] font-bold tracking-[0.12em] uppercase"
              >
                {{ a.month }}
              </div>
            </div>
            <div class="min-w-0 flex-1 opacity-80">
              <div
                class="font-serif truncate text-[15px] font-medium tracking-tight leading-tight"
              >
                {{ a.competition?.name ?? 'Loading…' }}
              </div>
              <div
                class="text-muted-foreground mt-1 text-[11.5px] tabular-nums"
                v-if="a.hit.number != null"
              >
                #{{ a.hit.number }}
              </div>
            </div>
            <ChevronRight class="text-muted-foreground size-4 shrink-0" />
          </RouterLink>
        </li>
      </ul>
    </section>

    <div
      v-if="!upcoming.length && !past.length"
      class="text-muted-foreground font-serif text-sm italic"
    >
      No appearances on record.
    </div>
  </article>
</template>
