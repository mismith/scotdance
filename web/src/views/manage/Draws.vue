<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { VueDraggable } from 'vue-draggable-plus'
import { ArrowDown01, GripVertical, Shuffle, Trash2, UsersRound } from '@lucide/vue'
import EmptyState from '@/components/EmptyState.vue'
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

const stored = (danceId: string) => (m.draws.value[groupId.value]?.[danceId] ?? []).map((n) => String(n))

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

function onEnd(d: MDance) {
  dragging.value = false
  void saveDraws({ [path(d.id)]: lists.value[d.id] })
}

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
  <div class="mx-auto max-w-3xl space-y-6 p-4 pb-[calc(3rem+var(--safe-bottom))] md:p-8">
    <EmptyState v-if="!group" :icon="UsersRound" title="This age group isn’t here any more" />
    <template v-else>
      <header class="space-y-1">
        <p class="text-muted-foreground text-sm font-bold">{{ group.label }} · {{ dancers.length }} dancers</p>
        <h1 class="text-display">Draws</h1>
        <p class="text-muted-foreground text-base">The order dancers go up in each dance. Optional: leave it empty if there’s no draw.</p>
      </header>

      <EmptyState v-if="!dances.length" :icon="UsersRound" title="No dances for this age group" description="Choose its dances first, on the age group’s page." />
      <EmptyState v-else-if="!numbers.length" :icon="UsersRound" title="No dancers yet" description="Add dancers with numbers to this age group first." />

      <template v-else>
        <div class="flex flex-wrap gap-2">
          <button type="button" :disabled="!canEdit" class="bg-primary text-primary-foreground flex h-11 items-center gap-1.5 rounded-xl px-4 text-[0.9375rem] font-bold disabled:opacity-50" @click="shuffleAll">
            <Shuffle class="size-4" /> Shuffle every dance
          </button>
          <button
            v-if="anyDraws"
            type="button"
            :disabled="!canEdit"
            class="text-destructive hover:bg-destructive/10 flex h-11 items-center gap-1.5 rounded-xl px-3 text-[0.9375rem] font-bold disabled:opacity-50"
            @click="clearAll"
          >
            <Trash2 class="size-4" /> Clear all
          </button>
        </div>
        <p class="text-muted-foreground text-sm">Reels keep number order when shuffling every dance, since they’re danced together.</p>

        <section v-for="d in dances" :key="d.id" class="bg-card space-y-3 rounded-2xl border p-4 shadow-sm">
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="text-heading min-w-0 flex-1">{{ d.label }}</h2>
            <button type="button" :disabled="!canEdit" class="hover:bg-accent flex h-10 items-center gap-1.5 rounded-xl border px-3 text-sm font-bold disabled:opacity-50" @click="shuffleOne(d)">
              <Shuffle class="size-4" /> Shuffle
            </button>
            <button type="button" :disabled="!canEdit" class="hover:bg-accent flex h-10 items-center gap-1.5 rounded-xl border px-3 text-sm font-bold disabled:opacity-50" @click="numberOrder(d)">
              <ArrowDown01 class="size-4" /> By number
            </button>
            <button v-if="stored(d.id).length" type="button" :disabled="!canEdit" class="text-destructive hover:bg-destructive/10 flex h-10 items-center rounded-xl px-3 text-sm font-bold disabled:opacity-50" @click="clearOne(d)">
              Clear
            </button>
          </div>

          <p v-if="!stored(d.id).length" class="text-muted-foreground text-sm">No draw set.</p>
          <VueDraggable
            v-else
            v-model="lists[d.id]"
            tag="ol"
            class="gap-x-1.5 sm:columns-2"
            :disabled="!canEdit"
            :animation="150"
            ghost-class="opacity-40"
            @start="dragging = true"
            @end="onEnd(d)"
          >
            <li
              v-for="(n, i) in lists[d.id]"
              :key="`${n}-${i}`"
              :class="[
                'mb-1.5 flex min-h-11 cursor-grab touch-none break-inside-avoid items-center gap-2 rounded-xl border px-2 active:cursor-grabbing',
                byNumber.has(n) ? 'bg-background' : 'bg-destructive/10 border-destructive/40',
              ]"
            >
              <GripVertical class="text-muted-foreground size-4 shrink-0" />
              <span class="text-muted-foreground w-6 shrink-0 text-right text-sm font-semibold tabular-nums">{{ i + 1 }}</span>
              <span class="bg-paper text-paper-ink min-w-10 rounded-md border px-1.5 py-0.5 text-center font-mono text-sm font-semibold">{{ n }}</span>
              <span class="min-w-0 flex-1 truncate text-[0.9375rem] font-semibold">{{ byNumber.get(n)?.label ?? 'Not in this age group' }}</span>
            </li>
          </VueDraggable>

          <div v-if="stored(d.id).length && missing(d.id).length" class="bg-next text-next-foreground flex flex-wrap items-center gap-2 rounded-xl p-3 text-sm">
            <span class="min-w-0 flex-1 font-semibold">Not in this draw: {{ missing(d.id).join(', ') }}</span>
            <button type="button" :disabled="!canEdit" class="h-9 rounded-lg px-3 font-bold underline-offset-2 hover:underline" @click="addMissing(d)">Add to the end</button>
          </div>
          <div v-if="strays(d.id).length" class="bg-destructive/10 text-destructive flex flex-wrap items-center gap-2 rounded-xl p-3 text-sm">
            <span class="min-w-0 flex-1 font-semibold">{{ strays(d.id).join(', ') }} {{ strays(d.id).length === 1 ? 'isn’t' : 'aren’t' }} in this age group any more.</span>
            <button type="button" :disabled="!canEdit" class="h-9 rounded-lg px-3 font-bold underline-offset-2 hover:underline" @click="removeStrays(d)">Take out</button>
          </div>
        </section>
      </template>
    </template>
  </div>
</template>
