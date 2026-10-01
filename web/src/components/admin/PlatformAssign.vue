<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { VueDraggable } from 'vue-draggable-plus'
import { ClipboardPaste, Copy, Gavel, Plus, RefreshCw } from '@lucide/vue'
import Dialog from '@/components/Dialog.vue'
import { useManagedCompetition } from '@/composables/admin/useManagedCompetition'
import { toast } from '@/lib/admin/feedback'
import { canEdit, friendlyError } from '@/lib/admin/write'
import type { Node } from '@/lib/admin/scheduleTree'
import type { SchedulePlatform } from '@/types/competition'

// Which age groups dance on which platform (in order), and who judges
// each platform, for one dance in the schedule. Drag between platforms,
// or tap a group to choose where it goes.

const props = defineProps<{ node: Node }>()
const m = useManagedCompetition()

interface Chip {
  key: string
  id: string
  kind: 'group' | 'judge' | 'spacer'
  label: string
  count?: number
}

const UNASSIGNED = '__unassigned'
const isSpacer = (id: string) => /^\d+$/.test(id)

const dance = computed(() => (props.node.danceId ? m.dancesById.value.get(props.node.danceId) : undefined))
const danceGroups = computed(() => m.groups.value.filter((g) => dance.value?.groupIds?.[g.id]))
const groupsById = computed(() => new Map(danceGroups.value.map((g) => [g.id, g])))
const judgesById = computed(() => new Map(m.judges.value.map((j) => [j.id, j])))

const pools = ref<Record<string, Chip[]>>({})
const dragging = ref(false)

function build(): Record<string, Chip[]> {
  const assigned = new Set<string>()
  const out: Record<string, Chip[]> = {}
  for (const p of m.platforms.value) {
    const slot = props.node.platforms?.[p.id]
    const judges = (slot?.orderedJudgeIds ?? []).filter((id) => judgesById.value.has(id))
    const groups = (slot?.orderedGroupIds ?? []).filter((id) => groupsById.value.has(id) || isSpacer(id))
    judges.forEach((id) => assigned.add(`j:${id}`))
    groups.forEach((id) => assigned.add(`g:${id}`))
    out[p.id] = [
      ...judges.map<Chip>((id) => ({ key: `j:${id}`, id, kind: 'judge', label: judgesById.value.get(id)!.label })),
      ...groups.map<Chip>((id) =>
        isSpacer(id)
          ? { key: `s:${id}`, id, kind: 'spacer', label: 'Spacer' }
          : { key: `g:${id}`, id, kind: 'group', label: groupsById.value.get(id)!.label, count: m.groupDancers(id).length },
      ),
    ]
  }
  out[UNASSIGNED] = [
    ...m.judges.value.filter((j) => !assigned.has(`j:${j.id}`)).map<Chip>((j) => ({ key: `j:${j.id}`, id: j.id, kind: 'judge', label: j.label })),
    ...danceGroups.value
      .filter((g) => !assigned.has(`g:${g.id}`))
      .map<Chip>((g) => ({ key: `g:${g.id}`, id: g.id, kind: 'group', label: g.label, count: m.groupDancers(g.id).length })),
  ]
  return out
}

watch(
  () => [props.node.platforms, m.platforms.value, danceGroups.value, m.judges.value],
  () => {
    if (!dragging.value) pools.value = build()
  },
  { immediate: true, deep: true },
)

async function save(next: Record<string, Chip[]>) {
  const updates: Record<string, unknown> = {}
  for (const p of m.platforms.value) {
    const chips = next[p.id] ?? []
    const groupIds = chips.filter((c) => c.kind !== 'judge').map((c) => c.id)
    const judgeIds = chips.filter((c) => c.kind === 'judge').map((c) => c.id)
    updates[`${props.node.path}/platforms/${p.id}`] = groupIds.length || judgeIds.length ? { orderedGroupIds: groupIds.length ? groupIds : null, orderedJudgeIds: judgeIds.length ? judgeIds : null } : null
  }
  try {
    await m.writeData(updates, 'Platforms')
  } catch (e) {
    pools.value = build()
    toast(friendlyError(e), { tone: 'error' })
  }
}

function onEnd() {
  dragging.value = false
  void save({ ...pools.value })
}

// A spacer is a gap in a platform's order (e.g. for a break). Move one to
// Unassigned to take it out.
function addSpacer(poolId: string) {
  const id = String(Date.now())
  const next = { ...pools.value, [poolId]: [...(pools.value[poolId] ?? []), { key: `s:${id}`, id, kind: 'spacer' as const, label: 'Spacer' }] }
  pools.value = next
  void save(next)
}

// --- Tap to move
const moving = ref<{ chip: Chip; from: string } | null>(null)
function moveTo(dest: string) {
  const mv = moving.value
  moving.value = null
  if (!mv || mv.from === dest) return
  const next = { ...pools.value }
  next[mv.from] = (next[mv.from] ?? []).filter((c) => c.key !== mv.chip.key)
  next[dest] = [...(next[dest] ?? []), mv.chip]
  pools.value = next
  void save(next)
}

// --- Copy, paste, cycle judges (fill one dance, then reuse it for the next)
const clipboard = useClipboard()
function copy() {
  clipboard.value = JSON.parse(JSON.stringify(props.node.platforms ?? {}))
  toast('Copied the platforms for this dance')
}
async function paste() {
  const src = clipboard.value
  if (!src) return
  const next: Record<string, SchedulePlatform | null> = {}
  for (const p of m.platforms.value) {
    const slot = src[p.id]
    const groups = (slot?.orderedGroupIds ?? []).filter((id) => groupsById.value.has(id) || isSpacer(id))
    const judges = (slot?.orderedJudgeIds ?? []).filter((id) => judgesById.value.has(id))
    next[p.id] = groups.length || judges.length ? { orderedGroupIds: groups.length ? groups : undefined, orderedJudgeIds: judges.length ? judges : undefined } : null
  }
  try {
    const change = await m.writeData({ [`${props.node.path}/platforms`]: JSON.parse(JSON.stringify(next)) }, 'Pasted platforms')
    toast('Pasted', { action: { label: 'Undo', run: () => m.undoChange(change) } })
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  }
}
// Rotate the judges one platform along, as panels usually move between dances.
async function cycleJudges() {
  const judges = m.judges.value.map((j) => j.id)
  const platforms = m.platforms.value
  if (!judges.length || !platforms.length) return
  let offset = 0
  for (const p of platforms) {
    const first = props.node.platforms?.[p.id]?.orderedJudgeIds?.[0]
    const i = first ? judges.indexOf(first) : -1
    if (i >= 0) {
      offset = (i - 1 + judges.length) % judges.length
      break
    }
  }
  const cycled = [...judges.slice(offset), ...judges.slice(0, offset)]
  const per = Math.floor(judges.length / platforms.length) || 1
  const updates: Record<string, unknown> = {}
  platforms.forEach((p, index) => {
    const ids = cycled.slice(index * per, (index + 1) * per)
    updates[`${props.node.path}/platforms/${p.id}/orderedJudgeIds`] = ids.length ? ids : null
  })
  try {
    await m.writeData(updates, 'Cycled judges')
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  }
}

const poolList = computed(() => [
  ...m.platforms.value.map((p) => ({ id: p.id, label: `Platform ${p.label}` })),
  { id: UNASSIGNED, label: 'Not on a platform' },
])
</script>

<script lang="ts">
import { ref as vueRef, type Ref } from 'vue'
const sharedClipboard = vueRef<Record<string, SchedulePlatform> | null>(null)
function useClipboard(): Ref<Record<string, SchedulePlatform> | null> {
  return sharedClipboard
}
</script>

<template>
  <section class="space-y-3">
    <div>
      <h3 class="text-heading">Platforms</h3>
      <p class="text-muted-foreground text-sm">Drag age groups and judges onto platforms in the order they’ll dance, or tap one to move it. A spacer leaves a gap in the order; move it to Unassigned to take it out.</p>
    </div>

    <p v-if="!m.platforms.value.length" class="text-muted-foreground text-base">
      No platforms yet.
      <RouterLink :to="{ name: 'manage.platforms', params: { competitionId: m.competitionId.value } }" class="text-primary font-bold">Add platforms</RouterLink>
    </p>
    <p v-else-if="!danceGroups.length" class="text-muted-foreground text-base">No age groups do this dance yet. Set them on the dance or age group pages.</p>

    <template v-else>
      <div class="grid gap-3 sm:grid-cols-2">
        <div
          v-for="pool in poolList"
          :key="pool.id"
          :class="['rounded-2xl border p-3', pool.id === UNASSIGNED ? 'bg-muted/50 border-dashed sm:col-span-2' : 'bg-card shadow-sm']"
        >
          <h4 class="text-[0.9375rem] font-bold">{{ pool.label }}</h4>
          <p v-if="!(pools[pool.id] ?? []).length" class="text-muted-foreground text-sm">
            {{ pool.id === UNASSIGNED ? 'Everyone is on a platform.' : 'Drop age groups and judges here.' }}
          </p>
          <VueDraggable
            v-model="pools[pool.id]"
            :group="`platforms-${node.id}`"
            class="mt-2 flex min-h-11 flex-wrap gap-1.5"
            :disabled="!canEdit"
            :animation="150"
            ghost-class="opacity-40"
            @start="dragging = true"
            @end="onEnd"
          >
            <button
              v-for="chip in pools[pool.id] ?? []"
              :key="chip.key"
              type="button"
              :disabled="!canEdit"
              :class="[
                'flex h-10 cursor-grab touch-none items-center gap-1.5 rounded-full border px-3 text-sm font-bold active:cursor-grabbing',
                chip.kind === 'judge' ? 'bg-blue-paper text-primary border-transparent' : chip.kind === 'spacer' ? 'text-muted-foreground border-dashed' : 'bg-background',
              ]"
              @click="moving = { chip, from: pool.id }"
            >
              <Gavel v-if="chip.kind === 'judge'" class="size-3.5" />
              {{ chip.label }}
              <span v-if="chip.count != null" class="text-muted-foreground tabular-nums">{{ chip.count }}</span>
            </button>
          </VueDraggable>
          <button
            v-if="pool.id !== UNASSIGNED"
            type="button"
            :disabled="!canEdit"
            class="text-muted-foreground hover:bg-accent mt-1.5 flex h-9 items-center gap-1 rounded-full px-2.5 text-sm font-bold disabled:opacity-50"
            @click="addSpacer(pool.id)"
          >
            <Plus class="size-3.5" /> Spacer
          </button>
        </div>
      </div>

      <div class="flex flex-wrap gap-2">
        <button type="button" class="hover:bg-accent flex h-10 items-center gap-1.5 rounded-xl border px-3 text-sm font-bold" @click="copy">
          <Copy class="size-4" /> Copy
        </button>
        <button type="button" :disabled="!clipboard || !canEdit" class="hover:bg-accent flex h-10 items-center gap-1.5 rounded-xl border px-3 text-sm font-bold disabled:opacity-50" @click="paste">
          <ClipboardPaste class="size-4" /> Paste
        </button>
        <button type="button" :disabled="!m.judges.value.length || !canEdit" class="hover:bg-accent flex h-10 items-center gap-1.5 rounded-xl border px-3 text-sm font-bold disabled:opacity-50" @click="cycleJudges">
          <RefreshCw class="size-4" /> Cycle judges
        </button>
      </div>
      <p class="text-muted-foreground text-sm">Tip: set up one dance, Copy, open the next dance, Paste, then Cycle judges.</p>
    </template>

    <Dialog :open="!!moving" variant="sheet" @close="moving = null">
      <template #header>
        <h2 class="text-title">Move {{ moving?.chip.label }}</h2>
      </template>
      <ul class="divide-y pb-[var(--safe-bottom)]">
        <li v-for="pool in poolList" :key="pool.id">
          <button
            type="button"
            :disabled="pool.id === moving?.from"
            class="hover:bg-accent flex min-h-13 w-full items-center justify-between px-4 text-left text-base font-semibold disabled:opacity-50"
            @click="moveTo(pool.id)"
          >
            {{ pool.label }}
            <span v-if="pool.id === moving?.from" class="text-muted-foreground text-sm">Here now</span>
          </button>
        </li>
      </ul>
    </Dialog>
  </section>
</template>
