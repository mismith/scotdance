<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { get } from 'firebase/database'
import { httpsCallable } from 'firebase/functions'
import { CaseSensitive, ChevronDown } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import Checkbox from '@/components/ui/Checkbox.vue'
import EmptyState from '@/components/EmptyState.vue'
import Skeleton from '@/components/Skeleton.vue'
import SectionHeader from '@/components/admin/SectionHeader.vue'
import { dataRef, functions } from '@/firebase'
import { confirm, toast } from '@/lib/admin/feedback'
import { canEdit, friendlyError, write } from '@/lib/admin/write'
import { formatShortDate } from '@/lib/format'

// Text saved in capitals ("MARY MACKENZIE", "PREMIER", "12 & UNDER 14
// YEARS"), and competition names with dotted abbreviations ("E.C.H.D.A."),
// each with what it becomes (functions/src/capitals: spelled as the same
// words are typed elsewhere, then by simple rules). Fix writes them; untick
// any it gets wrong (Mac names can't be told apart). Undo puts back what was
// there; profiles update themselves. Import spells new lists the same way.

// As findCapitals returns them.
interface Fix {
  /** From competitions:data/{id}, or "name" for the competition's own. */
  path: string
  /** A dancer's number, or what it is: "Category", "Age group"… */
  what: string
  fields: Record<string, [string, string]>
}
interface Competition {
  id: string
  name: string
  date: string
  fixes: Fix[]
}

const capitals = ref<Competition[] | null>(null)
const dots = ref<Competition[] | null>(null)
const error = ref<string | null>(null)
httpsCallable<unknown, { capitals: Competition[]; dots: Competition[] }>(functions, 'findCapitals', { timeout: 540_000 })()
  .then(({ data }) => ((capitals.value = data.capitals), (dots.value = data.dots)))
  .catch((e) => ((error.value = friendlyError(e)), (capitals.value = []), (dots.value = [])))
const loading = computed(() => !capitals.value || !dots.value)

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const competitions = (n: number) => plural(n, 'competition')
const byDate = (a: Competition, b: Competition) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name)

// Fixes ticked off to leave as they are, by `${competition}/${path}`.
const kept = reactive(new Set<string>())
const keptKey = (c: Competition, f: Fix) => `${c.id}/${f.path}`
const toggleKept = (key: string) => (kept.has(key) ? kept.delete(key) : kept.add(key))
const toFix = (c: Competition) => c.fixes.filter((f) => !kept.has(keptKey(c, f)))
const fixCount = (comps: Competition[]) => comps.reduce((n, c) => n + toFix(c).length, 0)
const total = (list: Competition[] | null) => list?.reduce((n, c) => n + c.fixes.length, 0) ?? 0

const shownText = (f: Fix, i: 0 | 1) => Object.values(f.fields).map((v) => v[i].trim()).join(' · ')
/** "215 dancers, 12 age groups, 6 categories" */
function summary(c: Competition) {
  const n = new Map<string, number>()
  for (const f of c.fixes) {
    const what = /^\d*$/.test(f.what) ? 'Dancer' : f.what
    n.set(what, (n.get(what) ?? 0) + 1)
  }
  return [...n].map(([what, k]) => (what === 'Name' ? 'name' : plural(k, what.toLowerCase()))).join(', ')
}

const SHOWN = 5
const open = reactive(new Set<string>())
const toggle = (key: string) => (open.has(key) ? open.delete(key) : open.add(key))
const shown = (c: Competition) => (open.has(c.id) ? c.fixes : c.fixes.slice(0, SHOWN))

const busy = ref<string | null>(null)

/** Each fix's database path, from the database's root. */
const base = (c: Competition, f: Fix) => (f.path === 'name' ? `competitions/${c.id}` : `competitions:data/${c.id}/${f.path}`)

/**
 * Writes the ticked fixes in `comps` still as listed (read again, a list
 * of each kind at a time), takes them off `list`, and offers Undo.
 */
function fix(list: typeof capitals, comps: Competition[], key: string) {
  return run(key, async () => {
    const lists = new Map<string, Promise<Record<string, Record<string, unknown>> | null>>()
    const now = async (c: Competition, f: Fix) => {
      if (f.path === 'name') return (await get(dataRef(base(c, f)))).val() as Record<string, unknown> | null
      const at = base(c, f).slice(0, base(c, f).lastIndexOf('/'))
      if (!lists.has(at)) lists.set(at, get(dataRef(at)).then((s) => s.val()))
      return (await lists.get(at)!)?.[f.path.split('/')[1]] ?? null
    }
    const updates: Record<string, unknown> = {}
    const before: Record<string, unknown> = {}
    await Promise.all(
      comps.flatMap((c) =>
        toFix(c).map(async (f) => {
          const item = await now(c, f)
          for (const [field, [was, to]] of Object.entries(f.fields)) {
            if (item?.[field] !== was) continue
            updates[`${base(c, f)}/${field}`] = to
            before[`${base(c, f)}/${field}`] = was
          }
        }),
      ),
    )
    if (Object.keys(updates).length) await write(updates)
    const ids = new Set(comps.map((c) => c.id))
    const done = list.value!.filter((c) => ids.has(c.id))
    list.value = list.value!.filter((c) => !ids.has(c.id))
    const fixed = new Set(Object.keys(updates).map((p) => p.slice(0, p.lastIndexOf('/')))).size
    toast(`Fixed ${plural(fixed, 'name')}`, {
      action: Object.keys(before).length
        ? {
            label: 'Undo',
            run: () =>
              write(before)
                .then(() => (list.value = [...list.value!, ...done].sort(byDate)))
                .catch((e) => toast(friendlyError(e), { tone: 'error' })),
          }
        : undefined,
    })
  })
}

async function run(key: string, task: () => Promise<void>) {
  busy.value = key
  try {
    await task()
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  } finally {
    busy.value = null
  }
}

async function fixAll(list: typeof capitals, key: string) {
  const comps = list.value ?? []
  const ok = await confirm({
    title: `Fix all ${plural(fixCount(comps), 'name')}?`,
    message: `In ${competitions(comps.length)}, as shown.`,
    confirmLabel: 'Fix all',
  })
  if (ok) await fix(list, comps, key)
}

const sections = computed(() => [
  {
    key: 'dots',
    list: dots,
    title: 'Dots in competition names',
    description: 'Abbreviations written without dots: E.C.H.D.A. is ECHDA. Untick any to leave as is.',
  },
  {
    key: 'capitals',
    list: capitals,
    title: 'In capitals',
    description: 'Names, locations, categories, age groups, dances and staff typed in capitals, as they’re spelled elsewhere. Untick any to leave as is.',
  },
])
</script>

<template>
  <div class="max-w-3xl space-y-10 p-4 pb-[calc(3rem+var(--safe-bottom))]">
    <SectionHeader title="Capitals" :count="total(capitals) + total(dots) || null" />

    <p v-if="error" class="text-destructive text-sm font-medium" role="alert">{{ error }}</p>

    <div v-if="loading" class="space-y-4" aria-busy="true">
      <Skeleton v-for="i in 3" :key="i" class="h-32 w-full rounded-2xl!" />
    </div>
    <EmptyState
      v-else-if="!total(capitals) && !total(dots) && !error"
      :icon="CaseSensitive"
      title="Nothing to clean up"
      description="Text typed in capitals, and dots in competition names, show up here."
    />

    <template v-else>
      <template v-for="s in sections" :key="s.key">
        <section v-if="s.list.value?.length" class="space-y-3">
          <div class="flex items-start gap-3">
            <div class="min-w-0 flex-1">
              <h2 class="text-heading">
                {{ s.title }} <span class="text-muted-foreground text-base font-medium tabular-nums">{{ total(s.list.value) }}</span>
              </h2>
              <p class="text-muted-foreground text-sm">{{ s.description }}</p>
            </div>
            <Button variant="tonal" size="sm" :busy="busy === s.key" :disabled="!canEdit || !!busy" @click="fixAll(s.list, s.key)">Fix all</Button>
          </div>

          <ul class="surface divide-y rounded-2xl">
            <li v-for="c in s.list.value" :key="c.id" class="space-y-2 py-4 pr-3 pl-4">
              <div class="flex items-start gap-3">
                <RouterLink :to="{ name: 'manage.details', params: { competitionId: c.id } }" class="focus-inset min-w-0 flex-1 rounded-lg">
                  <span class="block text-base font-semibold">{{ c.name || 'Untitled competition' }}</span>
                  <span class="text-muted-foreground block text-sm">{{
                    [formatShortDate(c.date), summary(c), toFix(c).length < c.fixes.length && `${c.fixes.length - toFix(c).length} left as is`].filter(Boolean).join(' · ')
                  }}</span>
                </RouterLink>
                <Button size="sm" variant="tonal" :busy="busy === c.id" :disabled="!canEdit || !!busy || !toFix(c).length" @click="fix(s.list, [c], c.id)">Fix</Button>
              </div>

              <table class="-ml-2 w-[calc(100%+0.5rem)] table-fixed text-sm">
                <colgroup>
                  <col class="w-9" />
                  <col class="w-24" />
                  <col />
                </colgroup>
                <thead class="sr-only">
                  <tr>
                    <th>Fix</th>
                    <th>What</th>
                    <th>Becomes</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="{ f, key } in shown(c).map((f) => ({ f, key: keptKey(c, f) }))" :key="key" class="cursor-pointer" @click="toggleKept(key)">
                    <td class="px-2 py-1 align-middle">
                      <Checkbox as="button" :checked="!kept.has(key)" :aria-label="`Fix ${shownText(f, 0)}`" @toggle="toggleKept(key)" @click.stop />
                    </td>
                    <td class="text-muted-foreground truncate px-2 py-1 tabular-nums">{{ f.what || '–' }}</td>
                    <td v-if="kept.has(key)" class="text-muted-foreground truncate px-2 py-1">{{ shownText(f, 0) }}</td>
                    <td v-else class="truncate px-2 py-1 font-medium" :aria-label="`${shownText(f, 0)}, becomes ${shownText(f, 1)}`">{{ shownText(f, 1) }}</td>
                  </tr>
                </tbody>
              </table>
              <div v-if="c.fixes.length > SHOWN" class="flex items-center gap-3">
                <button
                  type="button"
                  class="press-row focus-inset text-primary -ml-2 flex items-center gap-1 rounded-full px-2 py-1 text-sm font-semibold"
                  :aria-expanded="open.has(c.id)"
                  @click="toggle(c.id)"
                >
                  {{ open.has(c.id) ? 'Show fewer' : `Show all ${c.fixes.length}` }}
                  <ChevronDown :class="['size-4 transition-transform', open.has(c.id) && 'rotate-180']" aria-hidden="true" />
                </button>
                <!-- Again at the end of the full list, for after reading it. -->
                <Button
                  v-if="open.has(c.id)"
                  size="sm"
                  variant="tonal"
                  class="ml-auto"
                  :busy="busy === c.id"
                  :disabled="!canEdit || !!busy || !toFix(c).length"
                  @click="fix(s.list, [c], c.id)"
                  >Fix {{ plural(toFix(c).length, 'name') }}</Button
                >
              </div>
            </li>
          </ul>
        </section>
      </template>
    </template>
  </div>
</template>
