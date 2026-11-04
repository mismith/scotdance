<script setup lang="ts">
import { computed, onScopeDispose, reactive, ref, type Ref } from 'vue'
import { RouterLink } from 'vue-router'
import { get, onValue } from 'firebase/database'
import { httpsCallable } from 'firebase/functions'
import { ChevronDown, UserCheck } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import Checkbox from '@/components/ui/Checkbox.vue'
import EmptyState from '@/components/EmptyState.vue'
import Skeleton from '@/components/Skeleton.vue'
import SectionHeader from '@/components/admin/SectionHeader.vue'
import { dataRef, functions } from '@/firebase'
import { confirm, toast } from '@/lib/admin/feedback'
import { splitFullName } from '@/lib/admin/importDancers'
import { canEdit, friendlyError, write } from '@/lib/admin/write'
import { formatShortDate } from '@/lib/format'

// Dancer entries that need tidying, in two lists:
// - Leftover entries in past competitions that are nobody (functions/src/
//   strayDancers): no name, or neither a number nor an age group, and in no
//   result. Mostly left over from an import. Remove takes them out.
// - Competitions that put each dancer's whole name in First name (functions/
//   src/combinedNames). Split divides them the way import divides a combined
//   name column, shown first.
//   One whose names are right as typed (choreography titles, say) can be
//   left as is, which keeps it out of the list until it's brought back.
// Both have Undo, which puts back what was there; profiles update themselves.

// As findStrayDancers and findCombinedNames return them.
interface StrayDancer {
  id: string
  number?: string | number
  firstName?: string
  lastName?: string
  why: string
  /** The number it's properly entered under, for a leftover copy. */
  copyOf?: string | number
}
interface CombinedName {
  id: string
  number?: string | number
  firstName: string
}
interface Competition<D> {
  id: string
  name: string
  date: string
  dancers: D[]
}
type StrayCompetition = Competition<StrayDancer>
type CombinedCompetition = Competition<CombinedName>

const stray = ref<StrayCompetition[] | null>(null)
const combined = ref<CombinedCompetition[] | null>(null)
const error = ref<string | null>(null)
async function load<D>(name: string, into: Ref<Competition<D>[] | null>) {
  try {
    into.value = (await httpsCallable<unknown, Competition<D>[]>(functions, name, { timeout: 540_000 })()).data
  } catch (e) {
    error.value = friendlyError(e)
    into.value = []
  }
}
void load('findStrayDancers', stray)
void load('findCombinedNames', combined)

const count = (list: Competition<unknown>[] | null) => list?.reduce((n, c) => n + c.dancers.length, 0) ?? 0
const strayTotal = computed(() => count(stray.value))
// Competitions whose names are right as typed, by id.
const asTyped = ref<Record<string, true>>({})
onScopeDispose(onValue(dataRef('dancers:namesAsTyped'), (s) => (asTyped.value = s.val() ?? {})))
const waiting = computed(() => combined.value?.filter((c) => !asTyped.value[c.id]) ?? [])
const leftAsIs = computed(() => combined.value?.filter((c) => asTyped.value[c.id]) ?? [])
const showLeft = ref(false)
async function leaveAsIs(c: CombinedCompetition, on: boolean) {
  const path = `dancers:namesAsTyped/${c.id}`
  try {
    await write({ [path]: on || null })
    toast(`${c.name || 'Untitled competition'} ${on ? 'left as is' : 'brought back'}`, {
      action: { label: 'Undo', run: () => write({ [path]: on ? null : true }).catch((e) => toast(friendlyError(e), { tone: 'error' })) },
    })
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  }
}
const combinedTotal = computed(() => count(waiting.value))
const loading = computed(() => !stray.value || !combined.value)

const entries = (n: number) => (n === 1 ? '1 entry' : `${n} entries`)
const names = (n: number) => (n === 1 ? '1 name' : `${n} names`)
const competitions = (n: number) => (n === 1 ? '1 competition' : `${n} competitions`)
const copies = (c: StrayCompetition) => c.dancers.filter((d) => d.copyOf != null).length
const label = (d: StrayDancer) => `${d.firstName ?? ''} ${d.lastName ?? ''}`.trim()
const byDate = (a: Competition<unknown>, b: Competition<unknown>) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name)
const pathsOf = (comps: Competition<{ id: string }>[]) => comps.flatMap((c) => c.dancers.map((d) => `competitions:data/${c.id}/dancers/${d.id}`))

/**
 * A whole name as it is now, in the parts Split keeps in First name and the
 * parts it moves to Last name: "Adelyn [Dalgleish]", "[Smith,] Isla".
 */
function moving(full: string) {
  const to = splitFullName(full)
  const comma = full.indexOf(',')
  return comma > 0
    ? { before: full.slice(0, comma + 1), keep: to.firstName, after: '', lastName: to.lastName }
    : { before: '', keep: to.firstName, after: full.slice(to.firstName.length).trim(), lastName: to.lastName }
}

// Names ticked off to leave as they are ("Mary Jane" with no last name, say), by `${competition}/${dancer}`.
const kept = reactive(new Set<string>())
const keptKey = (c: CombinedCompetition, d: CombinedName) => `${c.id}/${d.id}`
const toggleKept = (key: string) => (kept.has(key) ? kept.delete(key) : kept.add(key))
const toSplit = (c: CombinedCompetition) => c.dancers.filter((d) => !kept.has(keptKey(c, d)))
const splitCount = (comps: CombinedCompetition[]) => comps.reduce((n, c) => n + toSplit(c).length, 0)

const SHOWN = 5
const open = reactive(new Set<string>())
const toggle = (key: string) => (open.has(key) ? open.delete(key) : open.add(key))
const shown = <D,>(key: string, list: D[]) => (open.has(key) ? list : list.slice(0, SHOWN))

const busy = ref<string | null>(null)

/** Writes `updates`, takes `comps` off `list`, and offers Undo with `before`. */
async function apply<D>(list: Ref<Competition<D>[] | null>, comps: Competition<D>[], updates: Record<string, unknown>, before: Record<string, unknown>, message: string) {
  if (Object.keys(updates).length) await write(updates)
  const ids = new Set(comps.map((c) => c.id))
  const done = list.value!.filter((c) => ids.has(c.id))
  list.value = list.value!.filter((c) => !ids.has(c.id))
  toast(message, {
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

function remove(comps: StrayCompetition[], key: string) {
  return run(key, async () => {
    // Exactly what's there now, so Undo puts back each entry as it was.
    const saved = await Promise.all(pathsOf(comps).map((p) => get(dataRef(p)).then((s) => [p, s.val()] as const)))
    const before = Object.fromEntries(saved.filter(([, v]) => v != null))
    await apply(stray, comps, Object.fromEntries(Object.keys(before).map((p) => [p, null])), before, `Removed ${entries(Object.keys(before).length)}`)
  })
}

function split(comps: CombinedCompetition[], key: string) {
  return run(key, async () => {
    // Only entries still as listed and not ticked off, and exactly as they
    // are, so Undo puts each back.
    const saved = await Promise.all(pathsOf(comps.map((c) => ({ ...c, dancers: toSplit(c) }))).map((p) => get(dataRef(p)).then((s) => [p, s.val()] as const)))
    const updates: Record<string, unknown> = {}
    const before: Record<string, unknown> = {}
    let n = 0
    for (const [p, d] of saved) {
      const first = typeof d?.firstName === 'string' ? d.firstName.trim() : ''
      if (!first || String(d?.lastName ?? '').trim()) continue
      const to = splitFullName(first)
      if (!to.lastName) continue
      Object.assign(updates, { [`${p}/firstName`]: to.firstName, [`${p}/lastName`]: to.lastName })
      Object.assign(before, { [`${p}/firstName`]: d.firstName, [`${p}/lastName`]: d.lastName ?? null })
      n += 1
    }
    await apply(combined, comps, updates, before, `Split ${names(n)}`)
  })
}

async function removeAll() {
  const comps = stray.value ?? []
  const ok = await confirm({
    title: `Remove all ${entries(strayTotal.value)}?`,
    message: `From ${competitions(comps.length)}. None of them is in a result.`,
    confirmLabel: 'Remove all',
    destructive: true,
  })
  if (ok) await remove(comps, 'stray')
}

async function splitAll() {
  const comps = waiting.value
  const ok = await confirm({
    title: `Split all ${names(splitCount(comps))}?`,
    message: `In ${competitions(comps.length)}. The first word stays the first name; the rest moves to Last name.`,
    confirmLabel: 'Split all',
  })
  if (ok) await split(comps, 'combined')
}
</script>

<template>
  <div class="max-w-3xl space-y-10 p-4 pb-[calc(3rem+var(--safe-bottom))]">
    <SectionHeader title="Dancers" :count="strayTotal + combinedTotal || null" />

    <p v-if="error" class="text-destructive text-sm font-medium" role="alert">{{ error }}</p>

    <div v-if="loading" class="space-y-4" aria-busy="true">
      <Skeleton v-for="i in 3" :key="i" class="h-32 w-full rounded-2xl!" />
    </div>
    <EmptyState
      v-else-if="!strayTotal && !combinedTotal && !error"
      :icon="UserCheck"
      title="Nothing to clean up"
      description="Leftover entries and whole names in First name show up here."
    />

    <template v-else>
      <section v-if="waiting.length" class="space-y-3">
        <div class="flex items-start gap-3">
          <div class="min-w-0 flex-1">
            <h2 class="text-heading">
              Whole names in First name <span class="text-muted-foreground text-base font-medium tabular-nums">{{ combinedTotal }}</span>
            </h2>
            <p class="text-muted-foreground text-sm">Each dancer’s whole name is in First name, with Last name empty. Split moves the struck-out part to Last name, as import does. Untick any to leave as is.</p>
          </div>
          <Button variant="tonal" size="sm" :busy="busy === 'combined'" :disabled="!canEdit || !!busy" @click="splitAll()">Split all</Button>
        </div>

        <ul class="surface divide-y rounded-2xl">
          <li v-for="c in waiting" :key="c.id" class="space-y-2 py-4 pr-3 pl-4">
            <div class="flex items-start gap-3">
              <RouterLink :to="{ name: 'manage.dancers', params: { competitionId: c.id } }" class="focus-inset min-w-0 flex-1 rounded-lg">
                <span class="block text-base font-semibold">{{ c.name || 'Untitled competition' }}</span>
                <span class="text-muted-foreground block text-sm">{{
                  [formatShortDate(c.date), names(c.dancers.length), toSplit(c).length < c.dancers.length && `${c.dancers.length - toSplit(c).length} left as is`].filter(Boolean).join(' · ')
                }}</span>
              </RouterLink>
              <Button size="sm" variant="plain" :disabled="!canEdit || !!busy" @click="leaveAsIs(c, true)">Leave as is</Button>
              <Button size="sm" variant="tonal" :busy="busy === c.id" :disabled="!canEdit || !!busy || !toSplit(c).length" @click="split([c], c.id)">Split</Button>
            </div>

            <table class="-ml-2 w-[calc(100%+0.5rem)] table-fixed text-sm">
              <thead class="text-muted-foreground text-left text-xs font-medium">
                <tr>
                  <th class="w-9 px-2 py-1 font-medium"><span class="sr-only">Split</span></th>
                  <th class="w-12 px-2 py-1 font-medium"><span class="sr-only">Number</span></th>
                  <th class="px-2 py-1 font-medium">First name</th>
                  <th class="px-2 py-1 font-medium">Last name</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="{ d, m, key } in shown(`combined:${c.id}`, c.dancers).map((d) => ({ d, m: moving(d.firstName), key: keptKey(c, d) }))"
                  :key="d.id"
                  class="cursor-pointer"
                  @click="toggleKept(key)"
                >
                  <td class="px-2 py-1 align-middle">
                    <Checkbox as="button" :checked="!kept.has(key)" :aria-label="`Split ${d.firstName}`" @toggle="toggleKept(key)" @click.stop />
                  </td>
                  <td class="text-muted-foreground px-2 py-1 tabular-nums">{{ d.number ?? '–' }}</td>
                  <td v-if="kept.has(key)" class="text-muted-foreground truncate px-2 py-1">{{ d.firstName }}</td>
                  <td v-else class="truncate px-2 py-1 font-medium" :aria-label="`${d.firstName}, becomes ${m.keep}`">
                    <s v-if="m.before" class="text-muted-foreground me-[0.3em] font-normal">{{ m.before }}</s>{{ m.keep }}<s v-if="m.after" class="text-muted-foreground ms-[0.3em] font-normal">{{ m.after }}</s>
                  </td>
                  <td class="truncate px-2 py-1 font-medium">
                    <span v-if="!kept.has(key)" class="bg-primary/10 text-primary -mx-1 rounded px-1" :aria-label="`becomes ${m.lastName}`">{{ m.lastName }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-if="c.dancers.length > SHOWN" class="flex items-center gap-3">
              <button
                type="button"
                class="press-row focus-inset text-primary -ml-2 flex items-center gap-1 rounded-full px-2 py-1 text-sm font-semibold"
                :aria-expanded="open.has(`combined:${c.id}`)"
                @click="toggle(`combined:${c.id}`)"
              >
                {{ open.has(`combined:${c.id}`) ? 'Show fewer' : `Show all ${c.dancers.length}` }}
                <ChevronDown :class="['size-4 transition-transform', open.has(`combined:${c.id}`) && 'rotate-180']" aria-hidden="true" />
              </button>
              <!-- Again at the end of the full list, for after reading it. -->
              <Button
                v-if="open.has(`combined:${c.id}`)"
                size="sm"
                variant="tonal"
                class="ml-auto"
                :busy="busy === c.id"
                :disabled="!canEdit || !!busy || !toSplit(c).length"
                @click="split([c], c.id)"
                >Split {{ names(toSplit(c).length) }}</Button
              >
            </div>
          </li>
        </ul>
      </section>

      <section v-if="stray?.length" class="space-y-3">
        <div class="flex items-start gap-3">
          <div class="min-w-0 flex-1">
            <h2 class="text-heading">
              Leftover entries <span class="text-muted-foreground text-base font-medium tabular-nums">{{ strayTotal }}</span>
            </h2>
            <p class="text-muted-foreground text-sm">Entries in past competitions with no name, or with neither a number nor an age group, that no result names. Most are left over from an import.</p>
          </div>
          <Button variant="tonal" size="sm" :busy="busy === 'stray'" :disabled="!canEdit || !!busy" @click="removeAll()">Remove all</Button>
        </div>

        <ul class="surface divide-y rounded-2xl">
          <li v-for="c in stray" :key="c.id" class="space-y-2 py-4 pr-3 pl-4">
            <div class="flex items-start gap-3">
              <RouterLink :to="{ name: 'manage.dancers', params: { competitionId: c.id } }" class="focus-inset min-w-0 flex-1 rounded-lg">
                <span class="block text-base font-semibold">{{ c.name || 'Untitled competition' }}</span>
                <span class="text-muted-foreground block text-sm">
                  {{ formatShortDate(c.date) }} · {{ entries(c.dancers.length) }}<template v-if="copies(c)">, {{ copies(c) === c.dancers.length ? 'all' : copies(c) }} of them copies</template>
                </span>
              </RouterLink>
              <Button size="sm" variant="tonal" :busy="busy === c.id" :disabled="!canEdit || !!busy" @click="remove([c], c.id)">Remove</Button>
            </div>

            <ul class="-ml-2">
              <li v-for="d in shown(`stray:${c.id}`, c.dancers)" :key="d.id" class="flex items-baseline gap-2 px-2 py-1 text-sm">
                <span class="text-muted-foreground w-10 shrink-0 tabular-nums">{{ d.number ?? '–' }}</span>
                <span class="min-w-0 flex-1">
                  <span :class="['font-medium', !label(d) && 'text-muted-foreground']">{{ label(d) || 'No name' }}</span>
                  <span v-if="label(d)" class="text-muted-foreground">
                    · {{ d.why }}<template v-if="d.copyOf != null">. Entered as {{ d.copyOf }}</template>
                  </span>
                </span>
              </li>
            </ul>
            <button
              v-if="c.dancers.length > SHOWN"
              type="button"
              class="press-row focus-inset text-primary -ml-2 flex items-center gap-1 rounded-full px-2 py-1 text-sm font-semibold"
              :aria-expanded="open.has(`stray:${c.id}`)"
              @click="toggle(`stray:${c.id}`)"
            >
              {{ open.has(`stray:${c.id}`) ? 'Show fewer' : `Show all ${c.dancers.length}` }}
              <ChevronDown :class="['size-4 transition-transform', open.has(`stray:${c.id}`) && 'rotate-180']" aria-hidden="true" />
            </button>
          </li>
        </ul>
      </section>
    </template>

    <section v-if="!loading && leftAsIs.length" class="space-y-3">
      <button
        type="button"
        class="press-row focus-inset -mx-2 flex items-center gap-1 rounded-xl px-2 py-1 text-left"
        :aria-expanded="showLeft"
        @click="showLeft = !showLeft"
      >
        <h2 class="text-heading">Names left as is <span class="text-muted-foreground font-medium tabular-nums">{{ leftAsIs.length }}</span></h2>
        <ChevronDown :class="['text-muted-foreground size-5 transition-transform', showLeft && 'rotate-180']" aria-hidden="true" />
      </button>
      <ul v-if="showLeft" class="surface divide-y rounded-2xl">
        <li v-for="c in leftAsIs" :key="c.id" class="flex items-center gap-3 py-2 pr-2 pl-4">
          <span class="min-w-0 flex-1">
            <span class="block text-base font-medium">{{ c.name || 'Untitled competition' }}</span>
            <span class="text-muted-foreground block text-sm">{{ [formatShortDate(c.date), names(c.dancers.length)].filter(Boolean).join(' · ') }}</span>
          </span>
          <Button :disabled="!canEdit" @click="leaveAsIs(c, false)">Bring back</Button>
        </li>
      </ul>
    </section>
  </div>
</template>
