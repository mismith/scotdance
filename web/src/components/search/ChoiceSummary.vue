<script setup lang="ts">
import CompetitionName from '@/components/CompetitionName.vue'
import { computed } from 'vue'
import { Star } from '@lucide/vue'
import { useFollowing } from '@/composables/useFollowing'
import { useHiddenAs } from '@/composables/useHiddenAs'
import VisibilityChip from '@/components/VisibilityChip.vue'
import type { CompetitionChoice } from './choices'

// A competition's name and town, then your dancers as coloured dots (or a
// star for one you follow), and how it's hidden for its admins, as in the
// Competitions list. Today is the date tile's to say.
const props = defineProps<{ choice: CompetitionChoice }>()

const following = useFollowing()
const hiddenAs = useHiddenAs()
const hidden = computed(() => hiddenAs(props.choice.id, props.choice.competition))
</script>

<template>
  <span class="min-w-0 flex-1">
    <span class="line-clamp-2 text-base leading-snug font-semibold">
      <CompetitionName :competition="choice.competition" />
    </span>
    <span v-if="choice.competition.location" class="text-muted-foreground block truncate text-sm">
      {{ choice.competition.location }}
    </span>
    <span v-if="hidden || choice.followed || choice.dancers.length" class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
      <VisibilityChip :visibility="hidden" />
      <span v-if="choice.dancers.length" class="flex min-w-0 items-center gap-1.5 text-sm font-medium">
        <span class="flex shrink-0 gap-0.5" aria-hidden="true">
          <span
            v-for="x in choice.dancers.slice(0, 4)"
            :key="x.id"
            class="size-2.5 rounded-full"
            :style="{ background: following.colorFor(x.id) ?? 'var(--primary)' }"
          />
        </span>
        <span class="truncate">{{ choice.dancers.map((x) => x.name).join(', ') }}</span>
      </span>
      <span v-else-if="choice.followed" class="text-muted-foreground inline-flex items-center gap-1 text-sm">
        <Star class="text-secondary size-3.5 fill-current" aria-hidden="true" /> Following
      </span>
    </span>
  </span>
</template>
