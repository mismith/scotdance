<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { get } from 'firebase/database'
import { httpsCallable } from 'firebase/functions'
import { ChevronDown, UserCheck } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import EmptyState from '@/components/EmptyState.vue'
import Skeleton from '@/components/Skeleton.vue'
import SectionHeader from '@/components/admin/SectionHeader.vue'
import { dataRef, functions } from '@/firebase'
import { confirm, toast } from '@/lib/admin/feedback'
import { canEdit, friendlyError, write } from '@/lib/admin/write'
import { formatShortDate } from '@/lib/format'

// Dancer entries in past competitions that are nobody (functions/src/
// strayDancers): no name, or neither a number nor an age group, and in no
// result. Mostly left over from an import. Remove takes them out of the
// competition, with Undo; their profiles update themselves.

// As findStrayDancers returns them.
interface StrayDancer {
  id: string
  number?: string | number
  firstName?: string
  lastName?: string
  why: string
  /** The number it's properly entered under, for a leftover copy. */
  copyOf?: string | number
}
interface StrayCompetition {
  id: string
  name: string
  date: string
  dancers: StrayDancer[]
}

const list = ref<StrayCompetition[] | null>(null)
const error = ref<string | null>(null)
async function load() {
  error.value = null
  try {
    list.value = (await httpsCallable<unknown, StrayCompetition[]>(functions, 'findStrayDancers', { timeout: 540_000 })()).data
  } catch (e) {
    error.value = friendlyError(e)
    list.value = []
  }
}
void load()

const total = computed(() => list.value?.reduce((n, c) => n + c.dancers.length, 0) ?? 0)
const entries = (n: number) => (n === 1 ? '1 entry' : `${n} entries`)
const copies = (c: StrayCompetition) => c.dancers.filter((d) => d.copyOf != null).length
const label = (d: StrayDancer) => `${d.firstName ?? ''} ${d.lastName ?? ''}`.trim()

const SHOWN = 5
const open = reactive(new Set<string>())
const toggle = (id: string) => (open.has(id) ? open.delete(id) : open.add(id))

const busy = ref<string | null>(null)
async function remove(comps: StrayCompetition[], key: string) {
  busy.value = key
  try {
    // Exactly what's there now, so Undo puts back each entry as it was.
    const paths = comps.flatMap((c) => c.dancers.map((d) => `competitions:data/${c.id}/dancers/${d.id}`))
    const saved = await Promise.all(paths.map((p) => get(dataRef(p)).then((s) => [p, s.val()] as const)))
    const before = Object.fromEntries(saved.filter(([, v]) => v != null))
    await write(Object.fromEntries(Object.keys(before).map((p) => [p, null])))
    const ids = new Set(comps.map((c) => c.id))
    const removed = list.value!.filter((c) => ids.has(c.id))
    list.value = list.value!.filter((c) => !ids.has(c.id))
    toast(`Removed ${entries(Object.keys(before).length)}`, {
      action: {
        label: 'Undo',
        run: () =>
          write(before)
            .then(() => (list.value = [...list.value!, ...removed].sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name))))
            .catch((e) => toast(friendlyError(e), { tone: 'error' })),
      },
    })
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  } finally {
    busy.value = null
  }
}
async function removeAll() {
  const comps = list.value ?? []
  const ok = await confirm({
    title: `Remove all ${entries(total.value)}?`,
    message: `From ${comps.length === 1 ? '1 competition' : `${comps.length} competitions`}. None of them is in a result.`,
    confirmLabel: 'Remove all',
    destructive: true,
  })
  if (ok) await remove(comps, 'all')
}
</script>

<template>
  <div class="max-w-3xl space-y-6 p-4 pb-[calc(3rem+var(--safe-bottom))]">
    <SectionHeader
      title="Dancer cleanup"
      :count="total || null"
      description="Entries in past competitions with no name, or with neither a number nor an age group, that no result names. Most are left over from an import."
    >
      <template #actions>
        <Button v-if="list?.length" variant="tonal" size="sm" :busy="busy === 'all'" :disabled="!canEdit || !!busy" @click="removeAll()">Remove all</Button>
      </template>
    </SectionHeader>

    <p v-if="error" class="text-destructive text-sm font-medium" role="alert">{{ error }}</p>

    <div v-if="!list" class="space-y-4" aria-busy="true">
      <Skeleton v-for="i in 3" :key="i" class="h-32 w-full rounded-2xl!" />
    </div>
    <EmptyState v-else-if="!list.length && !error" :icon="UserCheck" title="Nothing to clean up" description="Empty and leftover dancer entries show up here." />

    <ul v-else class="surface divide-y rounded-2xl">
      <li v-for="c in list" :key="c.id" class="space-y-2 py-4 pr-3 pl-4">
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
          <li v-for="d in open.has(c.id) ? c.dancers : c.dancers.slice(0, SHOWN)" :key="d.id" class="flex items-baseline gap-2 px-2 py-1 text-sm">
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
          :aria-expanded="open.has(c.id)"
          @click="toggle(c.id)"
        >
          {{ open.has(c.id) ? 'Show fewer' : `Show all ${c.dancers.length}` }}
          <ChevronDown :class="['size-4 transition-transform', open.has(c.id) && 'rotate-180']" aria-hidden="true" />
        </button>
      </li>
    </ul>
  </div>
</template>
