<script setup lang="ts">
import { computed, useId } from 'vue'
import { useRoute } from 'vue-router'
import { ChartLine } from '@lucide/vue'
import { useDancerProfile } from '@/composables/useDancerProfile'
import { useDancerRecord } from '@/composables/useDancerRecord'
import BetaBadge from '@/components/BetaBadge.vue'
import EmptyState from '@/components/EmptyState.vue'
import Skeleton from '@/components/Skeleton.vue'
import DanceWheel from '@/components/dancer/DanceWheel.vue'
import HelpTip from '@/components/admin/HelpTip.vue'
import JourneyPath from '@/components/dancer/JourneyPath.vue'
import { injectInfoHeaderSetter } from '@/composables/useScrolledPast'
import { danceWheel } from '@/lib/danceWheel'
import { moments } from '@/lib/dancerProgress'

// How a dancer has gone, in their own right and never against anyone else:
// the saltire (what they dance, and how each goes against their own best),
// then their journey on ScotDance.app with the moments worth
// marking. Many dancers started before ScotDance.app, so everything says
// what it's counted from.
const route = useRoute()
// The bar frosts once this page's first heading scrolls under it, not before.
const setHeader = injectInfoHeaderSetter()
const profile = useDancerProfile()
const record = useDancerRecord()
const firstName = computed(() => profile.displayName.value.split(' ')[0])

const points = record.points
const tipId = useId()
const wheel = computed(() => danceWheel(points.value))
const path = computed(() => moments(points.value))
const level = computed(() => record.facts.value.level?.level ?? null)
const window = computed(() => {
  const s = wheel.value.since
  return s ? `Since moving up to ${s.level} in ${new Date(s.date).getFullYear()}` : 'Every competition on ScotDance.app'
})
const heading = 'text-section'
</script>

<template>
  <div v-if="record.rich.value" class="space-y-10">
    <div v-if="!record.ready.value" class="space-y-3" aria-busy="true">
      <span class="sr-only">Loading progress…</span>
      <Skeleton class="h-6 w-1/4" />
      <Skeleton class="mx-auto size-64 rounded-full!" />
      <Skeleton class="h-6 w-1/3" />
      <Skeleton class="h-48 w-full rounded-2xl!" />
    </div>

    <EmptyState
      v-else-if="!points.length"
      :icon="ChartLine"
      size="inline"
      title="Nothing to show yet"
      :description="`Progress builds as ${firstName}’s competitions are held on ScotDance.app.`"
    />

    <template v-else>
      <section v-if="wheel.kinds.length" class="space-y-3">
        <div :ref="setHeader">
          <div class="flex items-center gap-1.5">
            <h2 :class="heading">Dancer saltire</h2>
            <HelpTip label="About the dancer saltire" wide>
              <p class="font-semibold">All of a dancer’s dancing, in one picture.</p>
              <p class="mt-1">
                Highland, National, Character and Choreography each get a quarter of the
                <a href="https://en.wikipedia.org/wiki/Saltire" target="_blank" rel="noopener" class="text-primary underline">saltire</a>.
                The wider a slice, the more that dance is danced. The further it reaches, the higher it places. Every dancer’s ends up a
                different shape.
              </p>
              <!-- How to read a slice, drawn: across is how often, out is how high. -->
              <svg viewBox="0 0 240 118" class="my-2 block w-full max-w-60" aria-hidden="true">
                <defs>
                  <marker :id="`${tipId}-a`" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M0 0 L8 4 L0 8 Z" class="fill-foreground" />
                  </marker>
                </defs>
                <path d="M54 104 L33.3 47.1 A60 60 0 0 1 74.7 47.1 Z" fill="var(--dancer-5)" />
                <path d="M33.3 47.1 L23 18.8 A90 90 0 0 1 85 18.8 L74.7 47.1 A60 60 0 0 0 33.3 47.1 Z" fill="var(--dancer-5)" opacity="0.2" />
                <path d="M28.4 33.5 A75 75 0 0 1 79.6 33.5" class="stroke-foreground" fill="none" stroke-width="1.6" :marker-start="`url(#${tipId}-a)`" :marker-end="`url(#${tipId}-a)`" />
                <path d="M68.7 98.7 L86 51.2" class="stroke-foreground" fill="none" stroke-width="1.6" :marker-end="`url(#${tipId}-a)`" />
                <text x="112" y="34" class="fill-foreground text-[12px] font-bold">Wider</text>
                <text x="112" y="49" class="fill-muted-foreground text-[11px]">danced more</text>
                <text x="112" y="78" class="fill-foreground text-[12px] font-bold">Longer</text>
                <text x="112" y="93" class="fill-muted-foreground text-[11px]">placed higher</text>
              </svg>
              <p class="text-muted-foreground">Measured against the dancer’s own best.</p>
            </HelpTip>
            <BetaBadge class="ml-auto" />
          </div>
          <p class="text-muted-foreground text-callout">{{ window }}</p>
        </div>
        <DanceWheel :wheel="wheel" />
      </section>

      <section class="space-y-4">
        <div class="flex items-center gap-1.5">
          <h2 :class="heading">Journey</h2>
          <BetaBadge v-if="!wheel.kinds.length" class="ml-auto" />
        </div>
        <JourneyPath :points="points" :moments="path" :level="level" :seed="String(route.params.dancerId ?? firstName)" />
      </section>

      <p class="text-muted-foreground text-footnote">
        Counted from competitions on ScotDance.app. Levels come from the age groups organisers entered.
      </p>
    </template>
  </div>
</template>
