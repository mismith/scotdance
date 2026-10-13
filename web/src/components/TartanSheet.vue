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
  BLACK,
  MAX_STRIPES,
  PRESETS,
  SWATCHES,
  WHITE,
  WIDTHS,
  WIDTH_NAMES,
  clothHex,
  clothImage,
  codeFor,
  companionsOf,
  formatSett,
  paletteOf,
  parseSett,
  remixes,
  settle,
  swatchName,
  tidy,
  weavePreset,
  type Hex,
  type Stripe,
  type Tartan,
  type Width,
} from '@/lib/tartan'
import { inkOn, isCustomColor, isTartan, useDancerColorsStore, type DancerColor } from '@/stores/dancerColors'

// Customise: the loom for a followed dancer's tartan. Bricks along the top
// are the stripes from the middle out; the cloth below is woven from them,
// mirrored and the same across and down. Tap a brick (or a stripe on the
// cloth) to swap its piece for another width, paint it (black, white, any
// swatch, or any colour at all), move it or remove it; drag bricks to
// reorder; + adds one. Every change is saved as it's made, as the colour dots
// are, so the dancer's look updates everywhere at once, and Undo (in the
// header, in reach wherever you've scrolled) steps back through this visit's
// changes. It closes like any sheet.
// Opened on a plain colour, it shows the first pattern woven in it, but the
// dancer stays plain until something's changed (and Undo can take them back).
const props = defineProps<{ open: boolean; morph?: Morph; dancerId: string; dancerName: string }>()
const emit = defineEmits<{ close: [] }>()

const following = useFollowing()
const store = useDancerColorsStore()
const first = computed(() => props.dancerName.split(' ')[0] || 'This dancer')

const GLYPH: Record<Width, number> = { 2: 3, 6: 7, 16: 13, 40: 24 }
const RING = 'ring-foreground ring-offset-muted ring-2 ring-offset-2'
const RAINBOW = 'conic-gradient(#e11d48, #f59e0b, #eab308, #16a34a, #0891b2, #2563eb, #7c3aed, #db2777, #e11d48)'

// The tartan as it is in this sheet. The store hears about each change a
// moment later; this stays the source while the sheet is open.
const bricks = ref<Brick[]>([])
const colors = ref<Record<string, Hex>>({})
const color = ref<DancerColor>('dancer-1')
const selected = ref<number | null>(null)
const preview = ref<Brick[] | null>(null)
// Ideas keep the colours they were drawn in, so painting a stripe later
// can't leave one with a colour the tartan no longer has.
const ideas = ref<Array<{ stripes: Stripe[]; colors: Record<string, Hex> }>>([])
// Still the plain colour they had when the sheet opened: nothing saved yet.
const plain = ref(false)
const rail = useTemplateRef<InstanceType<typeof TartanRail>>('rail')
const ids = { stripe: useId(), ideas: useId() }

let nextId = 1
const toBricks = (stripes: readonly Stripe[]): Brick[] => stripes.map((s) => ({ code: s.code, width: s.width, id: nextId++ }))

interface Snapshot { bricks: Brick[]; colors: Record<string, Hex>; color: DancerColor; plain: boolean }
const history = ref<Snapshot[]>([])
const snapshot = (): Snapshot => ({
  bricks: bricks.value.map((b) => ({ ...b })),
  colors: { ...colors.value },
  color: color.value,
  plain: plain.value,
})

const tartan = (painted?: Hex): Tartan => settle(tidy({ color: color.value, sett: formatSett(bricks.value), colors: colors.value }), painted)
const palette = computed(() => paletteOf({ colors: colors.value }))
const chosen = computed(() => bricks.value.find((b) => b.id === selected.value) ?? null)
const chosenIndex = computed(() => bricks.value.findIndex((b) => b.id === selected.value))
const chosenHex = computed(() => (chosen.value ? (palette.value[chosen.value.code] ?? BLACK) : null))
/** A stripe's colour in words: its name, or "your own colour" for one picked from the rainbow. */
const colourWords = (hex: string) => swatchName(hex)?.toLowerCase() ?? 'your own colour'

// (A write the database refuses says so; offline, it waits and saves later.)
function write(look: Tartan | DancerColor) {
  store.choose(props.dancerId, look).catch(() => toast('That didn’t save. Try again in a moment.', { tone: 'error' }))
}
function save() {
  plain.value = false
  write(tartan())
}
function change(fn: () => void, painted?: Hex) {
  history.value.push(snapshot())
  fn()
  // Colours no stripe wears any more are let go, so their letters can be
  // reused, and the dancer's colour follows the cloth.
  const t = tartan(painted)
  colors.value = t.colors
  color.value = t.color
  save()
}

// Opening (or a different dancer under an open sheet): the tartan they wear,
// or the first pattern woven in their colour.
watch(
  () => [props.open, props.dancerId] as const,
  ([open]) => {
    if (!open) return
    const look = following.lookFor(props.dancerId)
    const t: Tartan = isTartan(look) ? look : weavePreset(PRESETS[0].sett, following.colorIdFor(props.dancerId) ?? 'dancer-1')
    color.value = t.color
    colors.value = { ...t.colors }
    bricks.value = toBricks(parseSett(t.sett) ?? [])
    history.value = []
    selected.value = null
    preview.value = null
    drawIdeas()
    plain.value = !isTartan(look)
  },
  { immediate: true },
)

function undo() {
  const s = history.value.pop()
  if (!s) return
  bricks.value = s.bricks
  colors.value = s.colors
  color.value = s.color
  if (!bricks.value.some((b) => b.id === selected.value)) selected.value = null
  if (!s.plain) return save()
  plain.value = true
  write(color.value)
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
  // A stripe in the colour that goes with theirs, so it shows up at once.
  const next = { ...colors.value }
  const [b] = toBricks([{ code: codeFor(next, companionsOf(color.value)[0]), width: 6 }])
  change(() => {
    colors.value = next
    bricks.value.push(b!)
  })
  selected.value = b!.id
}
function setWidth(w: Width) {
  if (!chosen.value || chosen.value.width === w) return
  selectionHaptic()
  change(() => (chosen.value!.width = w))
}
function paint(hex: Hex) {
  const b = chosen.value
  if (!b || hex.toLowerCase() === chosenHex.value?.toLowerCase()) return
  selectionHaptic()
  change(() => {
    const next = { ...colors.value }
    b.code = codeFor(next, hex)
    colors.value = next
  }, hex)
}
function paintAny(e: Event) {
  const hex = (e.target as HTMLInputElement).value.toLowerCase()
  if (isCustomColor(hex)) paint(hex)
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

// What a stripe can be painted: black and white, then every swatch, then any
// colour of your own already in this tartan (or the dancer's own, if it's one
// of yours), then the rainbow for anything else.
const swatches = computed(() => {
  const list = SWATCHES.map((s) => ({ hex: s.hex, label: s.label }))
  const own = [...Object.values(colors.value), clothHex(color.value)]
  for (const hex of own)
    if (!list.some((s) => s.hex.toLowerCase() === hex.toLowerCase()) && !swatchName(hex)) list.push({ hex, label: 'Your own colour' })
  return list
})
const isOn = (hex: string) => hex.toLowerCase() === chosenHex.value?.toLowerCase()
const ownChosen = computed(() => !!chosenHex.value && !swatches.value.some((s) => isOn(s.hex)) && !isOn(BLACK) && !isOn(WHITE))

// Ideas: remixes of the pattern as it was when they were drawn. They stay
// put until More ideas, so trying one doesn't shuffle the rest away.
function drawIdeas() {
  ideas.value = remixes(bricks.value, 8).map((stripes) => ({ stripes, colors: { ...colors.value } }))
}
const ideaTiles = computed(() =>
  ideas.value.map((i) => clothImage({ sett: formatSett(i.stripes), colors: i.colors }, 76) ?? clothHex(color.value)),
)
function tryIdea(i: number) {
  const idea = ideas.value[i]
  if (!idea) return
  selectionHaptic()
  const was = paletteOf(idea)
  change(() => {
    const next = { ...colors.value }
    bricks.value = toBricks(idea.stripes.map((s) => ({ code: codeFor(next, was[s.code] ?? BLACK), width: s.width })))
    colors.value = next
  })
  selected.value = null
}
</script>

<template>
  <!-- (Named here, so the header's Undo isn't part of its name.) -->
  <Dialog :open="open" :morph="morph" variant="sheet" size="md" :aria-label="`${first}’s tartan`" @close="emit('close')">
    <template #header>
      <div class="flex items-center gap-2">
        <h2 class="text-title min-w-0 flex-1 truncate">{{ first }}’s tartan</h2>
        <Button size="sm" variant="plain" :disabled="!history.length" @click="undo"><Undo2 /> Undo</Button>
      </div>
    </template>
    <!-- (Left-aligned: it opens from inside a centred page header.) -->
    <div class="space-y-5 px-4 pt-4 pb-[calc(1.5rem+var(--safe-bottom))] text-left">
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
      <section v-if="chosen && chosenHex" class="bg-muted space-y-3 rounded-2xl p-3" :aria-labelledby="ids.stripe">
        <div class="flex items-center justify-between gap-2 pl-1">
          <h3 :id="ids.stripe" class="text-base font-semibold">{{ WIDTH_NAMES[chosen.width] }} in {{ colourWords(chosenHex) }}</h3>
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
        <div role="radiogroup" aria-label="Colour" class="space-y-2.5">
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="n in [{ hex: BLACK, label: 'Black' }, { hex: WHITE, label: 'White' }]"
              :key="n.hex"
              type="button"
              role="radio"
              :aria-checked="isOn(n.hex)"
              :class="[
                'press bg-card flex h-11 items-center gap-2.5 rounded-full pr-4 pl-1.5 text-callout font-semibold shadow-(--shadow-card)',
                isOn(n.hex) && 'shadow-[0_0_0_2px_var(--foreground)]',
              ]"
              @click="paint(n.hex)"
            >
              <span
                class="flex size-8 shrink-0 items-center justify-center rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.14)]"
                :style="{ background: n.hex, color: inkOn(n.hex) }"
              >
                <Check v-if="isOn(n.hex)" class="size-4" stroke-width="3" aria-hidden="true" />
              </span>
              {{ n.label }}
            </button>
          </div>
          <div class="grid grid-cols-6 gap-2">
            <button
              v-for="s in swatches"
              :key="s.hex"
              type="button"
              role="radio"
              :aria-checked="isOn(s.hex)"
              :aria-label="s.label"
              :title="s.label"
              :class="['press flex aspect-square items-center justify-center rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.14)]', isOn(s.hex) && RING]"
              :style="{ background: s.hex, color: inkOn(s.hex) }"
              @click="paint(s.hex)"
            >
              <Check v-if="isOn(s.hex)" class="size-4" stroke-width="3" aria-hidden="true" />
            </button>
            <!-- The input covers the dot, so a tap lands on it directly (the
                 most reliable way to open the picker in iOS and Android WebViews). -->
            <label
              :class="[
                'press has-focus-visible:outline-ring relative flex aspect-square items-center justify-center rounded-full has-focus-visible:outline-3 has-focus-visible:outline-offset-2',
                ownChosen && RING,
              ]"
              :style="{ background: RAINBOW }"
              title="Any colour"
            >
              <span v-if="ownChosen" class="absolute inset-1 flex items-center justify-center rounded-full" :style="{ background: chosenHex, color: inkOn(chosenHex as Hex) }">
                <Check class="size-4" stroke-width="3" aria-hidden="true" />
              </span>
              <input
                type="color"
                :value="chosenHex"
                aria-label="Any colour"
                class="absolute inset-0 size-full cursor-pointer rounded-full opacity-0"
                @change="paintAny"
              />
            </label>
          </div>
        </div>
        <div class="flex gap-2">
          <Button size="sm" :disabled="chosenIndex <= 0" aria-label="Move left" @click="move(chosenIndex, chosenIndex - 1)"><ArrowLeft /></Button>
          <Button size="sm" :disabled="chosenIndex >= bricks.length - 1" aria-label="Move right" @click="move(chosenIndex, chosenIndex + 1)"><ArrowRight /></Button>
          <Button size="sm" variant="plain" class="text-destructive! ml-auto" :disabled="bricks.length < 2" @click="remove"><Trash2 /> Remove</Button>
        </div>
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
        <Button size="sm" @click="drawIdeas"><Shuffle /> More ideas</Button>
      </section>
    </div>
  </Dialog>
</template>
