<script setup lang="ts">
import { computed, ref } from 'vue'
import { Minus, Plus, Trash2 } from '@lucide/vue'
import TartanSwatch from '@/components/TartanSwatch.vue'
import { useTartansStore } from '@/stores/tartans'
import { LOOM_COLOURS, parseThreadcount, stripesToTartan, tartanProblem } from '@/lib/tartan'

// Make a tartan that isn't in the list: stripe by stripe from the centre out
// (mirrored, like most tartans), or by typing a threadcount. Drawn, never
// uploaded, so it looks crisp everywhere and there's nothing to moderate
// but the name.
const emit = defineEmits<{ created: [id: string]; cancel: [] }>()
const tartans = useTartansStore()

const name = ref('')
const mode = ref<'stripes' | 'threadcount'>('stripes')
const stripes = ref([
  { code: 'G', count: 32 },
  { code: 'K', count: 8 },
  { code: 'B', count: 24 },
  { code: 'R', count: 4 },
])
const active = ref(0)
const typed = ref('')
const saving = ref(false)
const error = ref<string | null>(null)

const standardPalette = Object.fromEntries(LOOM_COLOURS.map((c) => [c.code, c.hex]))
const draft = computed(() =>
  mode.value === 'stripes'
    ? stripesToTartan(stripes.value)
    : { threadcount: typed.value.trim().toUpperCase(), palette: pickPalette(typed.value) },
)
function pickPalette(tc: string) {
  const codes = parseThreadcount(tc.toUpperCase())?.stripes.map((s) => s.code) ?? []
  return Object.fromEntries(codes.filter((c) => standardPalette[c]).map((c) => [c, standardPalette[c]]))
}
const problem = computed(() => (mode.value === 'threadcount' && !typed.value.trim() ? null : tartanProblem(draft.value)))
const canSave = computed(() => name.value.trim().length >= 2 && !tartanProblem(draft.value))

const labelOf = (code: string) => LOOM_COLOURS.find((c) => c.code === code)?.label ?? code
function bump(i: number, by: number) {
  const s = stripes.value[i]
  s.count = Math.max(2, Math.min(96, s.count + by))
}
function addStripe() {
  stripes.value.push({ code: 'W', count: 4 })
  active.value = stripes.value.length - 1
}
function removeStripe(i: number) {
  stripes.value.splice(i, 1)
  active.value = Math.min(active.value, stripes.value.length - 1)
}

async function save() {
  if (!canSave.value) return
  saving.value = true
  error.value = null
  try {
    const id = await tartans.createCustom({ name: name.value, ...draft.value })
    emit('created', id)
  } catch {
    error.value = 'That didn’t save. Check your connection and try again.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <TartanSwatch :tartan="problem ? null : draft" :scale="0.7" class="h-32 rounded-2xl border shadow-inner" />

    <label class="block space-y-1.5">
      <span class="text-base font-bold">Name</span>
      <input
        v-model="name"
        maxlength="60"
        placeholder="MacKenzie Dress, for example"
        class="bg-card border-strong focus:border-primary h-12 w-full rounded-xl border-2 px-3 text-base outline-none"
      />
    </label>

    <div class="bg-muted flex rounded-xl p-1" role="tablist" aria-label="How to make it">
      <button
        v-for="m in [{ id: 'stripes', label: 'Stripe by stripe' }, { id: 'threadcount', label: 'Threadcount' }] as const"
        :key="m.id"
        type="button"
        role="tab"
        :aria-selected="mode === m.id"
        :class="['h-10 flex-1 rounded-lg text-[0.9375rem] font-bold', mode === m.id ? 'bg-card shadow-sm' : 'text-muted-foreground']"
        @click="mode = m.id"
      >
        {{ m.label }}
      </button>
    </div>

    <template v-if="mode === 'stripes'">
      <p class="text-muted-foreground text-sm">From the centre of the pattern out. It’s mirrored, like most tartans.</p>
      <ol class="bg-card divide-y overflow-hidden rounded-2xl border shadow-sm">
        <li
          v-for="(s, i) in stripes"
          :key="i"
          :class="['flex items-center gap-2 py-1.5 pr-1.5 pl-2', active === i && 'bg-blue-paper']"
        >
          <button
            type="button"
            class="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left"
            :aria-pressed="active === i"
            @click="active = i"
          >
            <span class="size-8 shrink-0 rounded-lg border shadow-inner" :style="{ backgroundColor: stripesToTartan([s]).palette[s.code] }" />
            <span class="truncate text-base font-bold">{{ labelOf(s.code) }}</span>
          </button>
          <button type="button" class="flex size-11 items-center justify-center rounded-full" :aria-label="`Narrower ${labelOf(s.code)} stripe`" @click="bump(i, -2)">
            <Minus class="size-5" />
          </button>
          <span class="w-8 text-center text-base font-bold tabular-nums" :aria-label="`${s.count} threads`">{{ s.count }}</span>
          <button type="button" class="flex size-11 items-center justify-center rounded-full" :aria-label="`Wider ${labelOf(s.code)} stripe`" @click="bump(i, 2)">
            <Plus class="size-5" />
          </button>
          <button
            v-if="stripes.length > 2"
            type="button"
            class="text-muted-foreground flex size-11 items-center justify-center rounded-full"
            :aria-label="`Remove ${labelOf(s.code)} stripe`"
            @click="removeStripe(i)"
          >
            <Trash2 class="size-5" />
          </button>
        </li>
      </ol>
      <div class="space-y-2">
        <p class="text-base font-bold">Colour for stripe {{ active + 1 }}</p>
        <div class="grid grid-cols-8 gap-2" role="radiogroup" :aria-label="`Colour for stripe ${active + 1}`">
          <button
            v-for="c in LOOM_COLOURS"
            :key="c.code"
            type="button"
            role="radio"
            :aria-checked="stripes[active]?.code === c.code"
            :aria-label="c.label"
            :title="c.label"
            :class="[
              'aspect-square rounded-full border shadow-inner',
              stripes[active]?.code === c.code && 'ring-primary ring-offset-card ring-3 ring-offset-2',
            ]"
            :style="{ backgroundColor: c.hex }"
            @click="stripes[active] && (stripes[active].code = c.code)"
          />
        </div>
      </div>
      <button
        v-if="stripes.length < 10"
        type="button"
        class="border-strong flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed text-base font-bold"
        @click="addStripe"
      >
        <Plus class="size-5" /> Add a stripe
      </button>
    </template>

    <template v-else>
      <label class="block space-y-1.5">
        <span class="text-base font-bold">Threadcount</span>
        <textarea
          v-model="typed"
          rows="2"
          autocapitalize="characters"
          spellcheck="false"
          placeholder="G/32 K8 B24 R/4"
          class="bg-card border-strong focus:border-primary w-full rounded-xl border-2 px-3 py-2 font-mono text-base outline-none"
        />
      </label>
      <p class="text-muted-foreground text-sm leading-relaxed">
        Colour letters:
        <span v-for="(c, i) in LOOM_COLOURS" :key="c.code">{{ c.code }} {{ c.label.toLowerCase() }}{{ i < LOOM_COLOURS.length - 1 ? ', ' : '.' }}</span>
        A slash marks the pivot, like R/8.
      </p>
    </template>

    <p v-if="problem" class="text-base font-semibold">{{ problem }}</p>
    <p class="text-muted-foreground text-sm">
      You’ll see it straight away. Everyone else sees it once it’s been checked.
    </p>
    <p v-if="error" class="text-destructive text-base font-semibold" role="alert">{{ error }}</p>
    <button
      type="button"
      class="bg-primary text-primary-foreground h-12 w-full rounded-xl text-base font-bold disabled:opacity-50"
      :disabled="!canSave || saving"
      @click="save"
    >
      {{ saving ? 'Saving…' : 'Save tartan' }}
    </button>
    <button type="button" class="text-muted-foreground h-11 w-full text-[0.9375rem] font-bold" @click="emit('cancel')">
      Back to the list
    </button>
  </div>
</template>
