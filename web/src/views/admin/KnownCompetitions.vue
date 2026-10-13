<script setup lang="ts">
import { computed, onScopeDispose, ref } from 'vue'
import { onValue } from 'firebase/database'
import { httpsCallable } from 'firebase/functions'
import { RefreshCw } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import SectionHeader from '@/components/admin/SectionHeader.vue'
import { dataRef, functions } from '@/firebase'
import { formatDateTime, formatShortDate } from '@/lib/format'
import { KNOWN_SOURCES, type KnownSource } from '@/lib/knownCompetitions'

// Known competitions (ADR 0009): the governing bodies' own lists, offered
// on Add a competition as "Is it one of these?". They're read on the 1st of
// each month; Refresh reads them now, for when a body posts an update. Each
// source says how its last read went: how many it found, or what went wrong
// (its last good list stays in use until the next read works).

interface Run {
  at?: string
  ok?: string
  count?: number
  from?: string[]
  error?: string
}
const runs = ref<Partial<Record<KnownSource, Run>> | null>(null)
const off = onValue(dataRef('knownCompetitions:runs'), (snap) => (runs.value = (snap.val() ?? {}) as Partial<Record<KnownSource, Run>>), () => (runs.value = {}))
onScopeDispose(off)

const rows = computed(() =>
  KNOWN_SOURCES.map((s) => {
    const run = runs.value?.[s.key] ?? {}
    const failed = !!run.error && run.at !== run.ok
    return { ...s, run, failed }
  }),
)

const refreshing = ref(false)
const error = ref<string | null>(null)
async function refresh() {
  refreshing.value = true
  error.value = null
  try {
    // (The run itself lands in knownCompetitions:runs, shown above as it does.)
    await httpsCallable(functions, 'refreshKnownCompetitions', { timeout: 300_000 })({})
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    refreshing.value = false
  }
}
const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
</script>

<template>
  <div class="max-w-3xl space-y-6 p-4 pb-[calc(3rem+var(--safe-bottom))]">
    <SectionHeader
      title="Known competitions"
      description="The governing bodies’ own lists, offered when someone adds a competition. They’re read on the 1st of each month."
    >
      <template #actions>
        <Button :busy="refreshing" @click="refresh"><RefreshCw v-if="!refreshing" /> Refresh</Button>
      </template>
    </SectionHeader>

    <p v-if="error" class="text-destructive text-sm font-medium" role="alert">{{ error }}</p>

    <ul class="surface divide-y rounded-2xl" :aria-busy="runs === null">
      <li v-for="s in rows" :key="s.key" class="space-y-0.5 px-4 py-3">
        <span class="block text-base font-medium">{{ s.name }}</span>
        <template v-if="runs === null"><span class="text-muted-foreground block text-sm">…</span></template>
        <template v-else-if="!s.run.at"><span class="text-muted-foreground block text-sm">Not read yet</span></template>
        <template v-else>
          <span v-if="s.failed" class="text-destructive block text-sm font-medium">Didn’t work on {{ formatDateTime(s.run.at) }}: {{ s.run.error }}</span>
          <span v-if="s.run.ok" :class="['block text-sm', s.failed ? 'text-muted-foreground' : 'text-done-foreground']">
            {{ s.failed ? 'Still offering' : 'Found' }} {{ s.run.count === 1 ? '1 competition' : `${s.run.count ?? 0} competitions` }}, read {{ s.failed ? formatShortDate(s.run.ok) : formatDateTime(s.run.ok) }}
          </span>
          <span v-if="s.run.from?.length" class="text-muted-foreground block truncate text-sm">
            From
            <template v-for="(url, i) in s.run.from" :key="url"
              >{{ i ? ', ' : '' }}<a :href="url" target="_blank" rel="noopener" class="text-primary">{{ host(url) }}</a></template
            >
          </span>
        </template>
      </li>
    </ul>
  </div>
</template>
