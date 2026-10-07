<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { computed, onScopeDispose, reactive, ref, watch } from 'vue'
import { get, limitToLast, onValue, orderByKey, query } from 'firebase/database'
import { httpsCallable } from 'firebase/functions'
import { RefreshCw, Send } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import SectionHeader from '@/components/admin/SectionHeader.vue'
import TextField from '@/components/admin/TextField.vue'
import NotificationCard from '@/components/NotificationCard.vue'
import { dataRef, functions } from '@/firebase'
import { confirm } from '@/lib/admin/feedback'
import { versionJump } from '@/lib/admin/versions'
import { write } from '@/lib/admin/write'

// Maintenance for whoever runs ScotDance: the app versions people are
// told to update to, and rebuilding search and profile data. Search and
// profiles keep themselves up to date as competitions change: rebuilding is
// for the first build, or to repair them.

const versions = ref<Record<string, string>>({})
const off = onValue(dataRef('versions'), (snap) => (versions.value = (snap.val() ?? {}) as Record<string, string>))
onScopeDispose(off)
const APPS = [
  { key: 'web', label: 'Web' },
  { key: 'ios', label: 'iPhone and iPad' },
  { key: 'android', label: 'Android' },
]

// A typo (200.0.0) would ask everyone to update to a release that doesn't
// exist, so a big jump, or going back, asks first. Saying no puts back the
// saved version (in a new box: the old one takes the save as done).
const resets = reactive<Record<string, number>>({})
const saveVersion = (key: string, label: string) => async (v: string | null) => {
  const from = versions.value[key]
  const jump = v ? versionJump(from, v) : null
  const ok =
    !jump ||
    (await confirm({
      title: `Set ${label} to ${v}?`,
      message:
        jump === 'big'
          ? `That’s a big jump from ${from}, and everyone on an older version will be asked to update to it. Check it’s been released.`
          : `That’s lower than ${from}, so people on the versions in between will stop being asked to update.`,
      confirmLabel: 'Save',
    }))
  if (!ok) {
    resets[key] = (resets[key] ?? 0) + 1
    return
  }
  await write({ [`versions/${key}`]: v })
}
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
  messages: 'sent',
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
// Alerts: the followers lists they're sent from, built once when the alert
// functions go live (they keep themselves up to date after that). And, on a
// local emulator, where nothing really sends, the alerts that would have.
interface LoggedAlert { uid?: string; title?: string; body?: string; link?: string; kind?: string; tokens?: number; at?: number }
const outbox = ref<Array<LoggedAlert & { id: string }>>([])
const offOutbox = onValue(query(dataRef('notifications:log'), orderByKey(), limitToLast(30)), (snap) => {
  outbox.value = Object.entries((snap.val() ?? {}) as Record<string, LoggedAlert>)
    .map(([id, a]) => ({ ...a, id }))
    .reverse()
}, () => (outbox.value = []))
onScopeDispose(offOutbox)
const emails = reactive<Record<string, string>>({})
watch(outbox, async (list) => {
  for (const uid of new Set(list.map((a) => a.uid).filter((u): u is string => !!u && !(u in emails)))) {
    emails[uid] = (await get(dataRef(`users/${uid}/email`)).catch(() => null))?.val() ?? 'Someone'
  }
})
// "now", "4m ago", then the time: how a phone dates its notifications.
function ago(at?: number) {
  if (!at) return ''
  const m = Math.round((Date.now() - at) / 60_000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m ago`
  return new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}
const KIND: Record<string, string> = { results: 'Results', morning: 'Morning of', published: 'Dancer list is up' }
const isEmulator = import.meta.env.MODE === 'emulator'
const showOutbox = computed(() => isEmulator || outbox.value.length > 0)
const morningFor = ref('')

for (const key of [...REINDEX.map((r) => r.key), ...PROFILES.flatMap((p) => [`agg${p.key}`, `bp${p.key}`]), 'coords', 'followers', 'morning'])
  jobs[key] = { running: false, result: null, error: null }
</script>

<template>
  <div class="max-w-3xl space-y-10 p-4 pb-[calc(3rem+var(--safe-bottom))]">
    <SectionHeader title="Tools" />

    <section class="space-y-4">
      <div>
        <h2 class="text-heading">App versions</h2>
        <p class="text-muted-foreground text-sm">People on an older version are asked to update. Set each app’s once its release is live in the store. The web’s sets itself when it deploys.</p>
      </div>
      <div class="grid gap-4 sm:grid-cols-3">
        <TextField
          v-for="p in APPS"
          :key="`${p.key}-${resets[p.key] ?? 0}`"
          :model-value="versions[p.key]"
          :label="p.label"
          placeholder="4.0.0"
          :validate="versionPattern"
          :save="saveVersion(p.key, p.label)"
        />
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
            <RefreshCw v-if="!job(r.key).running" /> Rebuild
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
            <RefreshCw v-if="!profileBusy(p.key)" /> Rebuild
          </Button>
        </li>
      </ul>
    </section>

    <section class="space-y-3">
      <div>
        <h2 class="text-heading">Alerts</h2>
        <p class="text-muted-foreground text-sm">Who follows each dancer and competition, which alerts go to. Build it once when alerts first go live; it keeps itself up to date after that.</p>
      </div>
      <ul class="surface divide-y rounded-2xl">
        <li class="flex flex-wrap items-center gap-3 py-2 pr-2 pl-4">
          <span class="min-w-0 flex-1">
            <span class="block text-base font-medium">Followers</span>
            <span v-if="job('followers').result" class="text-done-foreground block text-sm">{{ job('followers').result }}</span>
            <span v-if="job('followers').error" class="text-destructive block text-sm font-medium">{{ job('followers').error }}</span>
          </span>
          <Button :busy="job('followers').running" @click="run('followers', 'backfillFollowers')">
            <RefreshCw v-if="!job('followers').running" /> Rebuild
          </Button>
        </li>
      </ul>
      <template v-if="showOutbox">
        <form v-if="isEmulator" class="flex flex-wrap items-end gap-2" @submit.prevent="run('morning', 'sendMorningSummary', { competitionId: morningFor })">
          <label class="min-w-0 flex-1 space-y-1.5">
            <span class="text-callout block font-medium">Send a morning summary now</span>
            <input v-model="morningFor" type="text" placeholder="Competition id" class="field h-11 w-full rounded-xl px-3 text-base" />
          </label>
          <Button type="submit" :busy="job('morning').running" :disabled="!morningFor.trim()"><Send v-if="!job('morning').running" /> Send</Button>
        </form>
        <p v-if="job('morning').result" class="text-done-foreground text-sm">{{ job('morning').result }}</p>
        <h3 class="text-callout pt-2 font-semibold">Sent here instead <span class="text-muted-foreground font-normal">(local emulator)</span></h3>
        <p class="text-muted-foreground text-sm">Nothing reaches a phone from the emulator: each alert lands here, as it would have looked.</p>
        <p v-if="!outbox.length" class="text-muted-foreground text-sm">None yet. Post a result for a dancer someone follows.</p>
        <ul v-else class="bg-blue-paper space-y-3 rounded-2xl p-3">
          <li v-for="a in outbox" :key="a.id" class="space-y-1">
            <NotificationCard :title="a.title ?? ''" :body="a.body" :when="ago(a.at)" />
            <p class="text-muted-foreground px-3 text-xs">
              {{ KIND[a.kind ?? ''] ?? 'Alert' }} · to {{ a.uid ? emails[a.uid] ?? '…' : 'someone' }} · {{ a.tokens === 1 ? '1 phone' : `${a.tokens ?? 0} phones` }}
              <RouterLink v-if="a.link" :to="a.link" class="text-primary font-medium"> · Open</RouterLink>
            </p>
          </li>
        </ul>
      </template>
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
