<script setup lang="ts">
import { onScopeDispose, reactive, ref } from 'vue'
import { onValue } from 'firebase/database'
import { httpsCallable } from 'firebase/functions'
import { Play } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import SectionHeader from '@/components/admin/SectionHeader.vue'
import TextField from '@/components/admin/TextField.vue'
import { dataRef, functions } from '@/firebase'
import { confirm } from '@/lib/admin/feedback'
import { write } from '@/lib/admin/write'

// Maintenance for whoever runs ScotDance: the app versions people are
// told to update to, and rebuilding search and profile data. Search and
// profiles keep themselves up to date as competitions change: rebuilding is
// for the first build, or to repair them.

const versions = ref<Record<string, string>>({})
const off = onValue(dataRef('versions'), (snap) => (versions.value = (snap.val() ?? {}) as Record<string, string>))
onScopeDispose(off)
const saveVersion = (key: string) => (v: string | null) => write({ [`versions/${key}`]: v })
const versionPattern = (v: string) => (/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(v) ? null : 'Use a version like 4.0.1.')

interface Job {
  running: boolean
  result: string | null
  error: string | null
  /** The competitions a map position was found for (or would be, on a dry run). */
  samples?: string[]
}
const jobs = reactive<Record<string, Job>>({})
const job = (key: string): Job => jobs[key] ?? { running: false, result: null, error: null }

const WORDS: Record<string, string> = {
  linked: 'linked',
  skipped: 'skipped',
  pruned: 'removed',
  competitions: 'competitions read',
  written: 'written',
  alreadySet: 'already set',
  unmatched: 'not matched',
  batches: 'batches',
  updated: 'updated',
  total: 'total',
  missing: 'missing',
  scanned: 'checked',
  noQuery: 'with no address',
  failed: 'not found',
}
function describe(data: unknown): string {
  if (data == null) return 'Done.'
  if (Array.isArray(data)) return `Done: ${data.length} indexed.`
  if (typeof data !== 'object') return `Done: ${String(data)}`
  const entries = Object.entries(data as Record<string, unknown>)
  // (Older builds returned the published ids themselves.)
  if (entries.every(([, v]) => v === true)) return `Done: ${entries.length} published.`
  const dryRun = (data as { dryRun?: unknown }).dryRun === true
  const parts = entries
    .filter(([k, v]) => k !== 'dryRun' && (typeof v === 'number' || typeof v === 'string'))
    .map(([k, v]) => `${v} ${dryRun && k === 'updated' ? 'to update' : (WORDS[k] ?? k.replace(/([A-Z])/g, ' $1').toLowerCase())}`)
  if (!parts.length) return `Done: ${entries.length} indexed.`
  return `${dryRun ? 'Dry run, nothing changed' : 'Done'}: ${parts.join(', ')}.`
}

interface CoordsSample {
  id: string
  name?: string
  country?: string | null
  region?: string | null
  locality?: string | null
}
const sampleLines = (data: unknown) =>
  ((data as { samples?: CoordsSample[] } | null)?.samples ?? []).map(
    (x) => `${x.name || x.id}: ${[x.locality, x.region, x.country].filter(Boolean).join(', ') || 'found'}`,
  )

// A profile rebuild is two steps, one after the other: build the profiles,
// then link the entries to them.
async function rebuildProfiles(key: string) {
  await run(`agg${key}`, `backfill${key}Aggregates`)
  if (!jobs[`agg${key}`].error) await run(`bp${key}`, `backfill${key}BackPointers`)
}
const profileBusy = (key: string) => job(`agg${key}`).running || job(`bp${key}`).running

async function run(key: string, fn: string, payload?: unknown) {
  const j = jobs[key]
  j.running = true
  j.error = null
  j.result = null
  j.samples = []
  try {
    const res = await httpsCallable(functions, fn, { timeout: 540_000 })(payload)
    j.result = describe(res.data)
    j.samples = sampleLines(res.data)
  } catch (e) {
    j.error = e instanceof Error ? e.message : String(e)
  } finally {
    j.running = false
  }
}

const REINDEX = [
  { key: 'competitionsPublished', fn: 'reindexCompetitionsPublished', label: 'Published and listed competitions lists' },
  { key: 'competitions', fn: 'reindexCompetitions', label: 'Competitions search' },
  {
    key: 'dancers',
    fn: 'reindexDancers',
    label: 'Dancers search',
    // It starts from empty, and the old apps search the same list.
    warn: {
      title: 'Rebuild dancer search?',
      message:
        'Dancer search is empty here and in the old apps until it finishes, which can take several minutes. It keeps itself up to date, so only rebuild it if dancers are missing from search.',
    },
  },
  { key: 'judges', fn: 'reindexJudges', label: 'Judges search' },
  { key: 'pipers', fn: 'reindexPipers', label: 'Pipers search' },
]
async function rebuildSearch(r: (typeof REINDEX)[number]) {
  if (r.warn && !(await confirm({ ...r.warn, confirmLabel: 'Rebuild', destructive: true }))) return
  await run(r.key, r.fn)
}
const PROFILES = [
  { key: 'Judge', label: 'Judges' },
  { key: 'Piper', label: 'Pipers' },
  { key: 'Venue', label: 'Venues' },
  { key: 'Dancer', label: 'Dancers' },
]
for (const key of [...REINDEX.map((r) => r.key), ...PROFILES.flatMap((p) => [`agg${p.key}`, `bp${p.key}`]), 'coords'])
  jobs[key] = { running: false, result: null, error: null }
</script>

<template>
  <div class="max-w-3xl space-y-10 p-4 pb-[calc(3rem+var(--safe-bottom))]">
    <SectionHeader title="Tools" />

    <section class="space-y-4">
      <div>
        <h2 class="text-heading">App versions</h2>
        <p class="text-muted-foreground text-sm">People on an older version are asked to update. Set these after a release is live in each store.</p>
      </div>
      <div class="grid gap-4 sm:grid-cols-3">
        <TextField :model-value="versions.web" label="Web" placeholder="4.0.0" :validate="versionPattern" :save="saveVersion('web')" />
        <TextField :model-value="versions.ios" label="iPhone and iPad" placeholder="4.0.0" :validate="versionPattern" :save="saveVersion('ios')" />
        <TextField :model-value="versions.android" label="Android" placeholder="4.0.0" :validate="versionPattern" :save="saveVersion('android')" />
      </div>
    </section>

    <section class="space-y-3">
      <div>
        <h2 class="text-heading">Search</h2>
        <p class="text-muted-foreground text-sm">Rebuild a search index if results look out of date.</p>
      </div>
      <ul class="surface divide-y rounded-2xl">
        <li v-for="r in REINDEX" :key="r.key" class="flex flex-wrap items-center gap-3 py-2 pr-2 pl-4">
          <span class="min-w-0 flex-1">
            <span class="block text-base font-medium">{{ r.label }}</span>
            <span v-if="job(r.key).result" class="text-done-foreground block text-sm">{{ job(r.key).result }}</span>
            <span v-if="job(r.key).error" class="text-destructive block text-sm font-medium">{{ job(r.key).error }}</span>
          </span>
          <Button :busy="job(r.key).running" @click="rebuildSearch(r)">
            <Play v-if="!job(r.key).running" /> Rebuild
          </Button>
        </li>
      </ul>
    </section>

    <section class="space-y-3">
      <div>
        <h2 class="text-heading">Profiles</h2>
        <p class="text-muted-foreground text-sm">Rebuild the profiles that link people and venues across competitions, and link their entries to them.</p>
      </div>
      <ul class="surface divide-y rounded-2xl">
        <li v-for="p in PROFILES" :key="p.key" class="flex flex-wrap items-center gap-3 py-2 pr-2 pl-4">
          <span class="min-w-0 flex-1">
            <span class="block text-base font-medium">{{ p.label }}</span>
            <span
              v-for="k in [`agg${p.key}`, `bp${p.key}`]"
              :key="k"
              :class="['block text-sm', jobs[k]?.error ? 'text-destructive font-medium' : 'text-done-foreground']"
              >{{ jobs[k]?.error ?? jobs[k]?.result ?? '' }}</span
            >
          </span>
          <Button :busy="profileBusy(p.key)" @click="rebuildProfiles(p.key)">
            <Play v-if="!profileBusy(p.key)" /> Rebuild
          </Button>
        </li>
      </ul>
    </section>

    <section class="space-y-3">
      <div>
        <h2 class="text-heading">Map positions</h2>
        <p class="text-muted-foreground text-sm">Looks up the map position of competitions that don’t have one yet. Try a dry run first to see what it would change.</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button :disabled="job('coords').running" @click="run('coords', 'backfillCoords', { dryRun: true })">Dry run</Button>
        <Button variant="primary" :busy="job('coords').running" @click="run('coords', 'backfillCoords', { dryRun: false })">Update positions</Button>
      </div>
      <p v-if="job('coords').result" class="text-done-foreground text-sm">{{ job('coords').result }}</p>
      <ul v-if="job('coords').samples?.length" class="text-muted-foreground list-disc space-y-0.5 pl-5 text-sm">
        <li v-for="(line, i) in job('coords').samples" :key="i">{{ line }}</li>
      </ul>
      <p v-if="job('coords').error" class="text-destructive text-sm font-medium">{{ job('coords').error }}</p>
    </section>
  </div>
</template>
