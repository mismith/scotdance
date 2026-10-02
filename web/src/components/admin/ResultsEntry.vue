<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useId, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useMediaQuery } from '@vueuse/core'
import { ChevronDown, ChevronRight, CloudOff, Diamond, ListOrdered, Search, Trophy, X } from '@lucide/vue'
import Dialog from '@/components/Dialog.vue'
import EmptyState from '@/components/EmptyState.vue'
import HelpTip from '@/components/admin/HelpTip.vue'
import NumberTile from '@/components/admin/NumberTile.vue'
import PlacedList from '@/components/admin/PlacedList.vue'
import ResultStatus from '@/components/admin/ResultStatus.vue'
import Button from '@/components/ui/Button.vue'
import Segmented from '@/components/ui/Segmented.vue'
import Switch from '@/components/ui/Switch.vue'
import { useManagedCompetition } from '@/composables/admin/useManagedCompetition'
import { useSplit } from '@/composables/admin/useWide'
import { toast } from '@/lib/admin/feedback'
import { canEdit, friendlyError } from '@/lib/admin/write'
import { competitionPhase } from '@/lib/dancerDay'
import { selectionHaptic, tapHaptic } from '@/lib/haptics'
import { getOrdinalSuffix } from '@/lib/results'
import { isPrimaryCategory } from '@/types/competition'
import {
  CALLBACKS,
  OVERALL,
  danceState,
  dancingNow,
  isPlaceholderId,
  needsFixing,
  newPlaceholderId,
  parsePlacings,
  placeAt,
  removeEntry,
  resultRows,
  resultsOrder,
  scheduleTurns,
  serializePlacings,
  stateLabel,
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
const router = useRouter()
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

// Said aloud by screen readers as each tap lands ("149 placed 3rd").
const announcement = ref('')
const spoken = (id: string) => (isPlaceholderId(id) ? 'Missed number' : who(id))

async function save(value: Placings | false | null, label: string) {
  const stored = value === false || value === null ? value : serializePlacings(value)
  try {
    await m.writeData({ [path.value]: stored }, `${label} in ${danceName.value}`)
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  }
}

// On wide screens, a tapped number card flies across into Placed. A copy
// flies, so taps carry on landing underneath it.
const split = useSplit()
const placedSection = ref<HTMLElement | null>(null)
async function fly(row: EventTarget | null | undefined, id: string) {
  const from = row instanceof HTMLElement ? row.querySelector<HTMLElement>('[data-tile]') : null
  if (!from || !split.value || matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const start = from.getBoundingClientRect()
  await nextTick()
  const to = placedSection.value?.querySelector<HTMLElement>(`[data-tile="${CSS.escape(id)}"]`)
  const end = to?.getBoundingClientRect()
  if (!to || !end || end.bottom < 0 || end.top > innerHeight) return
  // Land where the row settles, not where its ease-in starts.
  const [, rise = '0'] = getComputedStyle(to.closest('li') ?? to).translate.split(' ')
  const card = from.cloneNode(true) as HTMLElement
  card.className += ' pointer-events-none fixed z-50 m-0 shadow-(--shadow-raised) transition-[translate] duration-(--dur-slow) ease-snappy'
  Object.assign(card.style, { left: `${start.left}px`, top: `${start.top}px`, width: `${start.width}px` })
  document.body.append(card)
  to.style.opacity = '0'
  card.getBoundingClientRect()
  card.style.translate = `${end.left - start.left}px ${end.top - parseFloat(rise) - start.top}px`
  const land = () => {
    card.remove()
    to.style.opacity = ''
  }
  card.addEventListener('transitionend', land, { once: true })
  setTimeout(land, 600)
}

/** Tap a dancer: add them to the end, or take them out if already there. */
function place(id: string, e?: Event) {
  if (!canEdit.value) return
  tapHaptic()
  const p = parsePlacings(rawNow())
  const i = p.entries.findIndex((e) => e.id === id)
  if (i >= 0) {
    announcement.value = `${spoken(id)} taken out`
    void save(removeEntry(p, i), `Took out ${who(id)}`)
    return
  }
  const added = { ...p, entries: [...p.entries, { id, tie: false }] }
  const at = placeAt(added.entries.length - 1, added)
  announcement.value = isCallbacks.value ? `${spoken(id)} called back` : at ? `${spoken(id)} placed ${at}${getOrdinalSuffix(at)}` : `${spoken(id)} placed`
  void save(added, `Placed ${who(id)}`)
  void fly(e?.currentTarget, id)
}
function remove(index: number) {
  const p = parsePlacings(rawNow())
  const id = p.entries[index]?.id
  if (id == null) return
  announcement.value = `${spoken(id)} taken out`
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
  announcement.value = i >= 0 ? `Point taken from ${spoken(id)}` : `${spoken(id)} given a point`
  void m
    .writeData({ [pointsPath.value]: list.length ? list : null }, `${i >= 0 ? 'Took a point from' : 'Gave a point to'} ${who(id)} in ${danceName.value}`)
    .catch((e) => toast(friendlyError(e), { tone: 'error' }))
}

function tapPlaceholder(e: Event) {
  const id = newPlaceholderId()
  if (tab.value === 'points') point(id)
  else place(id, e)
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

// This age group's callbacks, dances and Overall, with where each stands.
const rows = computed(() =>
  group.value
    ? resultRows(group.value, m.groupDances(props.groupId)).map((r) => {
        const raw = m.results.value[props.groupId]?.[r.id]
        return { ...r, state: danceState(raw), fix: needsFixing(raw, m.points.value[props.groupId]?.[r.id]?.combined) }
      })
    : [],
)

// Where to carry straight on: this age group's next dance, then the next
// age group in the running order (or list order with no schedule).
const turns = computed(() => scheduleTurns(m.schedule.value, m.platforms.value))
const next = computed(() => {
  const g = group.value
  if (!g) return null
  const i = rows.value.findIndex((d) => d.id === props.danceId)
  if (i < 0) return null
  const here = rows.value[i + 1]
  if (here) return { groupId: g.id, danceId: here.id, label: here.label }
  const ids = resultsOrder(
    m.groups.value.filter((x) => x.id === g.id || m.groupDancers(x.id).length).map((x) => x.id),
    turns.value,
  )
  const after = m.groupsById.value.get(ids[ids.indexOf(g.id) + 1] ?? '')
  return after ? { groupId: after.id, danceId: CALLBACKS, label: `${after.label} · Callbacks` } : null
})

// --- Tablets and laptops (md to xl): the list folds away (see Results), so
// the header picks the age group and its dance.
const live = computed(() =>
  competitionPhase(m.competition.value?.date, m.schedule.value) === 'today' ? dancingNow(turns.value, m.results.value) : new Set<string>(),
)
/** Another age group: where its results left off (callbacks to start). */
function pickGroup(id: string) {
  const first = resultRows(m.groupsById.value.get(id) ?? {}, m.groupDances(id)).find((r) => danceState(m.results.value[id]?.[r.id]) === 'todo')
  void router.replace({ name: 'manage.results', params: { competitionId: m.competitionId.value, groupId: id, danceId: first?.id ?? CALLBACKS } })
}
// Keep the open dance's pill in view.
const pickers = useMediaQuery('(min-width: 768px) and (max-width: 1279.98px)')
const pills = ref<HTMLElement | null>(null)
const showCurrent = () => nextTick(() => pills.value?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }))
onMounted(showCurrent)
watch(() => props.danceId, showCurrent)
</script>

<template>
  <div v-if="group" class="flex flex-col md:h-full">
    <header class="flex flex-col gap-3 border-b px-4 pt-4 pb-3">
      <div :class="['min-w-0', pickers && 'sr-only']">
        <p class="text-muted-foreground truncate text-sm font-medium">{{ group.label }}</p>
        <h1 class="text-title truncate">{{ danceName }}</h1>
      </div>
      <div v-if="!isCallbacks && offersPoints || pickers" class="flex flex-wrap items-center gap-x-4 gap-y-3">
        <label v-if="pickers" class="relative max-w-full min-w-0">
          <span class="sr-only">Age group</span>
          <select
            :value="groupId"
            class="surface press h-11 max-w-full appearance-none truncate rounded-full pr-10 pl-4 text-base font-semibold"
            @change="pickGroup(($event.target as HTMLSelectElement).value)"
          >
            <option v-for="g in m.groups.value" :key="g.id" :value="g.id">{{ g.label }}{{ live.has(g.id) ? ' · dancing now' : '' }}</option>
          </select>
          <ChevronDown class="text-muted-foreground pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2" aria-hidden="true" />
        </label>
        <!-- Placings / Points -->
        <div v-if="!isCallbacks && offersPoints" :class="['flex max-w-sm min-w-64 flex-1 items-center gap-2', pickers && 'ml-auto']">
          <Segmented v-model="tab" :options="TABS" label="Placings or points" class="flex-1" />
          <HelpTip label="About championship points">
            Championship points mark dancers who were placed by at least one judge, but whose combined score didn’t give them a place.
          </HelpTip>
        </div>
      </div>
      <nav v-if="pickers" ref="pills" aria-label="Dances" class="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
        <RouterLink
          v-for="r in rows"
          :key="r.id"
          :to="{ name: 'manage.results', params: { competitionId: m.competitionId.value, groupId, danceId: r.id } }"
          replace
          :aria-current="r.id === danceId ? 'page' : undefined"
          :aria-label="`${r.label}, ${stateLabel(r.state, r.fix)}`"
          :class="[
            'press text-callout inline-flex h-11 shrink-0 items-center gap-2 rounded-full pr-4 pl-3 font-semibold whitespace-nowrap',
            r.id === danceId ? 'bg-primary-fill text-primary-foreground' : 'surface',
          ]"
        >
          <ResultStatus :state="r.state" :fix="r.fix" :plain="r.id === danceId" />
          {{ r.label }}
        </RouterLink>
      </nav>
    </header>

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
            <p class="text-muted-foreground px-4 pt-3 pb-2 text-sm">{{ instruction }}</p>
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
            <p v-if="placings.reverseFrom && tab === 'placings'" class="bg-blue-paper text-primary px-4 py-2.5 text-sm font-semibold">
              Entering from {{ placings.reverseFrom }}{{ getOrdinalSuffix(placings.reverseFrom) }} place
            </p>
            <ul class="divide-y">
              <li v-for="d in candidates" :key="d.id">
                <button
                  type="button"
                  :disabled="rowDisabled(d.id)"
                  :aria-pressed="tab === 'placings' ? placedIndex.has(d.id) : pointed.has(d.id)"
                  :class="['press-row focus-inset flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left', rowDimmed(d.id) && 'opacity-35']"
                  @click="tab === 'placings' ? place(d.id, $event) : point(d.id)"
                >
                  <NumberTile :num="d.num" data-tile />
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
                  class="press-row focus-inset flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left"
                  @click="tapPlaceholder"
                >
                  <NumberTile unknown data-tile />
                  <span class="min-w-0 flex-1 truncate text-base font-semibold">Missed number</span>
                </button>
              </li>
            </ul>
          </div>

          <EmptyState v-else size="inline" :icon="Search" title="No dancers found" description="Add dancers to this age group first.">
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
      <section ref="placedSection" class="min-w-0 max-md:border-t-8 max-md:border-muted md:overflow-y-auto">
        <template v-if="tab === 'placings'">
          <h2 class="text-muted-foreground flex items-center gap-1.5 px-4 pt-3 pb-2 text-sm font-semibold">
            {{ isCallbacks ? `Called back · ${placings.entries.length}` : 'Placed' }}
            <HelpTip v-if="!isCallbacks" label="How the placed list works">
              Drag the handle to change the order. Switch on Tie when a dancer shares the place of the dancer above. Tap a dancer to take them out.
            </HelpTip>
          </h2>
          <!-- Kept while empty, so the first placing lands like the rest -->
          <PlacedList
            :key="danceId"
            :placings="placings"
            :dancers-by-id="m.dancersById.value"
            :kind="kind"
            @remove="remove"
            @tie="tie"
            @reorder="reorder"
            @fix="openFix"
          />
          <template v-if="!placings.entries.length">
            <EmptyState
              size="inline"
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
              <label class="flex min-h-11 items-center gap-3 font-medium">
                <Switch :model-value="markedNone" :disabled="!canEdit" @update:model-value="setNone" />
                {{ isCallbacks ? 'No callbacks' : 'No dancers placed' }}
              </label>
            </div>
          </template>
          <p v-if="singleOverall" class="text-muted-foreground flex items-center gap-1.5 px-4 py-3 text-sm"><Trophy class="size-4" /> Overall winner</p>
        </template>

        <template v-else>
          <h2 class="text-muted-foreground px-4 pt-3 pb-2 text-sm font-semibold">Championship points</h2>
          <ul v-if="pointedIds.length" class="divide-y">
            <li v-for="id in pointedIds" :key="id">
              <button
                type="button"
                :disabled="!canEdit"
                :aria-label="`Take the point from ${who(id)}`"
                class="press-row focus-inset flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left"
                @click="point(id)"
              >
                <NumberTile :num="who(id)" :unknown="isPlaceholderId(id)" />
                <span class="min-w-0 flex-1 truncate text-base font-semibold">{{ m.dancersById.value.get(id)?.label ?? (isPlaceholderId(id) ? 'Missed number' : 'Deleted dancer') }}</span>
                <Diamond class="text-primary size-5 shrink-0 fill-current" />
              </button>
            </li>
          </ul>
          <EmptyState v-else size="inline" :icon="Diamond" title="Championship points" description="Select dancers who didn’t quite place" />
        </template>

        <!-- Carry on to the next dance without going back to the list -->
        <div v-if="next && (placings.entries.length || markedNone)" class="border-t p-4">
          <Button
            variant="primary"
            size="lg"
            block
            replace
            :to="{ name: 'manage.results', params: { competitionId: m.competitionId.value, groupId: next.groupId, danceId: next.danceId } }"
          >
            <span class="min-w-0 truncate">Next: {{ next.label }}</span>
            <ChevronRight />
          </Button>
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
      <label class="field flex h-11 items-center gap-2 rounded-xl px-3">
        <Search class="text-muted-foreground size-4 shrink-0" />
        <span class="sr-only">Find a dancer</span>
        <input v-model="fixQuery" type="search" placeholder="Find by number or name" class="min-w-0 flex-1 bg-transparent text-base outline-none" />
        <button v-if="fixQuery" type="button" aria-label="Clear search" class="press text-muted-foreground -mr-1 flex size-7 items-center justify-center rounded-full" @click="fixQuery = ''">
          <X class="size-4" />
        </button>
      </label>
    </div>
    <ul class="divide-y pb-[var(--safe-bottom)]">
      <li v-for="d in fixChoices" :key="d.id">
        <button type="button" class="press-row focus-inset flex min-h-14 w-full items-center gap-3 px-4 text-left" @click="chooseFix(d.id)">
          <NumberTile :num="d.num" />
          <span class="min-w-0 flex-1 truncate text-base font-semibold">{{ d.label }}</span>
        </button>
      </li>
      <li v-if="!fixChoices.length" class="text-muted-foreground px-4 py-6 text-center">Everyone is already placed.</li>
    </ul>
  </Dialog>

  <p class="sr-only" aria-live="polite">{{ announcement }}</p>
</template>
