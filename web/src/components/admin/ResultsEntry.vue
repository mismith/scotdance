<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { Diamond, ListOrdered, Pencil, Search, Trophy } from '@lucide/vue'
import Dialog from '@/components/Dialog.vue'
import EmptyState from '@/components/EmptyState.vue'
import HelpTip from '@/components/admin/HelpTip.vue'
import PlacedList from '@/components/admin/PlacedList.vue'
import { useManagedCompetition, compareNumbers } from '@/composables/admin/useManagedCompetition'
import { toast } from '@/lib/admin/feedback'
import { canEdit, friendlyError } from '@/lib/admin/write'
import { tapHaptic } from '@/lib/haptics'
import { getOrdinalSuffix } from '@/lib/results'
import {
  CALLBACKS,
  OVERALL,
  isPlaceholderId,
  newPlaceholderId,
  parsePlacings,
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

const tab = ref<'placings' | 'points'>('placings')
const pickingReverse = ref(false)
watch(
  () => props.danceId,
  () => {
    tab.value = 'placings'
    pickingReverse.value = false
  },
)

const groupDancers = computed(() => m.groupDancers(props.groupId))
// Dances and Overall place only the dancers called back.
const calledBack = computed(() => {
  const ids = new Set(parsePlacings(m.results.value[props.groupId]?.[CALLBACKS]).entries.map((e) => e.id))
  return groupDancers.value.filter((d) => ids.has(d.id)).sort((a, b) => compareNumbers(a.num, b.num))
})
const candidates = computed(() => (isCallbacks.value || tab.value === 'points' ? groupDancers.value : calledBack.value))

const placedIndex = computed(() => new Map(placings.value.entries.map((e, i) => [e.id, i])))
const pointsPath = computed(() => `points/${props.groupId}/${props.danceId}/combined`)
const pointedIds = computed(() => m.points.value[props.groupId]?.[props.danceId]?.combined ?? [])
const pointed = computed(() => new Set(pointedIds.value))

const who = (id: string) => (isPlaceholderId(id) ? '?' : (m.dancersById.value.get(id)?.num ?? '?'))

async function save(value: Placings | false | null, label: string) {
  const stored = value === false || value === null ? value : serializePlacings(value)
  try {
    await m.writeData({ [path.value]: stored }, `${label} in ${danceName.value}`)
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  }
}

function without(p: Placings, index: number): Placings {
  const entries = p.entries.map((e) => ({ ...e }))
  const [removed] = entries.splice(index, 1)
  // If the first of a tie leaves, the next dancer starts it.
  if (removed && !removed.tie && entries[index]?.tie) entries[index].tie = false
  return { ...p, entries }
}

/** Tap a dancer: add them to the end, or take them out if already there. */
function place(id: string) {
  if (!canEdit.value) return
  tapHaptic()
  const p = parsePlacings(rawNow())
  const i = p.entries.findIndex((e) => e.id === id)
  if (i >= 0) void save(without(p, i), `Took out ${who(id)}`)
  else void save({ ...p, entries: [...p.entries, { id, tie: false }] }, `Placed ${who(id)}`)
}
function remove(index: number) {
  const p = parsePlacings(rawNow())
  const id = p.entries[index]?.id
  if (id == null) return
  void save(without(p, index), `Took out ${who(id)}`)
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

// --- Championship: entered from the lowest place up to 1st
const reverseOn = computed(() => !!placings.value.reverseFrom || pickingReverse.value)
function toggleReverse() {
  if (reverseOn.value) {
    pickingReverse.value = false
    if (placings.value.reverseFrom) void save({ ...parsePlacings(rawNow()), reverseFrom: null }, 'Championship off')
  } else {
    pickingReverse.value = true
  }
}
function pickReverse(n: number) {
  pickingReverse.value = false
  void save({ ...parsePlacings(rawNow()), reverseFrom: n }, `Entering from ${n}${getOrdinalSuffix(n)}`)
}

// --- Nobody placed / no callbacks
function setNone(on: boolean) {
  void save(on ? false : null, on ? (isCallbacks.value ? 'No callbacks' : 'No dancers placed') : 'Cleared “none”')
}

// --- Choosing who a "?" was (optional: the "?" can also just be taken out)
const fixing = ref<number | null>(null)
const fixQuery = ref('')
const fixChoices = computed(() => {
  const q = fixQuery.value.trim().toLowerCase()
  return candidates.value.filter((d) => !placedIndex.value.has(d.id) && (!q || d.num.startsWith(q) || d.label.toLowerCase().includes(q)))
})
function openFix(index: number) {
  fixQuery.value = ''
  fixing.value = index
}
function chooseFix(dancerId: string) {
  const index = fixing.value
  fixing.value = null
  if (index == null) return
  const p = parsePlacings(rawNow())
  if (!p.entries[index]) return
  p.entries[index].id = dancerId
  void save(p, `Replaced ? with ${who(dancerId)}`)
}

const rowDimmed = (id: string) => placedIndex.value.has(id) || pointed.value.has(id)
const rowDisabled = (id: string) => !canEdit.value || (tab.value === 'placings' ? pointed.value.has(id) : placedIndex.value.has(id))
const singleOverall = computed(() => isOverall.value && placings.value.entries.length === 1)
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
    <div v-if="!isCallbacks" class="flex border-b" role="tablist">
      <button
        v-for="t in (['placings', 'points'] as const)"
        :key="t"
        type="button"
        role="tab"
        :aria-selected="tab === t"
        :class="[
          'flex h-12 flex-1 items-center justify-center gap-2 border-b-2 text-[0.9375rem] font-bold',
          tab === t ? 'border-primary text-primary' : 'text-muted-foreground border-transparent',
        ]"
        @click="tab = t; pickingReverse = false"
      >
        {{ t === 'placings' ? 'Placings' : 'Points' }}
        <HelpTip v-if="t === 'points'" label="About championship points">
          Championship points mark dancers who were placed by at least one judge, but whose combined score didn’t give them a place.
        </HelpTip>
      </button>
    </div>

    <div class="md:grid md:min-h-0 md:flex-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
      <!-- Dancers to tap -->
      <section class="flex min-w-0 flex-col md:min-h-0 md:border-r">
        <div class="md:min-h-0 md:flex-1 md:overflow-y-auto">
          <!-- Championship: how many places -->
          <template v-if="pickingReverse">
            <div class="flex items-center gap-3 border-b px-4 py-3">
              <span class="bg-primary text-primary-foreground flex size-10 shrink-0 items-center justify-center rounded-full"><ListOrdered class="size-5" /></span>
              <span>
                <span class="block text-base font-bold">Select starting place</span>
                <span class="text-muted-foreground block text-sm">How many places are being awarded?</span>
              </span>
            </div>
            <ul class="divide-y">
              <li v-for="n in candidates.length" :key="n">
                <button
                  type="button"
                  :disabled="n < 2"
                  :class="[
                    'flex min-h-13 w-full items-center gap-3 px-4 text-left disabled:opacity-35',
                    n === placings.reverseFrom ? 'bg-blue-paper' : 'hover:bg-accent',
                  ]"
                  @click="pickReverse(n)"
                >
                  <span class="w-12 text-base font-extrabold tabular-nums">{{ n }}{{ getOrdinalSuffix(n) }}</span>
                  <span class="text-base">{{ n }} {{ n === 1 ? 'place' : 'places' }}</span>
                </button>
              </li>
            </ul>
          </template>

          <template v-else-if="candidates.length">
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
          </template>

          <EmptyState v-else-if="isCallbacks || tab === 'points'" :icon="Search" title="No dancers found" description="Add dancers to this age group first.">
            <RouterLink :to="{ name: 'manage.dancers', params: { competitionId: m.competitionId.value } }" class="text-primary text-base font-bold">Add dancers ›</RouterLink>
          </EmptyState>
          <EmptyState v-else :icon="Search" title="No dancers to place" description="Enter the callbacks first: only dancers called back are placed.">
            <RouterLink
              :to="{ name: 'manage.results', params: { competitionId: m.competitionId.value, groupId, danceId: CALLBACKS } }"
              replace
              class="text-primary text-base font-bold"
            >
              Enter callbacks ›
            </RouterLink>
          </EmptyState>
        </div>

        <!-- Championship (dances only) -->
        <div v-if="isDance && tab === 'placings'" class="flex min-h-14 items-center gap-2 border-t px-4 py-2">
          <button
            type="button"
            role="switch"
            :aria-checked="reverseOn"
            :disabled="!canEdit"
            class="flex h-11 items-center gap-3 text-base font-bold disabled:opacity-50"
            @click="toggleReverse"
          >
            <span :class="['relative h-7 w-12 shrink-0 rounded-full transition-colors after:absolute after:top-0.5 after:left-0.5 after:size-6 after:rounded-full after:bg-white after:shadow after:transition-transform', reverseOn ? 'bg-primary after:translate-x-5' : 'bg-strong']" />
            Championship
          </button>
          <HelpTip label="About championship mode">
            <strong>Championship</strong> mode enters results in reverse order (e.g. 6th, 5th, …, 1st), as is traditional for championship announcements.
          </HelpTip>
          <button
            v-if="placings.reverseFrom && !pickingReverse"
            type="button"
            aria-label="Change the starting place"
            class="hover:bg-accent ml-auto flex size-11 items-center justify-center rounded-full"
            @click="pickingReverse = true"
          >
            <Pencil class="size-4" />
          </button>
        </div>
      </section>

      <!-- The placed order -->
      <section class="min-w-0 max-md:border-t-8 max-md:border-muted md:overflow-y-auto">
        <template v-if="tab === 'placings'">
          <h2 class="text-muted-foreground px-4 pt-4 pb-1 text-sm font-bold md:sr-only">{{ isCallbacks ? 'Called back' : 'Placed' }}</h2>
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
                <span :class="['relative h-7 w-12 shrink-0 rounded-full transition-colors after:absolute after:top-0.5 after:left-0.5 after:size-6 after:rounded-full after:bg-white after:shadow after:transition-transform', markedNone ? 'bg-primary after:translate-x-5' : 'bg-strong']" />
                {{ isCallbacks ? 'No callbacks' : 'No dancers placed' }}
              </button>
            </div>
          </template>
          <p v-if="singleOverall" class="text-muted-foreground flex items-center gap-1.5 px-4 py-3 text-sm"><Trophy class="size-4" /> Overall winner</p>
        </template>

        <template v-else>
          <h2 class="text-muted-foreground px-4 pt-4 pb-1 text-sm font-bold md:sr-only">Championship points</h2>
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
