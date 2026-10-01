<script setup lang="ts">
import { computed } from 'vue'
import { Eye, EyeOff } from '@lucide/vue'
import SectionNav from '@/components/admin/SectionNav.vue'
import SwitchField from '@/components/admin/SwitchField.vue'
import { useManagedCompetition } from '@/composables/admin/useManagedCompetition'
import { formatLongDate } from '@/lib/format'

const m = useManagedCompetition()
const c = computed(() => m.competition.value)

const visibility = computed(() => {
  if (c.value?.published) return { icon: Eye, text: 'Published: everyone can see everything.' }
  if (c.value?.listed) return { icon: Eye, text: 'Listed: basic details are public; dancers, schedule and results aren’t yet.' }
  return { icon: EyeOff, text: 'Private: only admins can see this competition.' }
})
</script>

<template>
  <div class="max-w-3xl space-y-8 p-4 pb-[calc(2rem+var(--safe-bottom))]">
    <header class="space-y-1">
      <p class="text-muted-foreground text-sm font-bold">{{ c?.date ? formatLongDate(c.date) : 'No date yet' }}</p>
      <h1 class="text-display">{{ c?.name || 'Untitled competition' }}</h1>
      <p class="text-muted-foreground flex items-center gap-1.5 text-base">
        <component :is="visibility.icon" class="size-4 shrink-0" /> {{ visibility.text }}
      </p>
    </header>

    <section class="bg-card space-y-1 rounded-2xl border px-4 py-2 shadow-sm">
      <SwitchField
        :model-value="!!c?.listed"
        label="Listed"
        description="Shows in the competitions list with its date, venue and judges."
        :save="(on) => m.writeInfo(on ? { listed: true } : { listed: false, published: false }, on ? 'Listed' : 'Unlisted')"
      />
      <div class="border-t" />
      <SwitchField
        :model-value="!!c?.published"
        label="Published"
        description="Also shows dancers, the schedule and results."
        :save="(on) => m.writeInfo(on ? { published: true, listed: true } : { published: false }, on ? 'Published' : 'Unpublished')"
      />
    </section>

    <section class="space-y-3">
      <h2 class="text-heading">Step by step</h2>
      <SectionNav />
    </section>
  </div>
</template>
