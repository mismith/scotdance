<script setup lang="ts">
import { computed } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { Check } from '@lucide/vue'
import CompetitionName from '@/components/CompetitionName.vue'
import DateTile from '@/components/DateTile.vue'
import Dialog from '@/components/Dialog.vue'
import { useCompetition } from '@/composables/useCompetition'
import { useFollowedCompetitions } from '@/composables/useFollowedCompetitions'
import { useLinkedSwitcher } from '@/composables/useLinkedSwitcher'
import { daysFromToday } from '@/lib/format'
import { memberNote } from '@/lib/linked'
import { useMeStore } from '@/stores/me'

// The linked competitions' switcher (ADR 0007 §6): a dropdown under the
// title on wide screens, a sheet on phones. Each row: its date tile and
// name, Today or Tomorrow when it is, your dancers when they're dancing in
// it, and its venue when it isn't this one's; a tick on this one.
const switcher = useLinkedSwitcher()!
const { competitionId, competition } = useCompetition()
const { byCompetition } = useFollowedCompetitions()
const me = useMeStore()
const wide = useMediaQuery('(min-width: 768px)')

const rows = computed(() =>
  switcher.members.value.map((c) => {
    const days = daysFromToday(c.date)
    const current = c.id === competitionId.value
    return {
      c,
      current,
      today: days === 0,
      note: memberNote(c, {
        days,
        venue: competition.value?.venue,
        dancers: (byCompetition.value[c.id] ?? []).map((d) => d.name),
        current,
      }),
    }
  }),
)
</script>

<template>
  <Dialog
    :open="switcher.morph.open"
    :morph="switcher.morph"
    :variant="wide ? 'dropdown' : 'sheet'"
    :closable="!wide"
    :aria-label="switcher.label.value ?? 'Competitions'"
    :class="wide && 'w-[26rem]'"
    @close="switcher.morph.hide()"
  >
    <template #header>
      <h2 class="text-title">{{ switcher.label.value }}</h2>
    </template>
    <div :class="wide ? 'space-y-1' : 'p-4 pb-[calc(1.5rem+var(--safe-bottom))]'">
      <p v-if="wide" class="text-muted-foreground px-3 pt-1 pb-1.5 text-sm font-semibold">{{ switcher.label.value }}</p>
      <ul
        role="radiogroup"
        :aria-label="switcher.label.value ?? undefined"
        :class="!wide && 'surface rows-inset overflow-hidden rounded-2xl [--inset:4.25rem]'"
      >
        <li v-for="r in rows" :key="r.c.id">
          <button
            type="button"
            role="radio"
            :aria-checked="r.current"
            :class="[
              'press-row focus-inset flex w-full items-center gap-3 text-left',
              wide ? 'min-h-15 rounded-xl px-3 py-1.5' : 'min-h-16 py-2 pr-3 pl-4',
              r.current && 'bg-blue-paper',
            ]"
            @click="switcher.go(r.c.id)"
          >
            <DateTile :date="r.c.date" :today="r.today" :managed="me.organises(r.c.id)" />
            <span class="min-w-0 flex-1">
              <span class="line-clamp-2 text-base leading-snug font-semibold">
                <CompetitionName :competition="r.c" />
              </span>
              <span
                v-if="r.note"
                :class="['block truncate text-sm font-medium', r.note.tone === 'live' ? 'text-live' : r.note.tone === 'venue' ? 'text-next-foreground' : 'text-muted-foreground']"
              >
                {{ r.note.text }}
              </span>
            </span>
            <Check v-if="r.current" class="text-primary size-5 shrink-0" stroke-width="2.6" aria-hidden="true" />
          </button>
        </li>
      </ul>
    </div>
  </Dialog>
</template>
