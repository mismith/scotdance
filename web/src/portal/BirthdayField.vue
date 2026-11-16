<script setup lang="ts">
// Parity: also inspect mismith/scotdance-entries/src/ui/BirthdayField.vue when changing behavior. See ./AGENTS.md.
import { computed, nextTick, ref, useId, watch } from 'vue'
import { daysInMonth } from './profileFields'
import Popover from './Popover.vue'

/**
 * A birthday ('YYYY-MM-DD', '' for not set) picked by drilling down: decade, year, month, day. Decades read in
 * order, oldest first, like a calendar. All the maths is on numbers and strings; a Date is only built to find which
 * weekday a month starts on, so nothing shifts with the time zone.
 */
const props = defineProps<{ modelValue: string; label: string; id?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

// Keep birthday typing behavior aligned with the other app's BirthdayField.vue.
function formatBirthday(raw: string, finish = false) {
  const separated = /^(\d{4})\D+(\d{1,2})\D+(\d{1,2})$/.exec(raw.trim())
  if (separated && (finish || separated[3]!.length === 2)) return `${separated[1]}-${separated[2]!.padStart(2, '0')}-${separated[3]!.padStart(2, '0')}`
  const month = /^(\d{4})\D+(\d{1,2})\D+$/.exec(raw)
  if (month) return `${month[1]}-${month[2]!.padStart(2, '0')}-`
  if (/^\d{4}\D+$/.test(raw)) return raw.slice(0, 4) + '-'
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  return [digits.slice(0, 4), digits.slice(4, 6), digits.slice(6, 8)].filter(Boolean).join('-')
}
function typeBirthday(event: Event) {
  const target = event.target as HTMLInputElement
  const cursor = target.selectionStart ?? target.value.length
  const atEnd = cursor === target.value.length
  let raw = target.value
  if ((event as InputEvent).inputType === 'deleteContentBackward' && /[-/]/.test(props.modelValue[cursor] || '') && cursor > 0)
    raw = raw.slice(0, cursor - 1) + raw.slice(cursor)
  const formatted = formatBirthday(raw, ['insertFromPaste', 'insertReplacementText'].includes((event as InputEvent).inputType))
  const before = raw.slice(0, cursor).replace(/\D/g, '').length
  let position = 0, seen = 0
  while (position < formatted.length && seen < before) { if (/\d/.test(formatted[position]!)) seen++; position++ }
  target.value = formatted
  emit('update:modelValue', formatted)
  void nextTick(() => target.setSelectionRange(atEnd ? formatted.length : position, atEnd ? formatted.length : position))
}
function settleBirthday() { touched.value = true; emit('update:modelValue', formatBirthday(props.modelValue, true)) }

const auto = useId()
const fieldId = computed(() => props.id ?? auto)
const open = ref(false)
const input = ref<HTMLInputElement>()
const touched = ref(false)

// Float above the form at every viewport size; never expand the dancer sheet.
const root = ref<HTMLElement>()
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const FULL_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const pad = (n: number) => String(n).padStart(2, '0')

const now = new Date()
const thisYear = now.getFullYear()
const thisMonth = now.getMonth() + 1
const today = now.getDate()
const FIRST_DECADE = Math.floor((thisYear - 120) / 10) * 10
const decades = Array.from(
  { length: Math.floor((thisYear - FIRST_DECADE) / 10) + 1 },
  (_, i) => FIRST_DECADE + i * 10,
)

type Level = 'decade' | 'year' | 'month' | 'day'
const level = ref<Level>('decade')
const decade = ref(0)
const year = ref(0)
const month = ref(0)

const chosen = computed(() => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(props.modelValue)
  if (!m) return null
  const [y, month, d] = m.slice(1).map(Number) as [number, number, number]
  return y > 0 && month >= 1 && month <= 12 && d >= 1 && d <= daysInMonth(y, month)
    ? { y, m: month, d }
    : null
})
const birthdayProblem = computed(() => {
  if (!props.modelValue) return ''
  if (!chosen.value) return 'Enter a valid birthday as YYYY-MM-DD.'
  if (props.modelValue > `${thisYear}-${pad(thisMonth)}-${pad(today)}`)
    return 'Birthday cannot be in the future.'
  if (chosen.value.y < thisYear - 120) return 'Enter a birthday within the last 120 years.'
  return ''
})
watch([input, birthdayProblem], () => input.value?.setCustomValidity(birthdayProblem.value), {
  flush: 'post',
})

const years = computed(() => Array.from({ length: 10 }, (_, i) => decade.value + i))
const blanks = computed(() => new Date(year.value, month.value - 1, 1).getDay())
const dayCount = computed(() => (year.value && month.value ? daysInMonth(year.value, month.value) : 0))

const yearOk = (y: number) => y <= thisYear && y >= thisYear - 120
const monthOk = (m: number) => year.value < thisYear || m <= thisMonth
const dayOk = (d: number) => year.value < thisYear || month.value < thisMonth || d <= today

const crumbs = computed(() => {
  const list: Array<{ level: Level; text: string }> = [{ level: 'decade', text: 'Decades' }]
  if (level.value !== 'decade') list.push({ level: 'year', text: `${decade.value}s` })
  if (level.value === 'month' || level.value === 'day')
    list.push({ level: 'month', text: String(year.value) })
  if (level.value === 'day') list.push({ level: 'day', text: MONTHS[month.value - 1]! })
  return list
})

watch(open, (isOpen) => {
  if (!isOpen) return
  const c = chosen.value
  if (c) {
    decade.value = Math.floor(c.y / 10) * 10
    year.value = c.y
    month.value = c.m
    level.value = 'day'
  } else level.value = 'decade'
  focusSoon()
})

const cells = ref<HTMLElement>()
async function focusSoon() {
  await nextTick()
  requestAnimationFrame(() => {
    const list = cells.value
    const target =
      list?.querySelector<HTMLElement>('[aria-pressed="true"]:not(:disabled)') ??
      list?.querySelector<HTMLElement>('button:not(:disabled)')
    target?.focus({ preventScroll: true })
  })
}
function goTo(next: Level) {
  level.value = next
  focusSoon()
}
function pickDecade(value: number) {
  decade.value = value
  goTo('year')
}
function pickYear(value: number) {
  year.value = value
  goTo('month')
}
function pickMonth(value: number) {
  month.value = value
  goTo('day')
}
function pickDay(value: number) {
  emit('update:modelValue', `${year.value}-${pad(month.value)}-${pad(value)}`)
  open.value = false
  nextTick(() => root.value?.querySelector<HTMLButtonElement>('.trigger')?.focus())
}
// Back one level from the keyboard, as Backspace does in a drill-down
function back() {
  const order: Level[] = ['decade', 'year', 'month', 'day']
  const i = order.indexOf(level.value)
  if (i > 0) goTo(order[i - 1]!)
}

const columns = computed(() => ({ decade: 3, year: 5, month: 3, day: 7 })[level.value])
// Arrow keys move between the cells of the grid; a blank day is skipped over
function move(event: KeyboardEvent) {
  const delta: Record<string, number> = {
    ArrowLeft: -1,
    ArrowRight: 1,
    ArrowUp: -columns.value,
    ArrowDown: columns.value,
  }
  if (event.key === 'Backspace') {
    event.preventDefault()
    return back()
  }
  const step = delta[event.key]
  if (!step) return
  const all = Array.from(cells.value?.children ?? []) as HTMLElement[]
  let i = all.indexOf(event.target as HTMLElement)
  if (i < 0) return
  event.preventDefault()
  for (;;) {
    i += step
    const next = all[i]
    if (!next) return
    if (next instanceof HTMLButtonElement && !next.disabled) return next.focus()
  }
}

const title = computed(() => `${props.label}`)
</script>

<template>
  <div ref="root" class="bf">
    <label :for="fieldId">{{ label }}</label>
    <Popover v-model:open="open" :title="title" :width="332">
      <template #anchor>
        <div class="birthday-control">
          <input
            :id="fieldId"
            ref="input"
            :value="modelValue"
            class="field num h-12 w-full rounded-xl px-3 text-base"
            type="text"
            placeholder="YYYY-MM-DD"
            name="bday"
            autocomplete="section-dancer bday"
            maxlength="16"
            inputmode="numeric"
            :aria-invalid="touched && !!birthdayProblem"
            :aria-describedby="touched && birthdayProblem ? `${fieldId}-problem` : undefined"
            @click.stop
            @keydown.down.stop.prevent="open = true"
            @blur="settleBirthday"
            @invalid="touched = true"
            @input="typeBirthday"
          />
          <button type="button" class="trigger" :aria-expanded="open" aria-haspopup="dialog" :aria-label="`Choose ${label.toLowerCase()}`">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
              <path d="M3.5 10h17M8 3v4M16 3v4" />
            </svg>
          </button>
        </div>
      </template>
      <div class="body">
        <nav class="crumbs" aria-label="Birthday steps">
          <template v-for="(c, i) in crumbs" :key="c.level">
            <svg v-if="i" class="sep" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path d="M9.5 6l6 6-6 6" />
            </svg>
            <span v-if="i === crumbs.length - 1" class="here" aria-current="step">{{ c.text }}</span>
            <button v-else type="button" class="crumb" @click="goTo(c.level)">{{ c.text }}</button>
          </template>
        </nav>

        <div
          ref="cells"
          class="cells"
          :class="level"
          role="group"
          :aria-label="crumbs.at(-1)?.text"
          @keydown="move"
        >
          <template v-if="level === 'decade'">
            <button
              v-for="d in decades"
              :key="d"
              type="button"
              class="cell num"
              :aria-pressed="chosen ? Math.floor(chosen.y / 10) * 10 === d : false"
              @click="pickDecade(d)"
            >
              {{ d }}s
            </button>
          </template>
          <template v-else-if="level === 'year'">
            <button
              v-for="y in years"
              :key="y"
              type="button"
              class="cell num"
              :aria-pressed="chosen?.y === y"
              :disabled="!yearOk(y)"
              @click="pickYear(y)"
            >
              {{ y }}
            </button>
          </template>
          <template v-else-if="level === 'month'">
            <button
              v-for="(name, i) in MONTHS"
              :key="name"
              type="button"
              class="cell"
              :aria-label="FULL_MONTHS[i]"
              :aria-pressed="chosen?.y === year && chosen?.m === i + 1"
              :disabled="!monthOk(i + 1)"
              @click="pickMonth(i + 1)"
            >
              {{ name }}
            </button>
          </template>
          <template v-else>
            <span v-for="(d, i) in DAYS" :key="'h' + i" class="dow" aria-hidden="true">{{ d }}</span>
            <span v-for="n in blanks" :key="'b' + n" />
            <button
              v-for="d in dayCount"
              :key="d"
              type="button"
              class="cell day num"
              :aria-label="`${d} ${FULL_MONTHS[month - 1]} ${year}`"
              :aria-pressed="chosen?.y === year && chosen?.m === month && chosen?.d === d"
              :disabled="!dayOk(d)"
              @click="pickDay(d)"
            >
              {{ d }}
            </button>
          </template>
        </div>
      </div>
    </Popover>
    <p v-if="touched && birthdayProblem" :id="`${fieldId}-problem`" class="birthday-problem" role="alert">
      {{ birthdayProblem }}
    </p>
  </div>
</template>

<style scoped>
.bf label {
  display: block;
}
.birthday-control {
  position: relative;
  margin-top: 6px;
}
.birthday-control input {
  padding-right: 44px;
}
.birthday-problem {
  color: var(--destructive);
  font-size: 14px;
  margin: 4px 0;
}
.trigger {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  right: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 44px;
  border: 0;
  border-radius: 8px;
  background: none;
  cursor: pointer;
}
.trigger svg {
  flex: none;
  fill: none;
  stroke: var(--muted-foreground);
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.trigger:focus-visible {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 4px var(--ring);
}
.body {
  display: grid;
  gap: 12px;
  min-width: 0;
}
.crumbs {
  padding-right: 36px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px;
  min-height: 40px;
  font-size: 16px;
}
.crumb,
.here {
  display: inline-flex;
  align-items: center;
  min-height: 40px;
  padding: 0 8px;
  border: 0;
  border-radius: 10px;
  font: inherit;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--foreground);
  background: none;
}
.crumb {
  font-weight: 600;
  color: var(--muted-foreground);
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}
.crumb:hover {
  color: var(--foreground);
  background: var(--blue-paper);
}
.sep {
  flex: none;
  fill: none;
  stroke: var(--muted-foreground);
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.cells {
  display: grid;
  gap: 6px;
  justify-items: stretch;
}
.cells.decade,
.cells.month {
  grid-template-columns: repeat(3, 1fr);
}
.cells.year {
  grid-template-columns: repeat(5, 1fr);
}
.cells.day {
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  justify-items: center;
}
.cell {
  min-height: 48px;
  padding: 0 6px;
  border: 0;
  border-radius: 14px;
  font-size: 17px;
  font-weight: 600;
  color: var(--foreground);
  background: var(--blue-paper);
  cursor: pointer;
  transition: background-color 0.15s;
}
.cell:hover:not(:disabled):not([aria-pressed='true']) {
  background: var(--border);
}
.cell[aria-pressed='true'] {
  color: var(--primary-foreground);
  background: var(--primary-fill);
}
.cell:disabled {
  opacity: 0.3;
  cursor: default;
}
.cells.year .cell {
  font-size: 15.5px;
  padding: 0;
}
.cells.day .cell {
  width: min(40px, 100%);
  min-height: 40px;
  padding: 0;
  border-radius: 50%;
  font-size: 16px;
  background: none;
}
.cells.day .cell:hover:not(:disabled):not([aria-pressed='true']) {
  background: var(--blue-paper);
}
.dow {
  display: grid;
  place-items: center;
  height: 28px;
  font-size: 13px;
  font-weight: 700;
  color: var(--muted-foreground);
}
.cell:focus-visible,
.crumb:focus-visible {
  outline: 3px solid var(--primary);
  outline-offset: 2px;
}
</style>
