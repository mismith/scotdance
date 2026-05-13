<script setup lang="ts">
import { computed } from 'vue'
import { MapPin } from '@lucide/vue'
import CompetitionRow from '@/components/CompetitionRow.vue'
import Dialog from '@/components/Dialog.vue'
import type { VenueGroup } from '@/lib/venues'

const props = defineProps<{ venue: VenueGroup | null }>()
const emit = defineEmits<{ close: [] }>()

const open = computed(() => props.venue !== null)
</script>

<template>
  <Dialog :open="open" variant="sheet" size="md" @close="emit('close')">
    <template v-if="venue" #header>
      <div class="flex items-center gap-2">
        <MapPin class="text-muted-foreground size-5 shrink-0" />
        <h2 class="truncate text-xl font-medium tracking-tight">
          {{ venue.venue || 'Venue' }}
        </h2>
      </div>
      <div v-if="venue.location" class="text-muted-foreground pl-7 text-sm">
        {{ venue.location }}
      </div>
    </template>

    <ul v-if="venue" class="divide-y px-2">
      <CompetitionRow
        v-for="c in venue.competitions"
        :key="c.id"
        :competition="c"
        :to="{ name: 'competition.info', params: { competitionId: c.id } }"
        @click="emit('close')"
      />
    </ul>
  </Dialog>
</template>
