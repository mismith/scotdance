<script setup lang="ts">
import { computed, ref, watch, type Component } from 'vue'
import CompetitionRow from '@/components/CompetitionRow.vue'
import Dialog from '@/components/Dialog.vue'
import Skeleton from '@/components/Skeleton.vue'
import { fetchCompetitionMeta } from '@/lib/competitionMeta'
import { parseDate } from '@/lib/format'
import type { CompetitionListItem } from '@/composables/useCompetitions'

const props = defineProps<{
  open: boolean
  title: string
  subtitle?: string
  icon?: Component
  // Pass `competitions` when the caller already has the data loaded;
  // otherwise pass `competitionIds` and the sheet will fetch metadata.
  competitions?: CompetitionListItem[]
  competitionIds?: string[]
}>()

const emit = defineEmits<{ close: [] }>()

const ids = computed<string[]>(() => {
  if (props.competitions) return props.competitions.map((c) => c.id)
  return props.competitionIds ?? []
})

const metaById = ref<Record<string, CompetitionListItem | null>>({})
const loading = ref(false)

watch(
  () => (props.open && !props.competitions ? ids.value : []),
  async (toFetch) => {
    if (!toFetch.length) return
    const missing = toFetch.filter((id) => !(id in metaById.value))
    if (!missing.length) return
    loading.value = true
    try {
      const fetched = await Promise.all(missing.map((id) => fetchCompetitionMeta(id)))
      const next = { ...metaById.value }
      missing.forEach((id, i) => {
        const c = fetched[i]
        next[id] = c ? { id, ...c } : null
      })
      metaById.value = next
    } finally {
      loading.value = false
    }
  },
  { immediate: true },
)

const competitions = computed<CompetitionListItem[]>(() => {
  const list = props.competitions
    ? props.competitions
    : ids.value
        .map((id) => metaById.value[id])
        .filter((c): c is CompetitionListItem => !!c)
  return [...list].sort((a, b) => {
    const da = a.date ? parseDate(a.date).getTime() : 0
    const db = b.date ? parseDate(b.date).getTime() : 0
    return db - da
  })
})

const showSkeleton = computed(
  () => loading.value && competitions.value.length === 0,
)
</script>

<template>
  <Dialog :open="open" variant="sheet" size="md" @close="emit('close')">
    <template #header>
      <div class="flex items-center gap-2">
        <component
          :is="icon"
          v-if="icon"
          class="text-muted-foreground size-5 shrink-0"
        />
        <h2 class="truncate text-xl font-medium tracking-tight">{{ title }}</h2>
      </div>
      <div v-if="subtitle" class="text-muted-foreground pl-7 text-sm">
        {{ subtitle }}
      </div>
    </template>

    <ul v-if="showSkeleton" class="divide-y px-2" aria-busy="true">
      <li
        v-for="i in Math.min(ids.length || 3, 4)"
        :key="i"
        class="flex items-center gap-3 py-3 pr-3 pl-1"
      >
        <Skeleton class="size-12 shrink-0 rounded-xl!" />
        <div class="flex-1 space-y-2">
          <Skeleton class="h-5 w-2/3" />
          <Skeleton class="h-4 w-1/3" />
        </div>
      </li>
    </ul>
    <ul v-else class="divide-y px-2">
      <CompetitionRow
        v-for="c in competitions"
        :key="c.id"
        :competition="c"
        :to="{ name: 'competition.info', params: { competitionId: c.id } }"
        @click="emit('close')"
      />
    </ul>
  </Dialog>
</template>
