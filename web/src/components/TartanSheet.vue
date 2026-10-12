<script setup lang="ts">
import { computed, ref, useId, useTemplateRef, watch } from 'vue'
import { ArrowLeft, ArrowRight, Check, Shuffle, Trash2, Undo2, X } from '@lucide/vue'
import Dialog from '@/components/Dialog.vue'
import Button from '@/components/ui/Button.vue'
import TartanCloth from '@/components/TartanCloth.vue'
import TartanRail, { type Brick } from '@/components/TartanRail.vue'
import { useFollowing } from '@/composables/useFollowing'
import { toast } from '@/lib/admin/feedback'
import { selectionHaptic } from '@/lib/haptics'
import type { Morph } from '@/lib/morph'
import {
  CLOTH,
  MAX_STRIPES,
  PRESETS,
  ROLES,
  SWATCHES,
  WIDTHS,
  WIDTH_NAMES,
  clothImage,
  formatSett,
  paletteOf,
  parseSett,
  remixes,
  swatchName,
  type Hex,
  type Role,
  type Stripe,
  type Tartan,
  type Width,
} from '@/lib/tartan'
import { DANCER_COLORS, inkOn, isCustomColor, isTartan, useDancerColorsStore, type DancerColor } from '@/stores/dancerColors'

// Customise: the loom for a followed dancer's tartan. Bricks along the top
// are the stripes from the middle out; the cloth below is woven from them,
// mirrored and the same across and down. Tap a brick (or a stripe on the
// cloth) to swap its piece for another width, recolour it, move it or remove
// it; drag bricks to reorder; + adds one. Every change is saved as it's
// made, as the colour dots are, so the dancer's look updates everywhere at
// once; Undo steps back through this visit's changes, and Done just closes.
// Opened on a plain colour, it shows the first pattern woven in it, but the
// dancer stays plain until something's changed (and Undo can take them back).
const props = defineProps<{ open: boolean; morph?: Morph; dancerId: string; dancerName: string }>()
const emit = defineEmits<{ close: [] }>()

const following = useFollowing()
const colors = useDancerColorsStore()
const first = computed(() => props.dancerName.split(' ')[0] || 'This dancer')

const ROLE_NAMES: Record<Role, string> = { P: 'First', S: 'Second', T: 'Third', K: 'Black', W: 'White' }
const GLYPH: Record<Width, number> = { 2: 3, 6: 7, 16: 13, 40: 24 }
const RING = 'ring-foreground ring-offset-raised ring-2 ring-offset-2'
const RAINBOW = 'conic-gradient(#e11d48, #f59e0b, #eab308, #16a34a, #0891b2, #2563eb, #7c3aed, #db2777, #e11d48)'

// The tartan as it is in this sheet. The store hears about each change a
// moment later; this stays the source while the sheet is open.
const bricks = ref<Brick[]>([])
const color = ref<DancerColor>('dancer-1')
const second = ref<Hex | undefined>()
const third = ref<Hex | undefined>()
const selected = ref<number | null>(null)
const preview = ref<Brick[] | null>(null)
const well = ref<'P' | 'S' | 'T' | null>(null)
const ideas = ref<Stripe[][]>([])
// Still the plain colour they had when the sheet opened: nothing saved yet.
const plain = ref(false)
const rail = useTemplateRef<InstanceType<typeof TartanRail>>('rail')
const ids = { stripe: useId(), colours: useId(), ideas: useId() }

let nextId = 1
const toBricks = (stripes: readonly Stripe[]): Brick[] => stripes.map((s) => ({ role: s.role, width: s.width, id: nextId++ }))

interface Snapshot { bricks: Brick[]; color: DancerColor; second?: Hex; third?: Hex; plain: boolean }
const history = ref<Snapshot[]>([])
const snapshot = (): Snapshot => ({
  bricks: bricks.value.map((b) => ({ ...b })),
  color: color.value,
  second: second.value,
  third: third.value,
  plain: plain.value,
})

const tartan = (stripes: readonly Stripe[] = bricks.value): Tartan => ({
  color: color.value,
  sett: formatSett(stripes),
  ...(second.value ? { second: second.value } : {}),
  ...(third.value ? { third: third.value } : {}),
})
const palette = computed(() => paletteOf(tartan()))
const chosen = computed(() => bricks.value.find((b) => b.id === selected.value) ?? null)
/** A role's colour in words: its name, or which of your colours it is. */
const colourWords = (r: Role) => swatchName(palette.value[r])?.toLowerCase() ?? `your ${ROLE_NAMES[r].toLowerCase()} colour`
const chosenIndex = computed(() => bricks.value.findIndex((b) => b.id === selected.value))

// (A write the database refuses says so; offline, it waits and saves later.)
function write(look: Tartan | DancerColor) {
  colors.choose(props.dancerId, look).catch(() => toast('That didn’t save. Try again in a moment.', { tone: 'error' }))
}
function save() {
  plain.value = false
  write(tartan())
}
function change(fn: () => void) {
  history.value.push(snapshot())
  fn()
  save()
}

// Opening (or a different dancer under an open sheet): the tartan they wear,
// or the first pattern woven in their colour.
watch(
  () => [props.open, props.dancerId] as const,
  ([open]) => {
    if (!open) return
    const look = following.lookFor(props.dancerId)
    const t: Tartan = isTartan(look) ? look : { color: following.colorIdFor(props.dancerId) ?? 'dancer-1', sett: PRESETS[0].sett }
    color.value = t.color
    second.value = t.second
    third.value = t.third
    bricks.value = toBricks(parseSett(t.sett) ?? parseSett(PRESETS[0].sett)!)
    history.value = []
    selected.value = null
    preview.value = null
    well.value = null
    ideas.value = remixes(bricks.value, 8)
    plain.value = !isTartan(look)
  },
  { immediate: true },
)

function undo() {
  const s = history.value.pop()
  if (!s) return
  bricks.value = s.bricks
  color.value = s.color
  second.value = s.second
  third.value = s.third
  if (!bricks.value.some((b) => b.id === selected.value)) selected.value = null
  if (!s.plain) return save()
  plain.value = true
  write(s.color)
}

// The stripes.
function select(id: number) {
  selected.value = selected.value === id ? null : id
  selectionHaptic()
}
function move(from: number, to: number) {
  change(() => bricks.value.splice(to, 0, ...bricks.value.splice(from, 1)))
}
function add() {
  if (bricks.value.length >= MAX_STRIPES) return
  const [b] = toBricks([{ role: 'S', width: 6 }])
  change(() => bricks.value.push(b!))
  selected.value = b!.id
}
function setWidth(w: Width) {
  if (!chosen.value || chosen.value.width === w) return
  selectionHaptic()
  change(() => (chosen.value!.width = w))
}
function setRole(r: Role) {
  if (!chosen.value || chosen.value.role === r) return
  selectionHaptic()
  change(() => (chosen.value!.role = r))
}
function remove() {
  const i = chosenIndex.value
  if (i < 0 || bricks.value.length < 2) return
  change(() => bricks.value.splice(i, 1))
  selected.value = null
  // Focus goes to the stripe that took its place (or the one before the last).
  void rail.value?.focus(bricks.value[Math.min(i, bricks.value.length - 1)]!.id)
}
function deselect() {
  const id = selected.value
  selected.value = null
  if (id != null) void rail.value?.focus(id)
}

// The colours, shown as the cloth is dyed (the light theme's palette, in both themes).
const firstOptions = computed(() => DANCER_COLORS.map((c) => ({ value: c.id as DancerColor, label: c.label, bg: CLOTH[c.id], ink: inkOn(CLOTH[c.id]) })))
const swatchOptions = computed(() => SWATCHES.map((s) => ({ value: s.hex, label: s.label, bg: s.hex, ink: inkOn(s.hex) })))
const wellOptions = computed(() => (well.value === 'P' ? firstOptions.value : swatchOptions.value))
const wellValue = computed(() => (well.value === 'P' ? color.value : well.value ? palette.value[well.value] : null))
const wellCustom = computed(() => {
  const v = wellValue.value
  return isCustomColor(v) && !wellOptions.value.some((o) => o.value.toLowerCase() === v.toLowerCase()) ? v : null
})
const isOn = (value: string) => value.toLowerCase() === String(wellValue.value).toLowerCase()
const wellBg = (r: 'P' | 'S' | 'T') => palette.value[r]

function pickColour(value: string) {
  const r = well.value
  if (!r) return
  if (r === 'P') {
    if (value === color.value) return
    change(() => (color.value = value as DancerColor))
  } else {
    // (Picking the colour that goes with First keeps it, even if First changes.)
    if (value.toLowerCase() === (r === 'S' ? second.value : third.value)?.toLowerCase()) return
    change(() => (r === 'S' ? (second.value = value as Hex) : (third.value = value as Hex)))
  }
  selectionHaptic()
}
function pickAnyColour(e: Event) {
  const hex = (e.target as HTMLInputElement).value.toLowerCase()
  if (isCustomColor(hex)) pickColour(hex)
}

// Ideas: remixes of the pattern as it was when they were drawn. They stay
// put until More ideas, so trying one doesn't shuffle the rest away.
const ideaTiles = computed(() => ideas.value.map((s) => clothImage(tartan(s), 76) ?? wellBg('P')))
function tryIdea(i: number) {
  const s = ideas.value[i]
  if (!s) return
  selectionHaptic()
  change(() => (bricks.value = toBricks(s)))
  selected.value = null
}
</script>

<template>
  <Dialog :open="open" :morph="morph" variant="sheet" size="md" @close="emit('close')">
    <template #header>
      <h2 class="text-title">{{ first }}’s tartan</h2>
    </template>
    <!-- (Left-aligned: it opens from inside a centred page header.) -->
    <div class="space-y-5 px-4 pt-4 text-left">
      <p v-if="plain" class="bg-blue-paper text-primary rounded-xl px-3 py-2 text-sm font-semibold">
        {{ first }} stays plain until you change something here.
      </p>
      <section class="space-y-3" aria-label="Stripes">
        <p class="text-muted-foreground truncate text-sm">Tap to change, drag to move</p>
        <TartanRail
          ref="rail"
          :bricks="bricks"
          :palette="palette"
          :selected="selected"
          :can-add="bricks.length < MAX_STRIPES"
          @select="select"
          @move="move"
          @preview="preview = $event"
          @add="add"
        />
        <TartanCloth
          :stripes="preview ?? bricks"
          :palette="palette"
          :selected="preview ? null : chosenIndex >= 0 ? chosenIndex : null"
          @select="select(bricks[$event]!.id)"
        />
      </section>

      <!-- The chosen stripe: its piece, its colour, its place. -->
      <section v-if="chosen" class="bg-muted space-y-3 rounded-2xl p-3" :aria-labelledby="ids.stripe">
        <div class="flex items-center justify-between gap-2 pl-1">
          <h3 :id="ids.stripe" class="text-base font-semibold">{{ WIDTH_NAMES[chosen.width] }} in {{ colourWords(chosen.role) }}</h3>
          <button
            type="button"
            aria-label="Done with this stripe"
            class="press text-muted-foreground relative flex size-9 items-center justify-center rounded-full after:absolute after:-inset-1"
            @click="deselect"
          >
            <X class="size-5" stroke-width="2.25" />
          </button>
        </div>
        <div role="radiogroup" aria-label="Width" class="bg-card grid grid-cols-4 gap-1 rounded-2xl p-1">
          <button
            v-for="w in WIDTHS"
            :key="w"
            type="button"
            role="radio"
            :aria-checked="chosen.width === w"
            :class="[
              'press flex h-13 flex-col items-center justify-center gap-1.5 rounded-xl text-sm font-semibold',
              chosen.width === w ? 'bg-foreground text-background' : 'text-muted-foreground',
            ]"
            @click="setWidth(w)"
          >
            <span class="h-3.5 rounded-xs bg-current" :style="{ width: `${GLYPH[w]}px` }" aria-hidden="true" />
            {{ WIDTH_NAMES[w] }}
          </button>
        </div>
        <div role="radiogroup" aria-label="Colour" class="grid grid-cols-5 gap-1">
          <button
            v-for="r in ROLES"
            :key="r"
            type="button"
            role="radio"
            :aria-checked="chosen.role === r"
            :aria-label="r === 'K' || r === 'W' ? ROLE_NAMES[r] : `${ROLE_NAMES[r]} (${colourWords(r)})`"
            :class="['press flex flex-col items-center gap-1.5 py-1 text-xs font-semibold', chosen.role === r ? 'text-foreground' : 'text-muted-foreground']"
            @click="setRole(r)"
          >
            <span
              :class="['flex size-10 items-center justify-center rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.14)]', chosen.role === r && 'ring-foreground ring-offset-muted ring-2 ring-offset-2']"
              :style="{ background: palette[r], color: inkOn(palette[r]) }"
            >
              <Check v-if="chosen.role === r" class="size-4" stroke-width="3" aria-hidden="true" />
            </span>
            {{ ROLE_NAMES[r] }}
          </button>
        </div>
        <div class="flex gap-2">
          <Button size="sm" :disabled="chosenIndex <= 0" aria-label="Move left" @click="move(chosenIndex, chosenIndex - 1)"><ArrowLeft /></Button>
          <Button size="sm" :disabled="chosenIndex >= bricks.length - 1" aria-label="Move right" @click="move(chosenIndex, chosenIndex + 1)"><ArrowRight /></Button>
          <Button size="sm" variant="plain" class="text-destructive! ml-auto" :disabled="bricks.length < 2" @click="remove"><Trash2 /> Remove</Button>
        </div>
      </section>

      <section class="space-y-2.5" :aria-labelledby="ids.colours">
        <h3 :id="ids.colours" class="text-heading">Colours</h3>
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="r in (['P', 'S', 'T'] as const)"
            :key="r"
            type="button"
            :aria-expanded="well === r"
            :class="[
              'press flex h-12 min-w-0 items-center gap-2.5 rounded-xl px-3 text-callout font-semibold',
              well === r ? 'bg-blue-paper text-primary shadow-[inset_0_0_0_2px_var(--primary)]' : 'bg-[color-mix(in_oklab,var(--foreground)_6%,transparent)]',
            ]"
            @click="well = well === r ? null : r"
          >
            <span class="size-6 shrink-0 rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.14)]" :style="{ background: wellBg(r) }" aria-hidden="true" />
            <span class="truncate">{{ ROLE_NAMES[r] }}</span>
          </button>
        </div>
        <div v-if="well" role="radiogroup" :aria-label="`${ROLE_NAMES[well]} colour`" class="grid grid-cols-7 gap-2 pt-1">
          <button
            v-for="o in wellOptions"
            :key="o.value"
            type="button"
            role="radio"
            :aria-checked="isOn(o.value)"
            :aria-label="o.label"
            :title="o.label"
            :class="[
              'press flex aspect-square items-center justify-center rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.14)]',
              isOn(o.value) && RING,
            ]"
            :style="{ background: o.bg, color: o.ink }"
            @click="pickColour(o.value)"
          >
            <Check v-if="isOn(o.value)" class="size-4" stroke-width="3" aria-hidden="true" />
          </button>
          <label
            :class="[
              'press has-focus-visible:outline-ring relative flex aspect-square items-center justify-center rounded-full has-focus-visible:outline-3 has-focus-visible:outline-offset-2',
              wellCustom && RING,
            ]"
            :style="{ background: RAINBOW }"
            title="Any colour"
          >
            <span v-if="wellCustom" class="absolute inset-1 flex items-center justify-center rounded-full" :style="{ background: wellCustom, color: inkOn(wellCustom) }">
              <Check class="size-4" stroke-width="3" aria-hidden="true" />
            </span>
            <input
              type="color"
              :value="isCustomColor(wellValue) ? wellValue : palette[well]"
              :aria-label="wellCustom ? 'Any colour, chosen' : 'Any colour'"
              class="absolute inset-0 size-full cursor-pointer rounded-full opacity-0"
              @change="pickAnyColour"
            />
          </label>
        </div>
        <p v-if="!second && !third" class="text-muted-foreground text-sm">Second and Third go with First until you change them.</p>
      </section>

      <section class="space-y-2.5" :aria-labelledby="ids.ideas">
        <h3 :id="ids.ideas" class="text-heading">Ideas</h3>
        <div class="grid grid-cols-4 gap-2">
          <button
            v-for="(bg, i) in ideaTiles"
            :key="i"
            type="button"
            :aria-label="`Idea ${i + 1} of ${ideaTiles.length}`"
            class="press aspect-square rounded-xl shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)]"
            :style="{ background: bg }"
            @click="tryIdea(i)"
          />
        </div>
        <Button size="sm" @click="ideas = remixes(bricks, 8)"><Shuffle /> More ideas</Button>
      </section>

      <!-- Kept in reach at the foot of the sheet. -->
      <div class="bg-raised sticky bottom-0 -mx-4 flex gap-2 border-t px-4 pt-3 pb-[calc(1rem+var(--safe-bottom))]">
        <Button size="lg" :disabled="!history.length" @click="undo"><Undo2 /> Undo</Button>
        <Button size="lg" variant="primary" class="ml-auto" @click="emit('close')">Done</Button>
      </div>
    </div>
  </Dialog>
</template>
