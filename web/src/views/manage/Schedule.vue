<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { VueDraggable } from 'vue-draggable-plus'
import { CalendarClock, Check, ChevronRight, GripVertical, Plus, Trash2 } from '@lucide/vue'
import Dialog from '@/components/Dialog.vue'
import EmptyState from '@/components/EmptyState.vue'
import MasterDetail from '@/components/admin/MasterDetail.vue'
import TextField from '@/components/admin/TextField.vue'
import SelectField from '@/components/admin/SelectField.vue'
import SwitchField from '@/components/admin/SwitchField.vue'
import PlatformAssign from '@/components/admin/PlatformAssign.vue'
import HelpTip from '@/components/admin/HelpTip.vue'
import { useManagedCompetition } from '@/composables/admin/useManagedCompetition'
import { useSplit } from '@/composables/admin/useWide'
import { confirm, toast } from '@/lib/admin/feedback'
import { canEdit, friendlyError } from '@/lib/admin/write'
import { snapshot } from '@/lib/admin/collection'
import {
  CHILD_KEY,
  LEVELS,
  LEVEL_NAME,
  countDescendants,
  findNode,
  scheduleTree,
  type Level,
  type Node,
} from '@/lib/admin/scheduleTree'
import { parseDate } from '@/lib/format'

const route = useRoute()
const router = useRouter()
const m = useManagedCompetition()
const split = useSplit()

const tree = computed(() => scheduleTree(m.schedule.value))
const params = computed(() => ({
  dayId: route.params.dayId ? String(route.params.dayId) : undefined,
  blockId: route.params.blockId ? String(route.params.blockId) : undefined,
  eventId: route.params.eventId ? String(route.params.eventId) : undefined,
  itemId: route.params.itemId ? String(route.params.itemId) : undefined,
}))
const selected = computed(() => findNode(tree.value, params.value))
const hasSelection = computed(() => !!params.value.dayId)

const to = (p: Node['params']) => ({ name: 'manage.schedule', params: { competitionId: m.competitionId.value, ...p } })
const open = (n: Node) => (split.value ? router.replace(to(n.params)) : router.push(to(n.params)))

const itemLabel = (n: Node) => {
  if (n.level !== 'item') return n.name?.trim() || `Untitled ${LEVEL_NAME[n.level].one}`
  const dance = n.danceId ? m.dancesById.value.get(n.danceId) : undefined
  const custom = n.name?.trim() && !/^\d+$/.test(n.name.trim()) ? n.name.trim() : null
  return dance?.label ?? custom ?? 'Untitled'
}
const firstLine = (s?: string) => s?.split('\n')[0]?.trim() || ''

// --- Reordering siblings: show the new order straight away, then save it.
const pending = reactive(new Map<string, string[]>())
function siblingsOf(parentPath: string, nodes: Node[]) {
  const ids = pending.get(parentPath)
  if (!ids) return nodes
  const byId = new Map(nodes.map((n) => [n.id, n]))
  return ids.map((id) => byId.get(id)).filter((n): n is Node => !!n)
}
async function reorder(parentPath: string, list: Node[]) {
  pending.set(parentPath, list.map((n) => n.id))
  const updates: Record<string, unknown> = {}
  list.forEach((n, i) => {
    if (n.order !== i) updates[`${n.path}/order`] = i
  })
  try {
    await m.writeData(updates, 'Reordered the schedule')
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  } finally {
    pending.delete(parentPath)
  }
}

// --- Adding
// What each level is for (from the old admin's tips).
const LEVEL_HELP: Record<Level, string> = {
  day: 'The days the competition runs. Usually there’s just one, but events can be split over several days too.',
  block: 'Parts of the day that group events together, like Morning and Afternoon. Sessions often have their own start time and results ceremony.',
  event: 'Groups of similar ages or categories, which usually perform the same dances. Events also work for special cases, like a dance across categories.',
  item: 'The dances and ceremonies in each event, in the order they’re performed. Results usually go last, and Registration, if there is one, first.',
}

const PRESETS: Record<Level, string[]> = {
  day: ['Saturday', 'Sunday'],
  block: ['Morning', 'Afternoon', 'Evening'],
  event: ['Primary', 'Pre-Premier', 'Premier', 'Primary/Beginner/Novice', 'Intermediate/Premier', 'Junior', 'Senior'],
  item: ['Registration', 'Results'],
}
const adding = ref<{ level: Level; parent: Node | null } | null>(null)
const addPicks = reactive(new Set<string>())
const addCustom = ref('')
function startAdd(level: Level, parent: Node | null) {
  addPicks.clear()
  addCustom.value = ''
  adding.value = { level, parent }
}
const addParentChildren = computed(() => (adding.value?.parent ? adding.value.parent.children : tree.value))
const addTakenNames = computed(() => new Set(addParentChildren.value.map((n) => itemLabel(n).toLowerCase())))
const addTakenDances = computed(() => new Set(addParentChildren.value.map((n) => n.danceId).filter(Boolean)))
async function confirmAdd() {
  const a = adding.value
  if (!a) return
  const base = a.parent ? a.parent.path : 'schedule'
  const key = CHILD_KEY[a.level]
  let order = addParentChildren.value.reduce((max, n) => Math.max(max, n.order ?? -1), addParentChildren.value.length - 1) + 1
  const updates: Record<string, unknown> = {}
  const picks = [...addPicks]
  // Dances go in the order picked, with "Registration" first and "Results"
  // last. Everything else follows the presets' order (Morning before Evening).
  const presetOrder = (p: string) => PRESETS[a.level].indexOf(p.slice(5))
  const sorted =
    a.level === 'item'
      ? [...picks.filter((p) => p === 'name:Registration'), ...picks.filter((p) => p.startsWith('dance:')), ...picks.filter((p) => p !== 'name:Registration' && p.startsWith('name:'))]
      : [...picks].sort((x, y) => presetOrder(x) - presetOrder(y))
  for (const p of sorted) {
    const value = p.startsWith('dance:') ? { danceId: p.slice(6), order } : { name: p.slice(5), order }
    updates[`${base}/${key}/${m.newKey()}`] = value
    order += 1
  }
  if (addCustom.value.trim()) updates[`${base}/${key}/${m.newKey()}`] = { name: addCustom.value.trim(), order }
  adding.value = null
  if (!Object.keys(updates).length) return
  const n = Object.keys(updates).length
  const message = `Added ${n} ${n === 1 ? LEVEL_NAME[a.level].one : LEVEL_NAME[a.level].many}`
  try {
    const change = await m.writeData(updates, message)
    toast(message, { action: { label: 'Undo', run: () => m.undoChange(change) } })
    if (a.parent && split.value) void open(a.parent)
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  }
}
const addCount = computed(() => addPicks.size + (addCustom.value.trim() ? 1 : 0))

// --- Editing the selected node
const save = (n: Node, key: string) => (v: string | null) => m.writeData({ [`${n.path}/${key}`]: v }, itemLabel(n))
const pad = (x: number) => String(x).padStart(2, '0')
function dateInput(value: unknown) {
  if (!value) return ''
  const d = parseDate(value as string)
  return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const danceOptions = computed(() => m.dances.value.map((d) => ({ value: d.id, label: d.label })))

function parentOf(n: Node): Node | null {
  const idx = LEVELS.indexOf(n.level)
  if (idx === 0) return null
  const p = { ...n.params }
  const keys = ['dayId', 'blockId', 'eventId', 'itemId'] as const
  for (let i = idx; i < keys.length; i += 1) delete p[keys[i]]
  return findNode(tree.value, p)
}

// Where a node could move: any node one level up, except its current parent.
function moveTargets(n: Node): Array<{ node: Node; label: string }> {
  const out: Array<{ node: Node; label: string }> = []
  const walk = (nodes: Node[], trail: string[]) => {
    for (const x of nodes) {
      const t = [...trail, itemLabel(x)]
      if (LEVELS.indexOf(x.level) === LEVELS.indexOf(n.level) - 1) out.push({ node: x, label: t.join(' › ') })
      else walk(x.children, t)
    }
  }
  walk(tree.value, [])
  const current = parentOf(n)
  return out.filter((o) => o.node.path !== current?.path)
}
const movingNode = ref<Node | null>(null)
async function moveTo(n: Node, target: Node) {
  movingNode.value = null
  const raw = JSON.parse(JSON.stringify(snapshot(m.raw.value, { [n.path]: null })[n.path]))
  const order = target.children.reduce((max, c) => Math.max(max, c.order ?? -1), target.children.length - 1) + 1
  const newPath = `${target.path}/${CHILD_KEY[n.level]}/${n.id}`
  const updates = { [n.path]: null, [newPath]: { ...raw, order } }
  try {
    const change = await m.writeData(updates, `Moved ${itemLabel(n)} to ${itemLabel(target)}`)
    toast(`Moved to ${itemLabel(target)}`, { action: { label: 'Undo', run: () => m.undoChange(change) } })
    const keys = ['dayId', 'blockId', 'eventId', 'itemId'] as const
    void router.replace(to({ ...target.params, [keys[LEVELS.indexOf(n.level)]]: n.id }))
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  }
}

async function remove(n: Node) {
  const inside = countDescendants(n)
  const ok = await confirm({
    title: `Delete ${itemLabel(n)}?`,
    message: `${inside ? `Everything in it (${inside} ${inside === 1 ? 'item' : 'items'}) goes too. ` : ''}You can undo this straight after.`,
    confirmLabel: 'Delete',
    destructive: true,
  })
  if (!ok) return
  try {
    const change = await m.writeData({ [n.path]: null }, `Deleted ${itemLabel(n)}`)
    const parent = parentOf(n)
    void router.replace(parent ? to(parent.params) : to({}))
    toast(`Deleted ${itemLabel(n)}`, { action: { label: 'Undo', run: () => m.undoChange(change) } })
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  }
}

async function setHidden(hidden: boolean) {
  if (hidden) {
    const hasAny = tree.value.length > 0
    const ok = await confirm({
      title: 'Hide the Schedule tab?',
      message: hasAny ? 'The schedule built so far is deleted, and the tab disappears from the competition page.' : 'The tab disappears from the competition page.',
      confirmLabel: 'Hide schedule',
      destructive: hasAny,
    })
    if (!ok) return
    const change = await m.writeData({ schedule: false }, 'Hid the Schedule tab')
    toast('Schedule tab hidden', { action: { label: 'Undo', run: () => m.undoChange(change) } })
  } else {
    await m.writeData({ schedule: null }, 'Showed the Schedule tab')
  }
}

const isSel = (n: Node) => selected.value?.path === n.path
const childLevel = (n: Node) => LEVELS[LEVELS.indexOf(n.level) + 1] as Level | undefined
</script>

<template>
  <MasterDetail :show-detail="hasSelection">
    <template #list>
      <div class="space-y-4 p-4 pb-[calc(2rem+var(--safe-bottom))]">
        <header class="flex items-center gap-2">
          <h1 class="text-title min-w-0 flex-1">Schedule</h1>
          <button
            v-if="!m.scheduleHidden.value"
            type="button"
            :disabled="!canEdit"
            class="bg-primary text-primary-foreground flex h-10 items-center gap-1.5 rounded-xl px-3 text-[0.9375rem] font-bold disabled:opacity-50"
            @click="startAdd('day', null)"
          >
            <Plus class="size-4" /> Add day
          </button>
        </header>

        <EmptyState
          v-if="m.scheduleHidden.value"
          :icon="CalendarClock"
          title="The schedule is hidden"
          description="This competition doesn’t show a schedule. Turn the tab back on below to build one."
        />
        <EmptyState
          v-else-if="!tree.length"
          :icon="CalendarClock"
          title="No schedule yet"
          description="Start with a day, then add its sessions (morning, afternoon), the events in each, and the dances in order."
        />

        <!-- The outline -->
        <VueDraggable
          v-else
          :model-value="siblingsOf('schedule', tree)"
          tag="ol"
          class="space-y-3"
          handle="[data-handle='day']"
          :disabled="!canEdit"
          :animation="150"
          @update:model-value="(l: Node[]) => reorder('schedule', l)"
        >
          <li v-for="day in siblingsOf('schedule', tree)" :key="day.id" class="bg-card overflow-hidden rounded-2xl border shadow-sm">
            <div :class="['flex items-center', isSel(day) && 'bg-blue-paper']">
              <span data-handle="day" class="text-muted-foreground flex w-8 shrink-0 cursor-grab touch-none justify-center" aria-hidden="true"><GripVertical class="size-4" /></span>
              <button type="button" class="flex min-h-13 min-w-0 flex-1 items-center gap-2 py-2 pr-3 text-left" @click="open(day)">
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-base font-bold">{{ itemLabel(day) }}</span>
                  <span v-if="firstLine(day.description)" class="text-muted-foreground block truncate text-sm">{{ firstLine(day.description) }}</span>
                </span>
                <ChevronRight class="text-muted-foreground size-5 shrink-0 md:hidden" />
              </button>
            </div>
            <VueDraggable
              :model-value="siblingsOf(day.path, day.children)"
              tag="ol"
              class="border-t"
              :handle="`[data-handle='${day.id}']`"
              :disabled="!canEdit"
              :animation="150"
              @update:model-value="(l: Node[]) => reorder(day.path, l)"
            >
              <li v-for="block in siblingsOf(day.path, day.children)" :key="block.id" class="border-b last:border-b-0">
                <div :class="['flex items-center pl-3', isSel(block) && 'bg-blue-paper']">
                  <span :data-handle="day.id" class="text-muted-foreground flex w-7 shrink-0 cursor-grab touch-none justify-center" aria-hidden="true"><GripVertical class="size-4" /></span>
                  <button type="button" class="flex min-h-12 min-w-0 flex-1 items-center gap-2 py-1.5 pr-3 text-left" @click="open(block)">
                    <span class="min-w-0 flex-1">
                      <span class="block truncate text-[0.9375rem] font-bold">{{ itemLabel(block) }}</span>
                      <span v-if="firstLine(block.description)" class="text-muted-foreground block truncate text-sm">{{ firstLine(block.description) }}</span>
                    </span>
                    <ChevronRight class="text-muted-foreground size-5 shrink-0 md:hidden" />
                  </button>
                </div>
                <VueDraggable
                  :model-value="siblingsOf(block.path, block.children)"
                  tag="ol"
                  :handle="`[data-handle='${block.id}']`"
                  :disabled="!canEdit"
                  :animation="150"
                  @update:model-value="(l: Node[]) => reorder(block.path, l)"
                >
                  <li v-for="event in siblingsOf(block.path, block.children)" :key="event.id">
                    <div :class="['flex items-center pl-8', isSel(event) && 'bg-blue-paper']">
                      <span :data-handle="block.id" class="text-muted-foreground flex w-7 shrink-0 cursor-grab touch-none justify-center" aria-hidden="true"><GripVertical class="size-4" /></span>
                      <button type="button" class="flex min-h-11 min-w-0 flex-1 items-center gap-2 py-1 pr-3 text-left" @click="open(event)">
                        <span class="min-w-0 flex-1 truncate text-[0.9375rem] font-semibold">{{ itemLabel(event) }}</span>
                        <span class="text-muted-foreground text-sm tabular-nums">{{ event.children.length }}</span>
                        <ChevronRight class="text-muted-foreground size-5 shrink-0 md:hidden" />
                      </button>
                    </div>
                    <VueDraggable
                      v-if="selected && (isSel(event) || selected.path.startsWith(`${event.path}/`))"
                      :model-value="siblingsOf(event.path, event.children)"
                      tag="ol"
                      :handle="`[data-handle='${event.id}']`"
                      :disabled="!canEdit"
                      :animation="150"
                      @update:model-value="(l: Node[]) => reorder(event.path, l)"
                    >
                      <li v-for="item in siblingsOf(event.path, event.children)" :key="item.id" :class="['flex items-center pl-14', isSel(item) && 'bg-blue-paper']">
                        <span :data-handle="event.id" class="text-muted-foreground flex w-7 shrink-0 cursor-grab touch-none justify-center" aria-hidden="true"><GripVertical class="size-4" /></span>
                        <button type="button" class="flex min-h-10 min-w-0 flex-1 items-center gap-2 pr-3 text-left" @click="open(item)">
                          <span class="min-w-0 flex-1 truncate text-sm font-semibold">{{ itemLabel(item) }}</span>
                          <Check v-if="item.danceId && Object.keys(item.platforms ?? {}).length" class="text-done-foreground size-4" aria-label="Platforms set" />
                        </button>
                      </li>
                    </VueDraggable>
                    <div v-if="selected && (isSel(event) || selected.path.startsWith(`${event.path}/`))" class="pl-21">
                      <button type="button" :disabled="!canEdit" class="text-primary flex h-10 items-center gap-1 text-sm font-bold disabled:opacity-50" @click="startAdd('item', event)">
                        <Plus class="size-4" /> Add dances
                      </button>
                    </div>
                  </li>
                </VueDraggable>
                <div class="pl-15">
                  <button type="button" :disabled="!canEdit" class="text-primary flex h-10 items-center gap-1 text-sm font-bold disabled:opacity-50" @click="startAdd('event', block)">
                    <Plus class="size-4" /> Add event
                  </button>
                </div>
              </li>
            </VueDraggable>
            <div class="border-t pl-10">
              <button type="button" :disabled="!canEdit" class="text-primary flex h-11 items-center gap-1 text-sm font-bold disabled:opacity-50" @click="startAdd('block', day)">
                <Plus class="size-4" /> Add session
              </button>
            </div>
          </li>
        </VueDraggable>

        <div class="bg-card rounded-2xl border px-4 py-2">
          <SwitchField :model-value="m.scheduleHidden.value" label="Hide the Schedule tab" description="For competitions that won’t share a schedule here." :save="setHidden" />
        </div>
      </div>
    </template>

    <template #empty>
      <div class="hidden h-full items-center justify-center p-8 md:flex">
        <p class="text-muted-foreground max-w-xs text-center text-base">Choose a day, session, event or dance to change it. Events show their dances when chosen.</p>
      </div>
    </template>

    <template #detail>
      <div v-if="selected" :key="selected.path" class="mx-auto max-w-2xl space-y-8 p-4 pb-[calc(3rem+var(--safe-bottom))] md:p-8">
        <header>
          <p class="text-muted-foreground flex items-center gap-1.5 text-sm font-bold capitalize">
            {{ LEVEL_NAME[selected.level].one }}
            <HelpTip :label="`About ${LEVEL_NAME[selected.level].many}`">{{ LEVEL_HELP[selected.level] }}</HelpTip>
          </p>
          <h2 class="text-display break-words">{{ itemLabel(selected) }}</h2>
        </header>

        <div class="space-y-4">
          <template v-if="selected.level === 'item'">
            <SelectField
              :model-value="selected.danceId"
              label="Dance"
              :options="danceOptions"
              placeholder="Not a dance (e.g. Registration)"
              hint="Linking a dance lets you put its age groups on platforms."
              :save="save(selected, 'danceId')"
            />
            <TextField
              :model-value="selected.name"
              label="Name"
              :placeholder="selected.danceId ? 'Uses the dance’s name' : 'e.g. Registration'"
              :hint="selected.danceId ? 'Optional: only to show a different name.' : undefined"
              :required="!selected.danceId"
              :save="save(selected, 'name')"
            />
          </template>
          <template v-else>
            <TextField :model-value="selected.name" label="Name" required :placeholder="selected.level === 'day' ? 'e.g. Saturday' : selected.level === 'block' ? 'e.g. Morning' : 'e.g. Premier'" :save="save(selected, 'name')" />
            <TextField v-if="selected.level === 'day'" :model-value="dateInput(selected.date)" label="Date" type="date" :save="save(selected, 'date')" />
          </template>
          <TextField
            :model-value="selected.description"
            :label="selected.level === 'block' ? 'Time and notes' : 'Notes'"
            multiline
            :rows="3"
            :hint="selected.level === 'block' ? 'The first line shows as the time, e.g. “8:00 am”.' : undefined"
            :save="save(selected, 'description')"
          />
        </div>

        <PlatformAssign v-if="selected.level === 'item' && selected.danceId" :node="selected" />

        <section v-if="childLevel(selected)" class="space-y-3">
          <h3 class="text-heading capitalize">{{ LEVEL_NAME[childLevel(selected)!].many }}</h3>
          <ul v-if="selected.children.length" class="bg-card divide-y overflow-hidden rounded-2xl border shadow-sm">
            <li v-for="c in selected.children" :key="c.id">
              <RouterLink :to="to(c.params)" :replace="split" class="hover:bg-accent flex min-h-12 items-center gap-2 px-4">
                <span class="min-w-0 flex-1 truncate text-base font-semibold">{{ itemLabel(c) }}</span>
                <ChevronRight class="text-muted-foreground size-5" />
              </RouterLink>
            </li>
          </ul>
          <button type="button" :disabled="!canEdit" class="bg-card border-strong hover:bg-accent flex h-11 items-center gap-1.5 rounded-xl border px-4 text-[0.9375rem] font-bold disabled:opacity-50" @click="startAdd(childLevel(selected)!, selected)">
            <Plus class="size-4" /> Add {{ childLevel(selected) === 'item' ? 'dances' : LEVEL_NAME[childLevel(selected)!].one }}
          </button>
        </section>

        <footer class="flex flex-wrap gap-2 border-t pt-6">
          <button
            v-if="selected.level !== 'day' && moveTargets(selected).length"
            type="button"
            :disabled="!canEdit"
            class="bg-card border-strong hover:bg-accent h-11 rounded-xl border px-4 text-[0.9375rem] font-bold disabled:opacity-50"
            @click="movingNode = selected"
          >
            Move to…
          </button>
          <button type="button" :disabled="!canEdit" class="text-destructive hover:bg-destructive/10 flex h-11 items-center gap-2 rounded-xl px-3 text-[0.9375rem] font-bold disabled:opacity-50" @click="remove(selected)">
            <Trash2 class="size-4" /> Delete {{ LEVEL_NAME[selected.level].one }}
          </button>
        </footer>
      </div>
      <EmptyState v-else :icon="CalendarClock" title="This isn’t in the schedule any more" description="It may have been deleted or moved." />
    </template>
  </MasterDetail>

  <!-- Add -->
  <Dialog :open="!!adding" variant="sheet" size="md" @close="adding = null">
    <template #header>
      <h2 class="text-title">
        Add {{ adding?.level === 'item' ? 'dances' : LEVEL_NAME[adding?.level ?? 'day'].one }}{{ adding?.parent ? ` to ${itemLabel(adding.parent)}` : '' }}
      </h2>
      <p class="text-muted-foreground text-sm">{{ LEVEL_HELP[adding?.level ?? 'day'] }}</p>
    </template>
    <div v-if="adding" class="space-y-4 p-4">
      <div v-if="adding.level === 'item' && m.dances.value.length" class="space-y-2">
        <h3 class="text-[0.9375rem] font-bold">Dances</h3>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="d in m.dances.value"
            :key="d.id"
            type="button"
            :aria-pressed="addPicks.has(`dance:${d.id}`)"
            :class="['flex h-10 items-center gap-1.5 rounded-full border px-3 text-sm font-bold', addPicks.has(`dance:${d.id}`) ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent']"
            @click="addPicks.has(`dance:${d.id}`) ? addPicks.delete(`dance:${d.id}`) : addPicks.add(`dance:${d.id}`)"
          >
            <Check v-if="addPicks.has(`dance:${d.id}`)" class="size-4" />
            {{ d.label }}
            <span v-if="addTakenDances.has(d.id)" class="opacity-70">· added</span>
          </button>
        </div>
      </div>
      <div class="space-y-2">
        <h3 v-if="adding.level === 'item'" class="text-[0.9375rem] font-bold">Other</h3>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="p in PRESETS[adding.level]"
            :key="p"
            type="button"
            :aria-pressed="addPicks.has(`name:${p}`)"
            :class="['flex h-10 items-center gap-1.5 rounded-full border px-3 text-sm font-bold', addPicks.has(`name:${p}`) ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent']"
            @click="addPicks.has(`name:${p}`) ? addPicks.delete(`name:${p}`) : addPicks.add(`name:${p}`)"
          >
            <Check v-if="addPicks.has(`name:${p}`)" class="size-4" />
            {{ p }}
            <span v-if="addTakenNames.has(p.toLowerCase())" class="opacity-70">· added</span>
          </button>
        </div>
      </div>
      <label class="block space-y-1.5">
        <span class="text-[0.9375rem] font-bold">Or type a name</span>
        <input v-model="addCustom" type="text" class="bg-card border-strong focus:border-primary h-12 w-full rounded-xl border-2 px-3 text-base outline-none" @keydown.enter.prevent="confirmAdd" />
      </label>
    </div>
    <div class="bg-card sticky bottom-0 border-t p-4 pb-[calc(1rem+var(--safe-bottom))]">
      <button type="button" :disabled="!addCount || !canEdit" class="bg-primary text-primary-foreground h-12 w-full rounded-xl text-base font-bold disabled:opacity-50" @click="confirmAdd">
        {{ addCount ? `Add ${addCount}` : 'Pick or type something to add' }}
      </button>
    </div>
  </Dialog>

  <!-- Move -->
  <Dialog :open="!!movingNode" variant="sheet" size="md" @close="movingNode = null">
    <template #header>
      <h2 class="text-title">Move {{ movingNode ? itemLabel(movingNode) : '' }} to…</h2>
    </template>
    <ul v-if="movingNode" class="divide-y pb-[var(--safe-bottom)]">
      <li v-for="t in moveTargets(movingNode)" :key="t.node.path">
        <button type="button" class="hover:bg-accent flex min-h-13 w-full items-center px-4 py-2 text-left text-base font-semibold" @click="moveTo(movingNode!, t.node)">{{ t.label }}</button>
      </li>
    </ul>
  </Dialog>
</template>
