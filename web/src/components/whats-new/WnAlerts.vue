<script setup lang="ts">
import { Bell, Star } from '@lucide/vue'
import Avatar from '@/components/Avatar.vue'
import DateTile from '@/components/DateTile.vue'
import NotificationCard from '@/components/NotificationCard.vue'
import Switch from '@/components/ui/Switch.vue'
import WnShot from './WnShot.vue'
import { ALERT_KINDS } from '@/composables/useAlerts'

// Alerts: one arriving on a locked phone, the kinds you can choose, and the
// bell on a dancer and a competition.
defineProps<{ shot: number }>()

const day = new Date()
day.setDate(day.getDate() + 12)
</script>

<template>
  <WnShot :index="0" :shot="shot">
    <div class="relative flex w-[19rem] flex-col items-center gap-3 text-white">
      <span class="absolute top-36 left-1/2 size-64 -translate-1/2 animate-ping rounded-full border-2 border-white/40 [animation-duration:2.4s]" aria-hidden="true" />
      <p class="text-sm font-semibold opacity-85">Saturday 14 November</p>
      <p class="mb-2 text-[4.5rem] leading-[0.95] font-light tracking-[-0.03em] tabular-nums">10:41</p>
      <NotificationCard
        title="Isla placed 1st"
        body="Highland Fling · Cowal Highland Gathering"
        class="w-full -translate-y-16 scale-90 text-(--foreground) opacity-0 shadow-[0_0_2.5rem_rgb(140_200_255/0.6)] transition duration-700 ease-(--ease-elastic) group-data-on:translate-y-0 group-data-on:scale-100 group-data-on:opacity-100 group-data-on:delay-300"
      />
      <NotificationCard title="Isla dances today" body="Platform 2 at 10:40" when="7:02 am" class="w-full scale-95 text-(--foreground) opacity-80" />
    </div>
  </WnShot>

  <WnShot :index="1" :shot="shot">
    <div class="relative w-[18.5rem]">
      <div class="bg-card rounded-3xl py-2 shadow-2xl">
        <p class="text-muted-foreground px-4 pt-2 pb-1 text-xs font-bold tracking-wide">NOTIFICATIONS</p>
        <div v-for="k in ALERT_KINDS" :key="k.id" class="flex items-center gap-3 px-4 py-2.5 not-last:border-b">
          <span class="min-w-0 flex-1">
            <span class="block text-base font-semibold">{{ k.label }}</span>
            <span class="text-muted-foreground line-clamp-1 text-sm">{{ k.hint }}</span>
          </span>
          <Switch :model-value="true" :aria-label="k.label" tabindex="-1" />
        </div>
      </div>
      <span class="bg-primary-fill animate-float absolute -right-4 -bottom-8 flex size-[4.75rem] rotate-12 items-center justify-center rounded-[1.375rem] text-white shadow-xl" aria-hidden="true">
        <Bell class="size-9" stroke-width="2" />
        <span class="bg-live ring-primary-fill absolute top-3 right-3.5 size-3.5 rounded-full ring-[3px]" />
      </span>
    </div>
  </WnShot>

  <WnShot :index="2" :shot="shot">
    <div class="flex w-[18.75rem] flex-col gap-3.5">
      <div class="bg-card flex -rotate-2 items-center gap-3 rounded-3xl px-4 py-3.5 shadow-2xl">
        <Avatar name="Isla MacLeod" color="var(--dancer-1)" size="sm" />
        <span class="flex-1 text-lg font-bold">Isla</span>
        <span class="bg-secondary/12 text-secondary flex size-11 items-center justify-center rounded-full"><Star class="size-5 fill-current" /></span>
        <span class="bg-primary-fill flex size-11 items-center justify-center rounded-full text-white"><Bell class="size-5" /></span>
      </div>
      <div class="bg-card flex translate-x-2.5 rotate-[1.5deg] items-center gap-3 rounded-3xl px-4 py-3.5 shadow-2xl">
        <DateTile :date="day.getTime()" />
        <span class="min-w-0 flex-1 text-base leading-tight font-bold">Fraser Valley Indoor</span>
        <span class="bg-primary-fill flex h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-bold text-white"><Bell class="size-4" />Alerts on</span>
      </div>
    </div>
  </WnShot>
</template>
