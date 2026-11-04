<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { get } from 'firebase/database'
import { ChevronDown, ListChecks } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import Checkbox from '@/components/ui/Checkbox.vue'
import EmptyState from '@/components/EmptyState.vue'
import Skeleton from '@/components/Skeleton.vue'
import SectionHeader from '@/components/admin/SectionHeader.vue'
import { dataRef } from '@/firebase'
import { confirm, toast } from '@/lib/admin/feedback'
import { fieldsOf, tidyDance, type DanceFields, type Tidied } from '@/lib/admin/danceCleanup'
import { canEdit, friendlyError, write } from '@/lib/admin/write'
import { formatShortDate } from '@/lib/format'

// Standard dances typed another way across competitions ("FLING", "S.T",
// "Half Hullachan"), grouped by the dance they are, each with exactly what
// Standardise saves (lib/admin/danceCleanup). Any can be unticked to leave
// as is. Standardise saves the ticked ones of a dance, or all of them, and
// says so in a toast with Undo. Read here, not by a function: one small
// section of each competition.

interface Fix {
  competitionId: string
  competition: string
  date: number
  danceId: string
  now: Tidied
  to: Tidied
}

const time = (d: unknown) => (typeof d === 'number' ? d : Date.parse(String(d ?? '')) || 0)

const fixes = ref<Fix[] | null>(null)
const error = ref<string | null>(null)
async function load() {
  try {
    const comps = ((await get(dataRef('competitions'))).val() ?? {}) as Record<string, { name?: string; date?: unknown } | null>
    const found = await Promise.all(
      Object.entries(comps).map(async ([competitionId, c]) => {
        const dances = ((await get(dataRef(`competitions:data/${competitionId}/dances`))).val() ?? {}) as Record<string, DanceFields | null>
        return Object.entries(dances).flatMap(([danceId, d]) => {
          const to = d && typeof d === 'object' ? tidyDance(d) : null
          return to
            ? [
                {
                  competitionId,
                  competition: c?.name ?? '',
                  date: time(c?.date),
                  danceId,
                  now: fieldsOf(d!),
                  to,
                },
              ]
            : []
        })
      }),
    )
    fixes.value = found.flat()
  } catch (e) {
    error.value = friendlyError(e)
    fixes.value = []
  }
}
void load()

const fixKey = (f: Fix) => `${f.competitionId}/${f.danceId}`
// Ones ticked off to leave as typed, by fixKey.
const kept = reactive(new Set<string>())
const toggleKept = (key: string) => (kept.has(key) ? kept.delete(key) : kept.add(key))
const ticked = (list: Fix[]) => list.filter((f) => !kept.has(fixKey(f)))

// By the dance they'll be, the most to tidy first; newest competitions first in each.
const groups = computed(() => {
  const by = new Map<string, Fix[]>()
  for (const f of fixes.value ?? []) by.set(f.to.name, [...(by.get(f.to.name) ?? []), f])
  return [...by]
    .map(([name, list]) => ({
      name,
      list: list.sort((a, b) => b.date - a.date || a.competition.localeCompare(b.competition)),
    }))
    .sort((a, b) => b.list.length - a.list.length || a.name.localeCompare(b.name))
})
const total = computed(() => fixes.value?.length ?? 0)

const dances = (n: number) => (n === 1 ? '1 dance' : `${n} dances`)
const competitions = (n: number) => (n === 1 ? '1 competition' : `${n} competitions`)
const competitionCount = (list: Fix[]) => new Set(list.map((f) => f.competitionId)).size
/** The ways a dance is typed, most used first. */
function typed(list: Fix[]) {
  const counts = new Map<string, number>()
  for (const f of list) counts.set(f.now.name, (counts.get(f.now.name) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1]).map(([name]) => name)
}

const SHOWN = 5
const open = reactive(new Set<string>())
const toggle = (key: string) => (open.has(key) ? open.delete(key) : open.add(key))
const shown = (key: string, list: Fix[]) => (open.has(key) ? list : list.slice(0, SHOWN))

/** A dance's Steps and Short name, each marked when it differs from `was`'s. */
function details(d: Tidied, was?: Tidied) {
  return [
    d.steps && { text: `Steps ${d.steps}`, changed: !!was && d.steps !== was.steps },
    d.shortName && { text: `Short name ${d.shortName}`, changed: !!was && d.shortName !== was.shortName },
  ].filter((x): x is { text: string; changed: boolean } => !!x)
}

const FIELDS = ['name', 'steps', 'shortName'] as const
const busy = ref<string | null>(null)

async function standardise(list: Fix[], key: string) {
  busy.value = key
  try {
    // Only dances still as listed, and exactly as they are, so Undo puts each back.
    const paths = ticked(list).map((f) => `competitions:data/${f.competitionId}/dances/${f.danceId}`)
    const saved = await Promise.all(paths.map((p) => get(dataRef(p)).then((s) => [p, s.val() as DanceFields | null] as const)))
    const updates: Record<string, unknown> = {}
    const before: Record<string, unknown> = {}
    let n = 0
    for (const [p, d] of saved) {
      const to = d && tidyDance(d)
      if (!to) continue
      const now = fieldsOf(d)
      for (const field of FIELDS) {
        if (to[field] === now[field]) continue
        updates[`${p}/${field}`] = to[field] || null
        before[`${p}/${field}`] = d[field] ?? null
      }
      n += 1
    }
    if (n) await write(updates)
    const done = new Set(list.map(fixKey))
    const taken = fixes.value!.filter((f) => done.has(fixKey(f)) && !kept.has(fixKey(f)))
    fixes.value = fixes.value!.filter((f) => !taken.includes(f))
    toast(`Standardised ${dances(n)}`, {
      action: n
        ? {
            label: 'Undo',
            run: () =>
              write(before)
                .then(() => (fixes.value = [...fixes.value!, ...taken]))
                .catch((e) => toast(friendlyError(e), { tone: 'error' })),
          }
        : undefined,
    })
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  } finally {
    busy.value = null
  }
}

async function standardiseAll() {
  const list = ticked(fixes.value ?? [])
  const ok = await confirm({
    title: `Standardise all ${dances(list.length)}?`,
    message: `In ${competitions(competitionCount(list))}. Each is saved as shown.`,
    confirmLabel: 'Standardise all',
  })
  if (ok) await standardise(fixes.value ?? [], 'all')
}
</script>

<template>
  <div class="max-w-3xl space-y-10 p-4 pb-[calc(3rem+var(--safe-bottom))]">
    <SectionHeader title="Dances" :count="total || null" />

    <p v-if="error" class="text-destructive text-sm font-medium" role="alert">
      {{ error }}
    </p>

    <div v-if="!fixes" class="space-y-4" aria-busy="true">
      <Skeleton v-for="i in 3" :key="i" class="h-32 w-full rounded-2xl!" />
    </div>
    <EmptyState
      v-else-if="!total && !error"
      :icon="ListChecks"
      title="Nothing to clean up"
      description="Standard dances typed another way, like FLING or S.T, show up here."
    />

    <section v-else class="space-y-3">
      <div class="flex items-start gap-3">
        <p class="text-muted-foreground min-w-0 flex-1 text-sm">
          Standard dances typed another way. Standardise saves each as Add common dances has it, with steps in the name moved to Steps. Untick any to leave as
          is. Events of their own, like Trophy Fling, aren’t listed.
        </p>
        <Button variant="tonal" size="sm" :busy="busy === 'all'" :disabled="!canEdit || !!busy" @click="standardiseAll()">Standardise all</Button>
      </div>

      <ul class="surface divide-y rounded-2xl">
        <li v-for="g in groups" :key="g.name" class="space-y-2 py-4 pr-3 pl-4">
          <div class="flex items-start gap-3">
            <div class="min-w-0 flex-1">
              <h2 class="text-base font-semibold">{{ g.name }}</h2>
              <p class="text-muted-foreground text-sm">
                {{ [dances(g.list.length), competitions(competitionCount(g.list))].join(' · ')
                }}<template v-if="g.list.length > ticked(g.list).length"> · {{ g.list.length - ticked(g.list).length }} left as is</template>
              </p>
              <p class="text-muted-foreground line-clamp-2 text-sm">Typed {{ typed(g.list).join(', ') }}</p>
            </div>
            <Button
              size="sm"
              variant="tonal"
              :busy="busy === g.name"
              :disabled="!canEdit || !!busy || !ticked(g.list).length"
              @click="standardise(g.list, g.name)"
              >Standardise</Button
            >
          </div>

          <table class="-ml-2 w-[calc(100%+0.5rem)] table-fixed text-sm">
            <thead class="text-muted-foreground text-left text-xs font-medium">
              <tr>
                <th class="w-9 px-2 py-1 font-medium">
                  <span class="sr-only">Standardise</span>
                </th>
                <th class="px-2 py-1 font-medium">Competition</th>
                <th class="w-[30%] px-2 py-1 font-medium">Now</th>
                <th class="w-[30%] px-2 py-1 font-medium">Saved as</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="f in shown(g.name, g.list)" :key="fixKey(f)" class="cursor-pointer align-top" @click="toggleKept(fixKey(f))">
                <td class="px-2 py-1">
                  <Checkbox
                    as="button"
                    :checked="!kept.has(fixKey(f))"
                    :aria-label="`Standardise ${f.now.name} in ${f.competition}`"
                    @toggle="toggleKept(fixKey(f))"
                    @click.stop
                  />
                </td>
                <td class="min-w-0 px-2 py-1">
                  <RouterLink
                    :to="{
                      name: 'manage.dances',
                      params: { competitionId: f.competitionId, itemId: f.danceId },
                    }"
                    class="focus-inset block truncate rounded font-medium"
                    @click.stop
                    >{{ f.competition || 'Untitled competition' }}</RouterLink
                  >
                  <span class="text-muted-foreground block">{{ formatShortDate(f.date) }}</span>
                </td>
                <td class="text-muted-foreground px-2 py-1">
                  <span class="block break-words">{{ f.now.name }}</span>
                  <span v-if="details(f.now).length" class="block text-xs break-words">{{
                    details(f.now)
                      .map((d) => d.text)
                      .join(' · ')
                  }}</span>
                </td>
                <td v-if="kept.has(fixKey(f))" class="text-muted-foreground px-2 py-1">As is</td>
                <td v-else class="px-2 py-1 font-medium" :aria-label="`becomes ${[f.to.name, ...details(f.to).map((d) => d.text)].join(', ')}`">
                  <span class="block break-words"
                    ><span :class="f.to.name !== f.now.name && 'bg-primary/10 text-primary -mx-1 rounded px-1'">{{ f.to.name }}</span></span
                  >
                  <span v-if="details(f.to).length" class="text-muted-foreground block text-xs font-normal break-words"
                    ><template v-for="(d, i) in details(f.to, f.now)" :key="d.text"
                      >{{ i ? ' · ' : ''
                      }}<span :class="d.changed && 'bg-primary/10 text-primary -mx-0.5 rounded px-0.5 font-medium'">{{ d.text }}</span></template
                    ></span
                  >
                </td>
              </tr>
            </tbody>
          </table>
          <div v-if="g.list.length > SHOWN" class="flex items-center gap-3">
            <button
              type="button"
              class="press-row focus-inset text-primary -ml-2 flex items-center gap-1 rounded-full px-2 py-1 text-sm font-semibold"
              :aria-expanded="open.has(g.name)"
              @click="toggle(g.name)"
            >
              {{ open.has(g.name) ? 'Show fewer' : `Show all ${g.list.length}` }}
              <ChevronDown :class="['size-4 transition-transform', open.has(g.name) && 'rotate-180']" aria-hidden="true" />
            </button>
            <!-- Again at the end of the full list, for after reading it. -->
            <Button
              v-if="open.has(g.name)"
              size="sm"
              variant="tonal"
              class="ml-auto"
              :busy="busy === g.name"
              :disabled="!canEdit || !!busy || !ticked(g.list).length"
              @click="standardise(g.list, g.name)"
              >Standardise {{ dances(ticked(g.list).length) }}</Button
            >
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>
