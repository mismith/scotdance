<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { ChevronRight, CloudOff, Diamond, ListOrdered, Search, Trophy, X } from '@lucide/vue'
import Dialog from '@/components/Dialog.vue'
import EmptyState from '@/components/EmptyState.vue'
import HelpTip from '@/components/admin/HelpTip.vue'
import PlacedList from '@/components/admin/PlacedList.vue'
import Button from '@/components/ui/Button.vue'
import Segmented from '@/components/ui/Segmented.vue'
import Switch from '@/components/ui/Switch.vue'
import { useManagedCompetition } from '@/composables/admin/useManagedCompetition'
import { toast } from '@/lib/admin/feedback'
import { canEdit, friendlyError } from '@/lib/admin/write'
import { selectionHaptic, tapHaptic } from '@/lib/haptics'
import { getOrdinalSuffix } from '@/lib/results'
import { isPrimaryCategory } from '@/types/competition'
import {
  CALLBACKS,
  OVERALL,
  isPlaceholderId,
  newPlaceholderId,
  parsePlacings,
  removeEntry,
  resultRows,
  resultsOrder,
  scheduleTurns,
  serializePlacings,
  type Entry,
  type Placings,
} from '@/lib/admin/results'

// One dance's results, the same way as the old admin: tap dancers in the
// order they placed (tap again to take them out), drag to fix the order and
// switch on Tie where two share a place. Callbacks come first; each dance
// then lists only the dancers called back. A "?" stands in for a dancer whose
// number was missed, so entry can carry on and be fixed later.

const props = defineProps<{ groupId: string; danceId: string }>()

const m = useManagedCompetition()
const uid = useId()

const group = computed(() => m.groupsById.value.get(props.groupId) ?? null)
const isCallbacks = computed(() => props.danceId === CALLBACKS)
const isOverall = computed(() => props.danceId === OVERALL)
const isDance = computed(() => !isCallbacks.value && !isOverall.value)
const kind = computed(() => (isCallbacks.value ? 'callbacks' : isOverall.value ? 'overall' : 'dance'))
const danceName = computed(() => (isCallbacks.value ? 'Callbacks' : isOverall.value ? 'Overall' : (m.dancesById.value.get(props.danceId)?.label ?? 'Dance')))

const path = computed(() => `results/${props.groupId}/${props.danceId}`)
// Always build on the latest stored value: another device may have changed it.
const rawNow = () => m.results.value[props.groupId]?.[props.danceId]
const placings = computed<Placings>(() => parsePlacings(rawNow()))
const markedNone = computed(() => rawNow() === false)

const TABS = [
  { value: 'placings', label: 'Placings' },
  { value: 'points', label: 'Points' },
] as const
const tab = ref<'placings' | 'points'>('placings')
const pickingReverse = ref(false)
watch(tab, () => (pickingReverse.value = false))
watch(
  () => props.danceId,
  () => {
    tab.value = 'placings'
    pickingReverse.value = false
    fixing.value = null
  },
)

const groupDancers = computed(() => m.groupDancers(props.groupId))
// Dances and Overall place only the dancers called back. With none entered
// (older competitions, or "No callbacks"), everyone in the age group.
const callbacksRaw = computed(() => m.results.value[props.groupId]?.[CALLBACKS])
const calledBackIds = computed(() => new Set(parsePlacings(callbacksRaw.value).entries.map((e) => e.id)))
const noCallbacks = computed(() => !calledBackIds.value.size)
const calledBack = computed(() => (noCallbacks.value ? groupDancers.value : groupDancers.value.filter((d) => calledBackIds.value.has(d.id))))
const candidates = computed(() => (isCallbacks.value || tab.value === 'points' ? groupDancers.value : calledBack.value))

const placedIndex = computed(() => new Map(placings.value.entries.map((e, i) => [e.id, i])))
const pointsPath = computed(() => `points/${props.groupId}/${props.danceId}/combined`)
const pointedIds = computed(() => m.points.value[props.groupId]?.[props.danceId]?.combined ?? [])
const pointed = computed(() => new Set(pointedIds.value))
// Primary has no championship points, as it has no overall. Any stored
// anyway (by an older app) still show, so they can be taken away.
const offersPoints = computed(() => !isPrimaryCategory(group.value?.category?.name) || pointedIds.value.length > 0)

const who = (id: string) => (isPlaceholderId(id) ? '?' : (m.dancersById.value.get(id)?.num ?? '?'))

async function save(value: Placings | false | null, label: string) {
  const stored = value === false || value === null ? value : serializePlacings(value)
  try {
    await m.writeData({ [path.value]: stored }, `${label} in ${danceName.value}`)
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  }
}

/** Tap a dancer: add them to the end, or take them out if already there. */
function place(id: string) {
  if (!canEdit.value) return
  tapHaptic()
  const p = parsePlacings(rawNow())
  const i = p.entries.findIndex((e) => e.id === id)
  if (i >= 0) void save(removeEntry(p, i), `Took out ${who(id)}`)
  else void save({ ...p, entries: [...p.entries, { id, tie: false }] }, `Placed ${who(id)}`)
}
function remove(index: number) {
  const p = parsePlacings(rawNow())
  const id = p.entries[index]?.id
  if (id == null) return
  void save(removeEntry(p, index), `Took out ${who(id)}`)
}
function tie(index: number, on: boolean) {
  const p = parsePlacings(rawNow())
  if (!p.entries[index]) return
  p.entries[index].tie = on
  void save(p, `${on ? 'Tied' : 'Untied'} ${who(p.entries[index].id)}`)
}
function reorder(entries: Entry[]) {
  void save({ ...parsePlacings(rawNow()), entries }, 'Reordered')
}

function point(id: string) {
  if (!canEdit.value) return
  tapHaptic()
  const list = [...pointedIds.value]
  const i = list.indexOf(id)
  if (i >= 0) list.splice(i, 1)
  else list.push(id)
  void m
    .writeData({ [pointsPath.value]: list.length ? list : null }, `${i >= 0 ? 'Took a point from' : 'Gave a point to'} ${who(id)} in ${danceName.value}`)
    .catch((e) => toast(friendlyError(e), { tone: 'error' }))
}

function tapPlaceholder() {
  const id = newPlaceholderId()
  if (tab.value === 'points') point(id)
  else place(id)
}

// --- Championship: entered from the lowest place up to 1st. Switching it on
// first asks how many places; it reads on once that's saved.
const PLACES = [3, 4, 5, 6, 7, 8]
const championship = computed(() => !!placings.value.reverseFrom)
function toggleChampionship() {
  if (!championship.value) {
    pickingReverse.value = !pickingReverse.value
    return
  }
  pickingReverse.value = false
  void save({ ...parsePlacings(rawNow()), reverseFrom: null }, 'Championship off')
}
function pickReverse(n: number) {
  selectionHaptic()
  pickingReverse.value = false
  void save({ ...parsePlacings(rawNow()), reverseFrom: n }, `Entering from ${n}${getOrdinalSuffix(n)}`)
}

// --- Nobody placed / no callbacks
function setNone(on: boolean) {
  void save(on ? false : null, on ? (isCallbacks.value ? 'No callbacks' : 'No dancers placed') : 'Cleared “none”')
}

// --- Choosing who a "?" was (optional: the "?" can also just be taken out)
const fixing = ref<string | null>(null)
const fixQuery = ref('')
const fixChoices = computed(() => {
  const q = fixQuery.value.trim().toLowerCase()
  // Not someone already placed, or given a point (they can't be both).
  return candidates.value.filter((d) => !placedIndex.value.has(d.id) && !pointed.value.has(d.id) && (!q || d.num.startsWith(q) || d.label.toLowerCase().includes(q)))
})
function openFix(index: number) {
  fixQuery.value = ''
  fixing.value = placings.value.entries[index]?.id ?? null
}
function chooseFix(dancerId: string) {
  const id = fixing.value
  fixing.value = null
  // By id, not position: the list may have changed on another device since.
  const p = parsePlacings(rawNow())
  const entry = p.entries.find((e) => e.id === id)
  if (!entry) return
  entry.id = dancerId
  void save(p, `Replaced ? with ${who(dancerId)}`)
}

const rowDimmed = (id: string) => placedIndex.value.has(id) || pointed.value.has(id)
const rowDisabled = (id: string) => !canEdit.value || (tab.value === 'placings' ? pointed.value.has(id) : placedIndex.value.has(id))
const singleOverall = computed(() => isOverall.value && placings.value.entries.length === 1)

// What to do here, in a sentence.
const instruction = computed(() => {
  if (tab.value === 'points') return 'Tap each dancer who got a championship point. Tap again to take it away.'
  if (isCallbacks.value) return 'Tap each dancer called back. Tap again to take them out.'
  const from = placings.value.reverseFrom
  return from
    ? `Tap dancers from ${from}${getOrdinalSuffix(from)} place up to 1st, in the order they’re announced.`
    : 'Tap dancers in the order they placed, starting with 1st. Tap again to take one out.'
})

// Where to carry straight on: this age group's next dance, then the next
// age group in the running order (or list order with no schedule).
const turns = computed(() => scheduleTurns(m.schedule.value, m.platforms.value))
const next = computed(() => {
  const g = group.value
  if (!g) return null
  const rows = resultRows(g, m.groupDances(g.id))
  const i = rows.findIndex((d) => d.id === props.danceId)
  if (i < 0) return null
  if (rows[i + 1]) return { groupId: g.id, danceId: rows[i + 1].id, label: rows[i + 1].label }
  const ids = resultsOrder(
    m.groups.value.filter((x) => x.id === g.id || m.groupDancers(x.id).length).map((x) => x.id),
    turns.value,
  )
  const after = m.groupsById.value.get(ids[ids.indexOf(g.id) + 1] ?? '')
  return after ? { groupId: after.id, danceId: CALLBACKS, label: `${after.label} · Callbacks` } : null
})
</script>

<template>
  <div v-if="group" class="flex flex-col md:h-full">
    <header class="flex items-end gap-3 px-4 pt-4 pb-3">
      <div class="min-w-0 flex-1">
        <p class="text-muted-foreground truncate text-sm font-bold">{{ group.label }}</p>
        <h1 class="text-title truncate">{{ danceName }}</h1>
      </div>
    </header>

    <!-- Placings / Points -->
    <div v-if="!isCallbacks && offersPoints" class="flex items-center gap-2 border-b px-4 pb-3">
      <Segmented v-model="tab" :options="TABS" label="Placings or points" class="max-w-sm flex-1" />
      <HelpTip label="About championship points">
        Championship points mark dancers who were placed by at least one judge, but whose combined score didn’t give them a place.
      </HelpTip>
    </div>

    <div class="md:grid md:min-h-0 md:flex-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
      <!-- Dancers to tap -->
      <section class="flex min-w-0 flex-col md:min-h-0 md:border-r">
        <div class="md:min-h-0 md:flex-1 md:overflow-y-auto">
          <!-- No signal: nothing here can be saved, so say so over the list
               rather than let taps quietly do nothing. -->
          <div class="sticky top-(--chrome-top) z-10 md:top-0" role="status">
            <p v-if="!canEdit" class="bg-foreground text-background mx-3 mt-3 flex items-center gap-3 rounded-2xl px-4 py-3 shadow-(--shadow-raised)">
              <CloudOff class="size-5 shrink-0" aria-hidden="true" />
              <span><strong class="font-semibold">No signal.</strong> Results can’t be saved until it’s back.</span>
            </p>
          </div>
          <div
            v-if="candidates.length"
            :aria-disabled="!canEdit || undefined"
            :class="['transition-[opacity,filter] duration-(--dur-base) ease-standard', !canEdit && 'opacity-50 grayscale']"
          >
            <p class="text-muted-foreground px-4 pt-3 pb-2 text-sm font-semibold">{{ instruction }}</p>
            <p v-if="noCallbacks && !isCallbacks && tab === 'placings'" class="text-muted-foreground px-4 pb-2 text-sm">
              {{ callbacksRaw === false ? 'No callbacks' : 'No callbacks entered' }}: showing everyone.
              <RouterLink
                v-if="callbacksRaw !== false"
                :to="{ name: 'manage.results', params: { competitionId: m.competitionId.value, groupId, danceId: CALLBACKS } }"
                replace
                class="text-primary font-semibold whitespace-nowrap"
              >
                Enter callbacks ›
              </RouterLink>
            </p>
            <p v-if="placings.reverseFrom && tab === 'placings'" class="bg-blue-paper text-primary px-4 py-2.5 text-sm font-bold">
              Entering from {{ placings.reverseFrom }}{{ getOrdinalSuffix(placings.reverseFrom) }} place
            </p>
            <ul class="divide-y">
              <li v-for="d in candidates" :key="d.id">
                <button
                  type="button"
                  :disabled="rowDisabled(d.id)"
                  :aria-pressed="tab === 'placings' ? placedIndex.has(d.id) : pointed.has(d.id)"
                  :class="['hover:bg-accent active:bg-accent flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left transition-opacity', rowDimmed(d.id) && 'opacity-35']"
                  @click="tab === 'placings' ? place(d.id) : point(d.id)"
                >
                  <span class="bg-paper text-paper-ink min-w-12 shrink-0 rounded-md border px-1.5 py-1 text-center font-mono text-base font-semibold tabular-nums">{{ d.num || '–' }}</span>
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-base font-semibold">{{ d.label }}</span>
                    <span v-if="d.location" class="text-muted-foreground block truncate text-sm">{{ d.location }}</span>
                  </span>
                  <Diamond v-if="pointed.has(d.id)" class="text-primary size-5 shrink-0 fill-current" />
                  <Diamond v-else-if="tab === 'points' && !placedIndex.has(d.id)" class="text-muted-foreground size-5 shrink-0" />
                </button>
              </li>
              <li>
                <button
                  type="button"
                  :disabled="!canEdit"
                  class="hover:bg-accent flex min-h-16 w-full items-center gap-3 bg-[repeating-linear-gradient(135deg,transparent_0_10px,color-mix(in_oklab,var(--color-next)_60%,transparent)_10px_20px)] px-4 py-2 text-left disabled:opacity-50"
                  @click="tapPlaceholder"
                >
                  <span class="bg-next text-next-foreground min-w-12 shrink-0 rounded-md px-1.5 py-1 text-center font-mono text-base font-semibold">?</span>
                  <span class="min-w-0 flex-1">
                    <span class="block text-base font-semibold">Dancer</span>
                    <span class="text-muted-foreground block text-sm">A stand-in for a number that was missed, misheard or wrong. Fix it later.</span>
                  </span>
                </button>
              </li>
            </ul>
          </div>

          <EmptyState v-else :icon="Search" title="No dancers found" description="Add dancers to this age group first.">
            <RouterLink :to="{ name: 'manage.dancers', params: { competitionId: m.competitionId.value } }" class="text-primary text-base font-semibold">Add dancers ›</RouterLink>
          </EmptyState>
        </div>

        <!-- Championship (dances only) -->
        <div v-if="isDance && tab === 'placings'" class="border-t px-4 py-2">
          <div class="flex min-h-12 flex-wrap items-center gap-x-2">
            <label class="flex min-h-11 items-center gap-3 font-medium">
              <Switch :model-value="championship" :disabled="!canEdit" @update:model-value="toggleChampionship" />
              Championship
            </label>
            <HelpTip label="About championship mode">
              <strong>Championship</strong> mode enters results in reverse order (e.g. 6th, 5th, …, 1st), as is traditional for championship announcements.
            </HelpTip>
            <Button
              v-if="placings.reverseFrom"
              variant="tonal"
              class="ml-auto"
              :aria-expanded="pickingReverse"
              :disabled="!canEdit"
              @click="pickingReverse = !pickingReverse"
            >
              From {{ placings.reverseFrom }}{{ getOrdinalSuffix(placings.reverseFrom) }}
            </Button>
          </div>
          <Transition
            enter-from-class="-translate-y-1 opacity-0"
            enter-active-class="transition duration-(--dur-base) ease-standard motion-reduce:transition-none"
            leave-active-class="transition duration-(--dur-quick) ease-exit motion-reduce:transition-none"
            leave-to-class="opacity-0"
          >
            <div v-if="pickingReverse" class="pt-1 pb-2">
              <p :id="`${uid}-places`" class="text-muted-foreground pb-2 text-sm">How many places?</p>
              <div role="group" :aria-labelledby="`${uid}-places`" class="grid max-w-80 grid-cols-6 gap-1.5">
                <button
                  v-for="n in PLACES"
                  :key="n"
                  type="button"
                  :aria-pressed="n === placings.reverseFrom"
                  :disabled="!canEdit || n > candidates.length"
                  :class="[
                    'press h-11 rounded-full text-base font-extrabold tabular-nums disabled:opacity-(--disabled-opacity)',
                    n === placings.reverseFrom ? 'bg-primary-fill text-primary-foreground' : 'surface',
                  ]"
                  @click="pickReverse(n)"
                >
                  {{ n }}
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </section>

      <!-- The placed order -->
      <section class="min-w-0 max-md:border-t-8 max-md:border-muted md:overflow-y-auto">
        <template v-if="tab === 'placings'">
          <h2 class="text-muted-foreground flex items-center gap-1.5 px-4 pt-3 pb-2 text-sm font-bold">
            {{ isCallbacks ? `Called back · ${placings.entries.length}` : 'Placed' }}
            <HelpTip v-if="!isCallbacks" label="How the placed list works">
              Drag the handle to change the order. Switch on TIE when a dancer shares the place of the dancer above. Tap a dancer to take them out.
            </HelpTip>
          </h2>
          <PlacedList
            v-if="placings.entries.length"
            :placings="placings"
            :dancers-by-id="m.dancersById.value"
            :kind="kind"
            @remove="remove"
            @tie="tie"
            @reorder="reorder"
            @fix="openFix"
          />
          <template v-else>
            <EmptyState
              :icon="ListOrdered"
              :title="isCallbacks ? 'Callbacks' : 'Order dancers'"
              :description="
                isCallbacks
                  ? 'Select the dancers called back'
                  : placings.reverseFrom
                    ? `Select dancers from ${placings.reverseFrom}${getOrdinalSuffix(placings.reverseFrom)} place`
                    : 'Select dancers in the order placed'
              "
            />
            <div class="flex min-h-14 items-center border-t px-4">
              <button
                type="button"
                role="switch"
                :aria-checked="markedNone"
                :disabled="!canEdit"
                class="flex h-11 items-center gap-3 text-base font-bold disabled:opacity-50"
                @click="setNone(!markedNone)"
              >
                <span :class="['relative h-7 w-12 shrink-0 rounded-full transition-colors after:absolute after:top-0.5 after:left-0.5 after:size-6 after:rounded-full after:bg-white after:shadow after:transition-transform', markedNone ? 'bg-primary-fill after:translate-x-5' : 'bg-strong']" />
                {{ isCallbacks ? 'No callbacks' : 'No dancers placed' }}
              </button>
            </div>
          </template>
          <p v-if="singleOverall" class="text-muted-foreground flex items-center gap-1.5 px-4 py-3 text-sm"><Trophy class="size-4" /> Overall winner</p>
        </template>

        <template v-else>
          <h2 class="text-muted-foreground px-4 pt-3 pb-2 text-sm font-bold">Championship points</h2>
          <ul v-if="pointedIds.length" class="divide-y">
            <li v-for="id in pointedIds" :key="id">
              <button
                type="button"
                :disabled="!canEdit"
                :aria-label="`Take the point from ${who(id)}`"
                class="hover:bg-accent flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left"
                @click="point(id)"
              >
                <span class="bg-paper text-paper-ink min-w-12 shrink-0 rounded-md border px-1.5 py-1 text-center font-mono text-base font-semibold tabular-nums">{{ who(id) }}</span>
                <span class="min-w-0 flex-1 truncate text-base font-semibold">{{ m.dancersById.value.get(id)?.label ?? 'Unknown dancer' }}</span>
                <Diamond class="text-primary size-5 shrink-0 fill-current" />
              </button>
            </li>
          </ul>
          <EmptyState v-else :icon="Diamond" title="Championship points" description="Select dancers who didn’t quite place" />
        </template>

        <!-- Carry on to the next dance without going back to the list -->
        <div v-if="next && (placings.entries.length || markedNone)" class="border-t p-4">
          <RouterLink
            :to="{ name: 'manage.results', params: { competitionId: m.competitionId.value, groupId: next.groupId, danceId: next.danceId } }"
            replace
            class="bg-primary-fill text-primary-foreground flex h-12 items-center justify-center gap-1.5 rounded-xl px-4 text-base font-bold"
          >
            Next: {{ next.label }} <ChevronRight class="size-5" />
          </RouterLink>
        </div>
      </section>
    </div>
  </div>

  <!-- Choose who a "?" was -->
  <Dialog :open="fixing != null" variant="sheet" size="md" @close="fixing = null">
    <template #header>
      <h2 class="text-title">Who was it?</h2>
      <p class="text-muted-foreground text-sm">Replaces the “?” in the same place.</p>
    </template>
    <div class="space-y-2 p-4">
      <label class="bg-card border-strong focus-within:border-primary flex h-11 items-center gap-2 rounded-xl border-2 px-3">
        <Search class="text-muted-foreground size-4 shrink-0" />
        <span class="sr-only">Find a dancer</span>
        <input v-model="fixQuery" type="search" placeholder="Find by number or name" class="min-w-0 flex-1 bg-transparent text-base outline-none" />
        <button v-if="fixQuery" type="button" aria-label="Clear search" class="text-muted-foreground -mr-1 flex size-7 items-center justify-center rounded-full" @click="fixQuery = ''">
          <X class="size-4" />
        </button>
      </label>
    </div>
    <ul class="divide-y pb-[var(--safe-bottom)]">
      <li v-for="d in fixChoices" :key="d.id">
        <button type="button" class="hover:bg-accent flex min-h-14 w-full items-center gap-3 px-4 text-left" @click="chooseFix(d.id)">
          <span class="bg-paper text-paper-ink min-w-12 rounded-md border px-1.5 py-1 text-center font-mono font-semibold">{{ d.num || '–' }}</span>
          <span class="min-w-0 flex-1 truncate text-base font-semibold">{{ d.label }}</span>
        </button>
      </li>
      <li v-if="!fixChoices.length" class="text-muted-foreground px-4 py-6 text-center">Everyone is already placed.</li>
    </ul>
  </Dialog>
</template>
