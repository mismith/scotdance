<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { Check, ChevronLeft, CircleDashed, Diamond, Ellipsis, ListOrdered, Search, X } from '@lucide/vue'
import Dialog from '@/components/Dialog.vue'
import Medal from '@/components/Medal.vue'
import PlacedList from '@/components/admin/PlacedList.vue'
import { useManagedCompetition } from '@/composables/admin/useManagedCompetition'
import { useSplit } from '@/composables/admin/useWide'
import { confirm, toast } from '@/lib/admin/feedback'
import { canEdit, friendlyError } from '@/lib/admin/write'
import { tapHaptic } from '@/lib/haptics'
import { getOrdinalSuffix } from '@/lib/results'
import {
  CALLBACKS,
  OVERALL,
  danceState,
  isPlaceholderId,
  isTied,
  newPlaceholderId,
  parsePlacings,
  placeAt,
  serializePlacings,
  type Entry,
  type Placings,
} from '@/lib/admin/results'

// Entering one age group's results: pick the dance, then tap dancers in
// the order they placed. Tapping again takes them out. Can't find someone?
// Add a "?" and choose the right dancer later.

const props = defineProps<{ groupId: string; danceId: string }>()

const m = useManagedCompetition()
const router = useRouter()
const split = useSplit()

const group = computed(() => m.groupsById.value.get(props.groupId) ?? null)
const hasOverall = computed(() => !!group.value?.category?.name && !group.value.category.name.trim().toLowerCase().startsWith('primary'))

const tabs = computed(() => [
  { id: CALLBACKS, label: 'Callbacks' },
  ...m.groupDances(props.groupId).map((d) => ({ id: d.id, label: d.label })),
  ...(hasOverall.value ? [{ id: OVERALL, label: 'Overall' }] : []),
])
const tab = computed(() => tabs.value.find((t) => t.id === props.danceId) ?? tabs.value[0])
const isCallbacks = computed(() => tab.value.id === CALLBACKS)
const isDance = computed(() => tab.value.id !== CALLBACKS && tab.value.id !== OVERALL)

const stateOf = (danceId: string) => danceState(m.results.value[props.groupId]?.[danceId])

// Always read the latest stored value: another device may have changed it.
const rawNow = () => m.results.value[props.groupId]?.[tab.value.id]
const placings = computed<Placings>(() => parsePlacings(rawNow()))
const markedNone = computed(() => rawNow() === false)

const mode = ref<'placings' | 'points'>('placings')
watch(() => props.danceId, () => (mode.value = 'placings'))

const groupDancers = computed(() => m.groupDancers(props.groupId))
const callbackIds = computed(() => parsePlacings(m.results.value[props.groupId]?.[CALLBACKS]).entries.map((e) => e.id))
const usingCallbacks = computed(() => !isCallbacks.value && mode.value === 'placings' && callbackIds.value.length > 0)
const candidates = computed(() =>
  usingCallbacks.value ? groupDancers.value.filter((d) => callbackIds.value.includes(d.id)) : groupDancers.value,
)

const query = ref('')
watch(() => [props.groupId, props.danceId], () => (query.value = ''))
const shownCandidates = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return candidates.value
  return candidates.value.filter((d) => d.num.startsWith(q) || d.label.toLowerCase().includes(q))
})

const placedIndex = computed(() => new Map(placings.value.entries.map((e, i) => [e.id, i])))
const pointsPath = computed(() => `points/${props.groupId}/${tab.value.id}/combined`)
const pointed = computed(() => new Set(Object.values(m.points.value[props.groupId]?.[tab.value.id] ?? {}).flat()))
const combinedPoints = () => [...(m.points.value[props.groupId]?.[tab.value.id]?.combined ?? [])]

async function save(value: Placings | false | null) {
  const stored = value === false || value === null ? value : serializePlacings(value)
  try {
    await m.writeData({ [`results/${props.groupId}/${tab.value.id}`]: stored })
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  }
}

function withoutIndex(p: Placings, index: number): Placings {
  const entries = p.entries.map((e) => ({ ...e }))
  const [removed] = entries.splice(index, 1)
  // If the leader of a tie leaves, the next dancer leads it.
  if (removed && !removed.tie && entries[index]?.tie) entries[index].tie = false
  return { ...p, entries }
}

function tapDancer(id: string) {
  if (!canEdit.value) return
  tapHaptic()
  if (mode.value === 'points') return togglePoint(id)
  const p = parsePlacings(rawNow())
  const i = p.entries.findIndex((e) => e.id === id)
  void save(i >= 0 ? withoutIndex(p, i) : { ...p, entries: [...p.entries, { id, tie: false }] })
}

function addPlaceholder() {
  if (!canEdit.value) return
  tapHaptic()
  if (mode.value === 'points') {
    void m.writeData({ [pointsPath.value]: [...combinedPoints(), newPlaceholderId()] }).catch((e) => toast(friendlyError(e), { tone: 'error' }))
    return
  }
  const p = parsePlacings(rawNow())
  void save({ ...p, entries: [...p.entries, { id: newPlaceholderId(), tie: false }] })
}

function togglePoint(id: string) {
  if (placedIndex.value.has(id)) return
  const list = combinedPoints()
  const i = list.indexOf(id)
  if (i >= 0) list.splice(i, 1)
  else list.push(id)
  void m.writeData({ [pointsPath.value]: list.length ? list : null }).catch((e) => toast(friendlyError(e), { tone: 'error' }))
}

function onReorder(entries: Entry[]) {
  const p = parsePlacings(rawNow())
  const fixed = entries.map((e, i) => ({ ...e, tie: i === 0 ? false : e.tie }))
  void save({ ...p, entries: fixed })
}
function onTie(index: number, tie: boolean) {
  const p = parsePlacings(rawNow())
  if (!p.entries[index]) return
  p.entries[index].tie = tie
  void save(p)
}
function onRemove(index: number) {
  void save(withoutIndex(parsePlacings(rawNow()), index))
}

// --- Choosing the dancer a "?" stood in for
const fixing = ref<number | null>(null)
const fixQuery = ref('')
const fixChoices = computed(() => {
  const q = fixQuery.value.trim().toLowerCase()
  const placed = placedIndex.value
  return groupDancers.value.filter((d) => !placed.has(d.id) && (!q || d.num.startsWith(q) || d.label.toLowerCase().includes(q)))
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
  void save(p)
}

// --- Championship order (entered from the lowest place up)
const reverseOpen = ref(false)
const reverseChoices = computed(() => Array.from({ length: Math.max(0, candidates.value.length - 1) }, (_, i) => i + 2))
function setReverse(n: number | null) {
  reverseOpen.value = false
  const p = parsePlacings(rawNow())
  void save({ ...p, reverseFrom: n })
}

// --- None placed / clear
async function markNone() {
  await save(false)
  toast(isCallbacks.value ? 'Marked as no callbacks' : 'Marked as no placings', { action: { label: 'Undo', run: () => save(null) } })
}
async function clearAll() {
  const before = rawNow()
  const ok = await confirm({
    title: `Clear ${isCallbacks.value ? 'callbacks' : 'placings'} for ${tab.value.label}?`,
    message: 'You can undo this straight after.',
    confirmLabel: 'Clear',
    destructive: true,
  })
  if (!ok) return
  await save(null)
  toast('Cleared', { action: { label: 'Undo', run: () => m.writeData({ [`results/${props.groupId}/${tab.value.id}`]: before ?? null }) } })
}

const menuOpen = ref(false)
const orderOpen = ref(false)

function goTab(id: string) {
  const to = { name: 'manage.results', params: { competitionId: m.competitionId.value, groupId: props.groupId, danceId: id } }
  void router.replace(to)
}

// Keep the chosen dance's tab in view (it can be off the edge on phones).
const tabStrip = ref<HTMLElement | null>(null)
watch(
  () => props.danceId,
  async () => {
    await nextTick()
    tabStrip.value?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'instant' })
  },
  { immediate: true },
)

const instruction = computed(() => {
  if (mode.value === 'points') return 'Tap dancers who got a championship point but weren’t placed.'
  if (isCallbacks.value) return 'Tap each dancer called back.'
  const from = placings.value.reverseFrom
  if (from) return `Tap dancers from ${from}${getOrdinalSuffix(from)} place up to 1st.`
  return 'Tap dancers in the order they placed, starting with 1st.'
})
</script>

<template>
  <div v-if="group" class="flex flex-col md:h-full">
    <!-- Group (scrolls away on phones) -->
    <RouterLink
      v-if="split"
      :to="{ name: 'manage.results', params: { competitionId: m.competitionId.value } }"
      replace
      class="text-primary hover:bg-accent mx-2 mt-2 inline-flex h-9 items-center gap-1 self-start rounded-full px-2 text-sm font-bold 2xl:hidden"
    >
      <ChevronLeft class="size-4" /> All age groups
    </RouterLink>
    <div class="flex items-center gap-2 px-4 pt-3">
      <div class="min-w-0 flex-1">
        <p class="text-muted-foreground truncate text-sm font-bold">{{ group.category?.label ?? 'No category' }} · {{ groupDancers.length }} dancers</p>
        <h1 class="text-title truncate">{{ group.name || group.label }}</h1>
      </div>
      <button
        type="button"
        aria-label="More options"
        class="hover:bg-accent flex size-11 shrink-0 items-center justify-center rounded-full"
        @click="menuOpen = true"
      >
        <Ellipsis class="size-5" />
      </button>
    </div>
    <!-- Dance, mode and the placed order stay in view -->
    <div class="bg-background sticky top-(--chrome-top) z-10 border-b md:static">
      <div ref="tabStrip" class="flex gap-1.5 overflow-x-auto px-4 py-3 [scrollbar-width:none]" role="tablist">
        <button
          v-for="t in tabs"
          :key="t.id"
          type="button"
          role="tab"
          :aria-selected="t.id === tab.id"
          :class="[
            'flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[0.9375rem] font-bold whitespace-nowrap',
            t.id === tab.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-card hover:bg-accent',
          ]"
          @click="goTab(t.id)"
        >
          <Check v-if="stateOf(t.id) !== 'todo'" class="size-4" stroke-width="3" />
          {{ t.label }}
        </button>
      </div>
      <div v-if="isDance" class="flex items-center gap-2 px-4 pb-3">
        <div class="bg-muted grid grid-cols-2 rounded-xl p-1" role="radiogroup" aria-label="What you’re entering">
          <button
            v-for="opt in (['placings', 'points'] as const)"
            :key="opt"
            type="button"
            role="radio"
            :aria-checked="mode === opt"
            :class="['h-9 rounded-lg px-4 text-sm font-bold', mode === opt ? 'bg-card shadow-sm' : 'text-muted-foreground']"
            @click="mode = opt"
          >
            {{ opt === 'placings' ? 'Placings' : 'Points' }}
          </button>
        </div>
        <span v-if="placings.reverseFrom && mode === 'placings'" class="bg-blue-paper text-primary rounded-full px-3 py-1.5 text-sm font-bold">
          From {{ placings.reverseFrom }}{{ getOrdinalSuffix(placings.reverseFrom) }}
        </span>
      </div>

      <!-- Phone: the placed order, always in view -->
      <div v-if="!split && mode === 'placings' && placings.entries.length" class="flex items-center gap-2 px-4 pb-3">
        <div class="flex min-w-0 flex-1 gap-1.5 overflow-x-auto [scrollbar-width:none]">
          <span
            v-for="(e, i) in placings.entries"
            :key="`${e.id}-${i}`"
            :class="[
              'flex h-9 shrink-0 items-center gap-1 rounded-lg border px-2 text-sm font-bold tabular-nums',
              isPlaceholderId(e.id) || !m.dancersById.value.get(e.id) ? 'bg-next text-next-foreground border-transparent' : 'bg-card',
            ]"
          >
            <span v-if="!isCallbacks" class="text-primary">{{ placeAt(i, placings) ?? '–' }}{{ isTied(i, placings) ? '=' : '' }}</span>
            <span class="font-mono">{{ m.dancersById.value.get(e.id)?.num || '?' }}</span>
          </span>
        </div>
        <button type="button" class="text-primary hover:bg-accent flex h-9 shrink-0 items-center gap-1 rounded-lg px-2 text-sm font-bold" @click="orderOpen = true">
          <ListOrdered class="size-4" /> {{ isCallbacks ? 'List' : 'Order' }}
        </button>
      </div>
    </div>

    <div class="md:grid md:min-h-0 md:flex-1 md:grid-cols-[minmax(0,1fr)_minmax(20rem,27rem)]">
      <!-- Dancers to tap -->
      <section class="min-w-0 md:overflow-y-auto">
        <p class="text-muted-foreground px-4 pt-3 text-sm font-semibold">{{ instruction }}</p>
        <p v-if="!isCallbacks && mode === 'placings' && !callbackIds.length && groupDancers.length" class="text-muted-foreground px-4 pt-1 text-sm">
          No callbacks entered, so everyone in the group is listed.
        </p>

        <div v-if="markedNone" class="bg-muted m-4 flex items-center gap-3 rounded-2xl p-4">
          <CircleDashed class="text-muted-foreground size-5 shrink-0" />
          <p class="min-w-0 flex-1 text-base font-semibold">{{ isCallbacks ? 'No callbacks' : 'No placings' }} for {{ tab.label }}.</p>
          <button type="button" :disabled="!canEdit" class="text-primary h-10 rounded-xl px-3 font-bold disabled:opacity-50" @click="save(null)">Undo</button>
        </div>

        <label v-if="candidates.length > 12" class="bg-card border-strong focus-within:border-primary mx-4 mt-3 flex h-11 items-center gap-2 rounded-xl border-2 px-3">
          <Search class="text-muted-foreground size-4 shrink-0" />
          <span class="sr-only">Find a dancer</span>
          <input v-model="query" type="search" placeholder="Find by number or name" class="min-w-0 flex-1 bg-transparent text-base outline-none" />
          <button v-if="query" type="button" aria-label="Clear" class="text-muted-foreground flex size-8 items-center justify-center rounded-full" @click="query = ''">
            <X class="size-4" />
          </button>
        </label>

        <p v-if="!groupDancers.length" class="text-muted-foreground px-4 py-10 text-center text-base">
          No dancers in this age group yet.
          <RouterLink :to="{ name: 'manage.dancers', params: { competitionId: m.competitionId.value } }" class="text-primary font-bold">Add dancers</RouterLink>
        </p>

        <ul v-else class="divide-y pb-6">
          <li v-for="d in shownCandidates" :key="d.id">
            <button
              type="button"
              :disabled="!canEdit || (mode === 'points' && placedIndex.has(d.id)) || (mode === 'placings' && pointed.has(d.id))"
              :aria-pressed="mode === 'points' ? pointed.has(d.id) : placedIndex.has(d.id)"
              :class="[
                'flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left transition-colors active:bg-accent disabled:cursor-not-allowed',
                (mode === 'placings' ? placedIndex.has(d.id) : pointed.has(d.id)) ? 'bg-blue-paper' : 'hover:bg-accent',
                ((mode === 'points' && placedIndex.has(d.id)) || (mode === 'placings' && pointed.has(d.id))) && 'opacity-45',
              ]"
              @click="tapDancer(d.id)"
            >
              <span class="bg-paper text-paper-ink min-w-12 shrink-0 rounded-md border px-1.5 py-1 text-center font-mono text-base font-semibold tabular-nums">{{ d.num || '–' }}</span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-base font-semibold">{{ d.label }}</span>
                <span v-if="d.location" class="text-muted-foreground block truncate text-sm">{{ d.location }}</span>
              </span>
              <template v-if="mode === 'placings' && placedIndex.has(d.id)">
                <Check v-if="isCallbacks" class="text-primary size-6" stroke-width="3" />
                <Medal v-else :place="placeAt(placedIndex.get(d.id)!, placings)" :tied="isTied(placedIndex.get(d.id)!, placings)" size="sm" />
              </template>
              <span v-else-if="pointed.has(d.id)" class="bg-next text-next-foreground flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-bold">
                <Diamond class="size-3.5" /> Point
              </span>
            </button>
          </li>
          <li>
            <button
              type="button"
              :disabled="!canEdit"
              class="hover:bg-accent flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left disabled:opacity-50"
              @click="addPlaceholder"
            >
              <span class="bg-next text-next-foreground min-w-12 shrink-0 rounded-md px-1.5 py-1 text-center font-mono text-base font-semibold">?</span>
              <span class="min-w-0 flex-1">
                <span class="block text-base font-semibold">Can’t find them?</span>
                <span class="text-muted-foreground block text-sm">Add an unknown dancer now and choose who it was later.</span>
              </span>
            </button>
          </li>
        </ul>
      </section>

      <!-- Wide: the placed order beside the list -->
      <aside v-if="split" class="bg-muted/40 min-w-0 space-y-3 overflow-y-auto border-l p-4">
        <template v-if="mode === 'placings'">
          <h2 class="text-heading">{{ isCallbacks ? `Called back · ${placings.entries.length}` : 'Placed' }}</h2>
          <PlacedList
            v-if="placings.entries.length"
            :placings="placings"
            :dancers-by-id="m.dancersById.value"
            :callbacks="isCallbacks"
            @reorder="onReorder"
            @tie="onTie"
            @remove="onRemove"
            @fix="openFix"
          />
          <p v-else-if="!markedNone" class="text-muted-foreground text-sm">Nobody yet.</p>
        </template>
        <template v-else>
          <h2 class="text-heading">Championship points</h2>
          <ul v-if="combinedPoints().length" class="space-y-1.5">
            <li v-for="id in combinedPoints()" :key="id" class="bg-card flex min-h-12 items-center gap-2 rounded-xl border px-2">
              <span class="bg-paper text-paper-ink min-w-10 rounded-md border px-1.5 py-0.5 text-center font-mono text-sm font-semibold">{{ m.dancersById.value.get(id)?.num || '?' }}</span>
              <span class="min-w-0 flex-1 truncate text-[0.9375rem] font-semibold">{{ m.dancersById.value.get(id)?.label ?? 'Unknown dancer' }}</span>
              <button type="button" aria-label="Remove point" class="text-muted-foreground hover:bg-accent flex size-11 shrink-0 items-center justify-center rounded-full" @click="togglePoint(id)">
                <X class="size-4" />
              </button>
            </li>
          </ul>
          <p v-else class="text-muted-foreground text-sm">Nobody yet.</p>
        </template>
      </aside>
    </div>
  </div>

  <!-- Phone: edit the order -->
  <Dialog :open="orderOpen" variant="sheet" @close="orderOpen = false">
    <template #header>
      <h2 class="text-title">{{ isCallbacks ? 'Called back' : 'Placed' }}</h2>
      <p class="text-muted-foreground text-sm">{{ isCallbacks ? 'Take anyone out with ×.' : 'Drag to reorder. Tie means tied with the dancer above.' }}</p>
    </template>
    <div class="p-4 pb-[calc(1rem+var(--safe-bottom))]">
      <PlacedList
        :placings="placings"
        :dancers-by-id="m.dancersById.value"
        :callbacks="isCallbacks"
        @reorder="onReorder"
        @tie="onTie"
        @remove="onRemove"
        @fix="(i) => { orderOpen = false; openFix(i) }"
      />
    </div>
  </Dialog>

  <!-- More options -->
  <Dialog :open="menuOpen" variant="sheet" @close="menuOpen = false">
    <template #header>
      <h2 class="text-title">{{ tab.label }}</h2>
    </template>
    <ul class="divide-y pb-[var(--safe-bottom)]">
      <li v-if="isDance && mode === 'placings'">
        <button type="button" :disabled="!canEdit" class="hover:bg-accent flex min-h-14 w-full flex-col justify-center px-4 py-2 text-left disabled:opacity-50" @click="menuOpen = false; reverseOpen = true">
          <span class="text-base font-bold">{{ placings.reverseFrom ? 'Change championship order' : 'Enter from the lowest place' }}</span>
          <span class="text-muted-foreground text-sm">For championships, announced from the last place up to 1st.</span>
        </button>
      </li>
      <li v-if="!placings.entries.length && !markedNone">
        <button type="button" :disabled="!canEdit" class="hover:bg-accent flex min-h-14 w-full flex-col justify-center px-4 py-2 text-left disabled:opacity-50" @click="menuOpen = false; markNone()">
          <span class="text-base font-bold">{{ isCallbacks ? 'No callbacks' : 'No placings' }}</span>
          <span class="text-muted-foreground text-sm">Marks this as finished with nobody {{ isCallbacks ? 'called back' : 'placed' }}.</span>
        </button>
      </li>
      <li v-if="placings.entries.length || markedNone">
        <button type="button" :disabled="!canEdit" class="text-destructive hover:bg-destructive/10 flex min-h-14 w-full items-center px-4 text-left text-base font-bold disabled:opacity-50" @click="menuOpen = false; clearAll()">
          Clear {{ isCallbacks ? 'callbacks' : 'placings' }}
        </button>
      </li>
    </ul>
  </Dialog>

  <!-- Championship: how many places -->
  <Dialog :open="reverseOpen" variant="sheet" @close="reverseOpen = false">
    <template #header>
      <h2 class="text-title">How many places are awarded?</h2>
      <p class="text-muted-foreground text-sm">You’ll tap dancers from that place up to 1st.</p>
    </template>
    <ul class="divide-y pb-[var(--safe-bottom)]">
      <li v-if="placings.reverseFrom">
        <button type="button" class="hover:bg-accent flex min-h-13 w-full items-center px-4 text-left text-base font-bold" @click="setReverse(null)">Enter from 1st instead</button>
      </li>
      <li v-for="n in reverseChoices" :key="n">
        <button
          type="button"
          :class="['hover:bg-accent flex min-h-13 w-full items-center justify-between px-4 text-left text-base font-semibold', n === placings.reverseFrom && 'text-primary font-bold']"
          @click="setReverse(n)"
        >
          {{ n }} places
          <Check v-if="n === placings.reverseFrom" class="size-5" />
        </button>
      </li>
    </ul>
  </Dialog>

  <!-- Choose who a "?" was -->
  <Dialog :open="fixing != null" variant="sheet" size="md" @close="fixing = null">
    <template #header>
      <h2 class="text-title">Who was it?</h2>
      <p class="text-muted-foreground text-sm">Replaces the unknown dancer in the same place.</p>
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
      <li v-if="!fixChoices.length" class="text-muted-foreground px-4 py-6 text-center">Everyone in the group is already placed.</li>
    </ul>
  </Dialog>
</template>
