<script setup lang="ts">
import { computed } from 'vue'
import { Hourglass, Play } from '@lucide/vue'
import Medal from '@/components/Medal.vue'
import type { DanceStatus } from '@/lib/dancerDay'
import { platformLabel } from '@/lib/schedule'

// A dance's state in words. Never colour alone: every chip has a word.
const props = defineProps<{ status: DanceStatus; fresh?: boolean }>()

const platform = computed(() => platformLabel(props.status.slot?.platformName) || null)
</script>

<template>
  <Medal
    v-if="status.state === 'placed'"
    :place="status.place"
    :tied="status.tied"
    :fresh="fresh"
  />
  <span
    v-else-if="status.state === 'unplaced'"
    class="text-muted-foreground inline-flex items-center gap-1 text-sm font-medium"
  >
    <template v-if="status.pointed">Championship point</template>
    <template v-else>Not placed</template>
  </span>
  <span
    v-else-if="status.state === 'no-placings'"
    class="text-muted-foreground text-sm font-medium"
  >
    No placings
  </span>
  <span
    v-else-if="status.state === 'waiting'"
    class="bg-muted text-muted-foreground border-strong inline-flex h-7 items-center gap-1 rounded-full border border-dashed px-2.5 text-footnote font-semibold whitespace-nowrap"
  >
    <Hourglass class="size-3.5" stroke-width="2.4" />
    Waiting for results
  </span>
  <span
    v-else-if="status.state === 'next'"
    class="bg-next text-next-foreground inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-footnote font-semibold whitespace-nowrap"
  >
    <Play class="size-3.5 fill-current" stroke-width="2.4" />
    Next{{ platform ? ` · ${platform}` : '' }}
  </span>
  <span
    v-else-if="status.state === 'upcoming'"
    class="text-muted-foreground text-sm font-medium whitespace-nowrap"
  >
    {{ platform ?? status.slot?.blockTime ?? 'Scheduled' }}
  </span>
  <span
    v-else-if="status.state === 'not-posted'"
    class="text-muted-foreground text-sm font-medium"
  >
    No result posted
  </span>
  <span v-else class="text-muted-foreground text-sm font-medium">Later</span>
</template>
