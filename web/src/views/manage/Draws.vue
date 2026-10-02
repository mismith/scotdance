<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { VueDraggable } from 'vue-draggable-plus'
import { ArrowDown01, GripVertical, Shuffle, Trash2, UsersRound } from '@lucide/vue'
import EmptyState from '@/components/EmptyState.vue'
import Button from '@/components/ui/Button.vue'
import SectionHeader from '@/components/admin/SectionHeader.vue'
import { useManagedCompetition, compareNumbers, type MDance } from '@/composables/admin/useManagedCompetition'
import { confirm, toast } from '@/lib/admin/feedback'
import { canEdit, friendlyError } from '@/lib/admin/write'

// The order dancers go up in each dance, for one age group. Optional.

const route = useRoute()
const m = useManagedCompetition()

const groupId = computed(() => String(route.params.itemId ?? ''))
const group = computed(() => m.groupsById.value.get(groupId.value) ?? null)
const dances = computed(() => m.groupDances(groupId.value))
const dancers = computed(() => m.groupDancers(groupId.value))
const numbers = computed(() => dancers.value.map((d) => d.num).filter(Boolean))
const byNumber = computed(() => new Map(dancers.value.map((d) => [d.num, d])))

// The old admin saved draws cell by cell, so a draw can have gaps (and come
// back as an object when sparse).
function stored(danceId: string) {
  const v: unknown = m.draws.value[groupId.value]?.[danceId]
  const list: unknown[] = Array.isArray(v) ? v : v && typeof v === 'object' ? Object.values(v) : []
  return list.filter((n) => n != null && n !== '').map((n) => String(n))
}

// Local copies for dragging; follow the database unless mid-drag.
const lists = ref<Record<string, string[]>>({})
const dragging = ref(false)
watch(
  () => [m.draws.value, dances.value],
  () => {
    if (dragging.value) return
    lists.value = Object.fromEntries(dances.value.map((d) => [d.id, stored(d.id)]))
  },
  { immediate: true, deep: true },
)

function shuffled(values: string[]) {
  const a = [...values]
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
const inNumberOrder = () => [...numbers.value].sort(compareNumbers)
// Reels are danced together in number order, so they aren't shuffled.
const isReel = (d: MDance) => /(^|\s)reel(\s|$)/i.test(d.name ?? '')

async function saveDraws(updates: Record<string, string[] | null>, message?: string) {
  try {
    const change = await m.writeData(updates, message ?? `Changed the draw for ${group.value?.label ?? 'an age group'}`)
    if (message) toast(message, { action: { label: 'Undo', run: () => m.undoChange(change) } })
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  }
}

const path = (danceId: string) => `draws/${groupId.value}/${danceId}`

async function shuffleAll() {
  const hasAny = dances.value.some((d) => stored(d.id).length)
  if (hasAny) {
    const ok = await confirm({ title: 'Shuffle every dance?', message: 'Replaces the current draws. You can undo straight after.', confirmLabel: 'Shuffle all' })
    if (!ok) return
  }
  const updates: Record<string, string[] | null> = {}
  for (const d of dances.value) updates[path(d.id)] = isReel(d) ? inNumberOrder() : shuffled(numbers.value)
  await saveDraws(updates, 'Shuffled every dance')
}
const shuffleOne = (d: MDance) => saveDraws({ [path(d.id)]: shuffled(numbers.value) }, `Shuffled ${d.label}`)
const numberOrder = (d: MDance) => saveDraws({ [path(d.id)]: inNumberOrder() }, `${d.label} in number order`)
const clearOne = (d: MDance) => saveDraws({ [path(d.id)]: null }, `Cleared ${d.label}`)
async function clearAll() {
  const ok = await confirm({ title: 'Clear all draws?', message: 'You can undo straight after.', confirmLabel: 'Clear all', destructive: true })
  if (!ok) return
  const updates: Record<string, null> = {}
  for (const d of dances.value) if (stored(d.id).length) updates[path(d.id)] = null
  await saveDraws(updates, 'Cleared all draws')
}

async function onEnd(d: MDance, e: { oldIndex?: number; newIndex?: number }) {
  // The drop is already in place: let the list settle before it glides again.
  await nextTick()
  dragging.value = false
  if (e.oldIndex === e.newIndex) return
  void saveDraws({ [path(d.id)]: lists.value[d.id] })
}

// Rows are keyed by number (and which time it appears, for an old draw that
// has one twice), so a shuffle is seen to shuffle.
const keyAt = (list: string[], i: number) => `${list[i]}#${list.slice(0, i).filter((n) => n === list[i]).length}`

const missing = (danceId: string) => {
  const set = new Set(stored(danceId))
  return inNumberOrder().filter((n) => !set.has(n))
}
const strays = (danceId: string) => stored(danceId).filter((n) => !byNumber.value.has(n))
function addMissing(d: MDance) {
  void saveDraws({ [path(d.id)]: [...stored(d.id).filter((n) => byNumber.value.has(n)), ...missing(d.id)] })
}
function removeStrays(d: MDance) {
  void saveDraws({ [path(d.id)]: stored(d.id).filter((n) => byNumber.value.has(n)) })
}
const anyDraws = computed(() => dances.value.some((d) => stored(d.id).length))
</script>

<template>
  <div class="max-w-3xl space-y-6 p-4 pb-[calc(3rem+var(--safe-bottom))]">
    <EmptyState v-if="!group" :icon="UsersRound" title="This age group isn’t here any more" />
    <template v-else>
      <SectionHeader
        title="Draws"
        :kicker="`${group.label} · ${dancers.length} ${dancers.length === 1 ? 'dancer' : 'dancers'}`"
        description="The order dancers go up in each dance. Optional: leave it empty if there’s no draw."
      />

      <EmptyState v-if="!dances.length" :icon="UsersRound" title="No dances for this age group" description="Choose its dances first, on the age group’s page." />
      <EmptyState v-else-if="!numbers.length" :icon="UsersRound" title="No dancers yet" description="Add dancers with numbers to this age group first." />

      <template v-else>
        <div class="space-y-2">
          <div class="flex flex-wrap gap-2">
            <Button variant="primary" :disabled="!canEdit" @click="shuffleAll">
              <Shuffle /> Shuffle every dance
            </Button>
            <Button v-if="anyDraws" variant="plain" class="text-destructive!" :disabled="!canEdit" @click="clearAll">
              <Trash2 /> Clear all
            </Button>
          </div>
          <p class="text-muted-foreground text-sm">Reels keep number order when shuffling every dance, since they’re danced together.</p>
        </div>

        <section v-for="d in dances" :key="d.id" class="surface space-y-3 rounded-2xl p-4">
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="text-heading w-full sm:w-auto sm:min-w-0 sm:flex-1">{{ d.label }}</h2>
            <Button :disabled="!canEdit" @click="shuffleOne(d)"><Shuffle /> Shuffle</Button>
            <Button :disabled="!canEdit" @click="numberOrder(d)"><ArrowDown01 /> By number</Button>
            <Button v-if="stored(d.id).length" variant="plain" class="text-destructive!" :disabled="!canEdit" @click="clearOne(d)">Clear</Button>
          </div>

          <p v-if="!stored(d.id).length" class="text-muted-foreground text-sm">No draw set.</p>
          <VueDraggable
            v-else
            v-model="lists[d.id]"
            target=".sort-target"
            handle="[data-handle]"
            :disabled="!canEdit"
            :animation="150"
            ghost-class="opacity-40"
            @start="dragging = true"
            @end="onEnd(d, $event)"
          >
            <!-- A shuffle deals the rows out one after another. -->
            <TransitionGroup
              tag="ol"
              class="sort-target gap-x-6 sm:columns-2"
              :move-class="dragging ? undefined : 'transition-transform duration-[450ms] ease-snappy delay-[calc(var(--i)*12ms)] motion-reduce:transition-none'"
            >
              <li
                v-for="(n, i) in lists[d.id]"
                :key="keyAt(lists[d.id], i)"
                :style="{ '--i': i }"
                :class="[
                  'flex min-h-11 break-inside-avoid items-center gap-2 border-b pr-1 last:border-b-0',
                  !byNumber.has(n) && 'text-destructive',
                ]"
              >
                <!-- Drag by the handle only, so swiping the list on a phone scrolls it. -->
                <span data-handle class="text-muted-foreground flex h-11 w-8 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing" aria-hidden="true">
                  <GripVertical class="size-4" />
                </span>
                <span class="text-muted-foreground w-6 shrink-0 text-right text-sm tabular-nums">{{ i + 1 }}</span>
                <span class="bg-paper text-paper-ink min-w-10 rounded-md border px-1.5 py-0.5 text-center font-mono text-sm font-semibold">{{ n }}</span>
                <span class="min-w-0 flex-1 truncate text-callout font-medium">{{ byNumber.get(n)?.label ?? 'Not in this age group' }}</span>
              </li>
            </TransitionGroup>
          </VueDraggable>

          <div v-if="stored(d.id).length && missing(d.id).length" class="bg-next text-next-foreground flex flex-wrap items-center gap-x-2 rounded-xl py-1 pr-1 pl-3 text-sm">
            <span class="min-w-0 flex-1 py-2 font-medium">Not in this draw: {{ missing(d.id).join(', ') }}</span>
            <Button variant="plain" class="text-next-foreground! underline-offset-2 hover:underline" :disabled="!canEdit" @click="addMissing(d)">Add to the end</Button>
          </div>
          <div v-if="strays(d.id).length" class="bg-destructive/10 text-destructive flex flex-wrap items-center gap-x-2 rounded-xl py-1 pr-1 pl-3 text-sm">
            <span class="min-w-0 flex-1 py-2 font-medium">{{ strays(d.id).join(', ') }} {{ strays(d.id).length === 1 ? 'isn’t' : 'aren’t' }} in this age group any more.</span>
            <Button variant="plain" class="text-destructive! underline-offset-2 hover:underline" :disabled="!canEdit" @click="removeStrays(d)">Take out</Button>
          </div>
        </section>
      </template>
    </template>
  </div>
</template>
