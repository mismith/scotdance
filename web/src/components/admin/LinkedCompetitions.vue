<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ChevronDown, ChevronRight, Ellipsis, Link2, Plus, RefreshCw, Star, Unlink } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import CompetitionName from '@/components/CompetitionName.vue'
import DateTile from '@/components/DateTile.vue'
import Dialog from '@/components/Dialog.vue'
import SwitchField from '@/components/admin/SwitchField.vue'
import LinkCompetitionSheet from '@/components/admin/LinkCompetitionSheet.vue'
import { useManagedCompetition } from '@/composables/admin/useManagedCompetition'
import { useLinkSync, useLinkedSet } from '@/composables/useCompetitionLinks'
import { changeLink, previewLink, type PartPreview } from '@/lib/admin/links'
import { confirm, toast } from '@/lib/admin/feedback'
import { canEdit, friendlyError } from '@/lib/admin/write'
import { replacesSentence } from '@/lib/admin/linkWords'
import { formatDateSpan, formatWeekday, parseDate } from '@/lib/format'
import { LINK_PARTS, LINK_PART_IDS, linkPartLabel, type LinkPart } from '@/lib/linked'
import { useMorph } from '@/lib/morph'
import { useMeStore } from '@/stores/me'
import type { CompetitionListItem } from '@/composables/useCompetitions'

// Manage › Details › Linked competitions (ADR 0007 §7). Competitions that go
// together (a weekend's two, a week's seven) are linked here. One is the main
// one (the primary): the others share its details and staff, and functions
// keep them in step. The section is one list, with a tag only where something
// differs, and one "Shared" row that opens the switches. What's rarely done
// (making another the main one, sharing again, taking one out) is in the ···
// menu.
const m = useManagedCompetition()
const me = useMeStore()
const id = computed(() => m.competitionId.value)
const { set, members, primary } = useLinkedSet(id)
const { takes, partsOf } = useLinkSync()

const linked = computed(() => !!set.value)
const isMain = computed(() => linked.value && primary.value === id.value)
const others = computed(() => members.value.filter((c) => c.id !== id.value))
const mainRecord = computed(() => members.value.find((c) => c.id === primary.value) ?? null)
const mainName = computed(() => mainRecord.value?.name?.trim() || 'the main one')
const span = computed(() => formatDateSpan(members.value.map((c) => c.date)))

// One of the others, briefly: its weekday when they're all within a week
// ("Sunday has its own"), else its name.
const withinAWeek = computed(() => {
  const days = members.value.map((c) => (c.date ? parseDate(c.date).getTime() : NaN)).filter((t) => !Number.isNaN(t))
  return days.length > 1 && Math.max(...days) - Math.min(...days) < 7 * 86_400_000
})
const shortName = (c: CompetitionListItem) => (withinAWeek.value && c.date ? formatWeekday(c.date) : c.name?.trim() || 'One')

/** The parts shared: on the main one, those any other shares; on another, its own. */
const shared = computed<LinkPart[]>(() =>
  isMain.value ? LINK_PART_IDS.filter((p) => others.value.some((o) => takes(o.id, p))) : partsOf(id.value),
)
const sharedSummary = computed(() => {
  const on = shared.value
  if (on.length === LINK_PART_IDS.length) return 'Everything'
  if (!on.length) return 'Nothing'
  const off = LINK_PARTS.filter((p) => !on.includes(p.id))
  return off.length <= 2 ? `All but ${off.map((p) => p.label).join(' and ')}` : `${on.length} of ${LINK_PART_IDS.length}`
})

/** A row's tag: Main, or what it keeps of its own; nothing when it shares everything. */
function tagOf(c: CompetitionListItem): { text: string; tone: 'main' | 'own' } | null {
  if (c.id === primary.value) return { text: 'Main', tone: 'main' }
  if (!primary.value) return null
  const own = LINK_PARTS.filter((p) => !takes(c.id, p.id))
  if (!own.length) return null
  if (own.length === LINK_PARTS.length) return { text: 'Shares nothing', tone: 'own' }
  return { text: own.length <= 2 ? `Own ${own.map((p) => p.own).join(' and ')}` : 'Shares some', tone: 'own' }
}

/** On the main one's switches: which of the others keep that part their own. */
function ownNote(part: LinkPart) {
  if (!isMain.value) return null
  const own = others.value.filter((o) => !takes(o.id, part))
  if (!own.length || own.length === others.value.length) return null
  return own.length === 1 ? `${shortName(own[0])} has its own` : `${own.length} have their own`
}

/** Confirms what sharing a part (or a new main one) would replace; true to go ahead. */
async function confirmReplacing(previews: Array<{ competitionId: string; parts: PartPreview[] }>, from: string, title: string, confirmLabel: string) {
  const blocked = previews.flatMap((t) => t.parts.filter((p) => p.blocked))
  if (blocked.length) {
    toast(blocked[0].blocked!, { tone: 'error' })
    return false
  }
  const lines = previews.flatMap((t) => {
    const c = members.value.find((x) => x.id === t.competitionId)
    return t.parts.filter((p) => p.replaces).map((p) => replacesSentence(c ? shortName(c) : 'One', p, from))
  })
  if (!lines.length) return true
  return confirm({ title, message: lines.join('\n'), confirmLabel })
}

const busy = ref(false)
async function run(fn: () => Promise<unknown>) {
  if (busy.value) return
  busy.value = true
  try {
    await fn()
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  } finally {
    busy.value = false
  }
}

/** A part's switch: on the main one, for all the others; else for this one. */
async function setPart(part: LinkPart, on: boolean) {
  if (busy.value) return
  busy.value = true
  try {
    await savePart(part, on)
  } finally {
    busy.value = false
  }
}
async function savePart(part: LinkPart, on: boolean) {
  const label = linkPartLabel(part)
  if (on) {
    const preview = await previewLink({ action: 'sync', competitionId: id.value, part, on: true })
    const ok = await confirmReplacing(
      preview.targets,
      mainName.value,
      isMain.value ? `Share ${label} with the others?` : `Share ${label} from ${mainName.value}?`,
      'Share it',
    )
    if (!ok) return
  }
  await changeLink({ action: 'sync', competitionId: id.value, part, on })
  toast(on ? `${label}: shared` : isMain.value ? `${label}: each one’s own now` : `${label}: its own now`)
}

const menu = useMorph()
const sheet = useMorph()
const picking = useMorph()
const showAll = ref(false)

const makeMain = () =>
  run(async () => {
    menu.dismiss()
    const preview = await previewLink({ action: 'primary', competitionId: id.value })
    const replacing = preview.targets.some((t) => t.parts.some((p) => p.replaces))
    const ok = replacing
      ? await confirmReplacing(preview.targets, m.competition.value?.name?.trim() || 'this one', 'Make this the main one?', 'Make it the main one')
      : await confirm({ title: 'Make this the main one?', message: 'The others then share from this one.', confirmLabel: 'Make it the main one' })
    if (!ok) return
    await changeLink({ action: 'primary', competitionId: id.value })
    toast('This one is the main one now')
  })

const shareAgain = () =>
  run(async () => {
    menu.dismiss()
    await changeLink({ action: 'syncNow', competitionId: id.value })
    toast('Shared again')
  })

const takeOut = () =>
  run(async () => {
    menu.dismiss()
    const ok = await confirm({
      title: 'Take it out of the link?',
      message: isMain.value
        ? 'This one keeps everything it has. The others stop sharing from it until one of them is made the main one.'
        : 'It keeps everything it has. Families won’t see it with the others any more.',
      confirmLabel: 'Take it out',
      destructive: true,
    })
    if (!ok) return
    await changeLink({ action: 'unlink', competitionId: id.value })
    toast('Taken out of the link')
  })

const to = (c: CompetitionListItem) =>
  me.hasCompetitionPerm(c.id) ? { name: 'manage.details', params: { competitionId: c.id } } : { name: 'competition.info', params: { competitionId: c.id } }

const MENU_ROW = 'press-row focus-inset flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-base font-medium disabled:opacity-(--disabled-opacity)'
const ROW = 'press-row focus-inset flex min-h-14 w-full items-center gap-3 border-t px-4 text-left'
const TAG = { main: 'bg-blue-paper text-primary', own: 'bg-next text-next-foreground' }
</script>

<template>
  <section id="linked" class="scroll-mt-(--chrome-top) space-y-3">
    <div class="flex items-center justify-between gap-2">
      <h2 class="text-heading">Linked competitions</h2>
      <button
        v-if="linked"
        type="button"
        class="press text-muted-foreground -my-2 -mr-2 flex size-11 items-center justify-center rounded-full"
        aria-label="More for linked competitions"
        @click="menu.show($event)"
      >
        <Ellipsis class="size-5" />
      </button>
    </div>

    <!-- Not linked yet -->
    <template v-if="!linked">
      <p class="text-muted-foreground text-sm">For a weekend’s or a week’s competitions: families jump between them, and you set them up once.</p>
      <Button :disabled="!canEdit" @click="picking.show($event)"><Link2 /> Link a competition</Button>
    </template>

    <!-- The main one: every competition, a tag where one differs -->
    <div v-else-if="isMain" class="surface overflow-hidden rounded-2xl">
      <ul class="rows-inset [--inset:4.5rem]">
        <li v-for="c in members" :key="c.id">
          <component
            :is="c.id === id ? 'div' : RouterLink"
            v-bind="c.id === id ? {} : { to: to(c) }"
            :class="['flex min-h-15 items-center gap-3 py-2 pr-3 pl-4', c.id !== id && 'press-row focus-inset']"
          >
            <DateTile :date="c.date" />
            <span class="min-w-0 flex-1 truncate text-base font-semibold"><CompetitionName :competition="c" /></span>
            <span v-if="tagOf(c)" :class="['shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold', TAG[tagOf(c)!.tone]]">{{ tagOf(c)!.text }}</span>
          </component>
        </li>
      </ul>
      <button type="button" :class="ROW" @click="sheet.show($event)">
        <span class="flex-1 text-base font-semibold">Shared with the others</span>
        <span class="text-muted-foreground text-callout">{{ sharedSummary }}</span>
        <ChevronRight class="text-muted-foreground size-5 shrink-0" aria-hidden="true" />
      </button>
      <button type="button" :class="[ROW, 'text-primary text-callout font-semibold disabled:opacity-(--disabled-opacity)']" :disabled="!canEdit" @click="picking.show($event)">
        <Plus class="size-5" aria-hidden="true" /> Link a competition
      </button>
    </div>

    <!-- One of the others: its main one, what it shares, and the rest on asking -->
    <div v-else class="surface overflow-hidden rounded-2xl">
      <RouterLink v-if="mainRecord" :to="to(mainRecord)" class="press-row focus-inset flex min-h-15 items-center gap-3 py-2 pr-3 pl-4">
        <DateTile :date="mainRecord.date" />
        <span class="min-w-0 flex-1">
          <span class="block truncate text-base font-semibold"><CompetitionName :competition="mainRecord" /></span>
          <span class="text-primary block text-sm font-semibold">Main competition</span>
        </span>
        <ChevronRight class="text-muted-foreground size-5 shrink-0" aria-hidden="true" />
      </RouterLink>
      <p v-else-if="primary" class="flex min-h-15 items-center px-4 text-base font-semibold">Main competition <span class="text-muted-foreground ml-1.5 font-normal">(not listed yet)</span></p>
      <p v-else class="text-muted-foreground px-4 py-3 text-sm">None of them is the main one, so nothing’s shared. Make one the main one from its ··· menu.</p>
      <button v-if="primary" type="button" :class="ROW" @click="sheet.show($event)">
        <span class="flex-1 text-base font-semibold">Shared from it</span>
        <span class="text-muted-foreground text-callout">{{ sharedSummary }}</span>
        <ChevronRight class="text-muted-foreground size-5 shrink-0" aria-hidden="true" />
      </button>
      <button type="button" :class="ROW" :aria-expanded="showAll" @click="showAll = !showAll">
        <span class="flex-1 text-base font-semibold">All {{ members.length }} competitions</span>
        <span class="text-muted-foreground text-callout">{{ span }}</span>
        <ChevronDown :class="['text-muted-foreground size-5 shrink-0 transition-transform duration-(--dur-quick)', showAll && 'rotate-180']" aria-hidden="true" />
      </button>
      <ul v-if="showAll" class="rows-inset border-t [--inset:4.5rem]">
        <li v-for="c in members" :key="c.id">
          <component
            :is="c.id === id ? 'div' : RouterLink"
            v-bind="c.id === id ? {} : { to: to(c) }"
            :class="['flex min-h-15 items-center gap-3 py-2 pr-3 pl-4', c.id !== id && 'press-row focus-inset']"
          >
            <DateTile :date="c.date" />
            <span class="min-w-0 flex-1 truncate text-base font-semibold"><CompetitionName :competition="c" /></span>
            <span v-if="tagOf(c)" :class="['shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold', TAG[tagOf(c)!.tone]]">{{ tagOf(c)!.text }}</span>
          </component>
        </li>
      </ul>
    </div>

    <!-- What's shared -->
    <Dialog :open="sheet.open" :morph="sheet" variant="sheet" size="md" @close="sheet.hide()">
      <template #header>
        <h2 class="text-title">{{ isMain ? 'Shared with the others' : `Shared from ${mainName}` }}</h2>
      </template>
      <div class="space-y-3 p-4 pt-1 pb-[calc(1.5rem+var(--safe-bottom))]">
        <div class="surface divide-y rounded-2xl px-4 py-1">
          <div v-for="p in LINK_PARTS" :key="p.id">
            <SwitchField
              :model-value="shared.includes(p.id)"
              :label="p.label"
              :description="p.detail"
              :disabled="busy"
              :save="(on) => setPart(p.id, on)"
            />
            <p v-if="ownNote(p.id)" class="text-next-foreground -mt-1 pb-2 text-sm font-semibold">{{ ownNote(p.id) }}</p>
          </div>
        </div>
        <p class="text-muted-foreground text-sm">Names, dates and registration numbers are always each one’s own.</p>
      </div>
    </Dialog>

    <!-- The rarely done -->
    <Dialog :open="menu.open" :morph="menu" variant="dropdown" aria-label="More for linked competitions" @close="menu.hide()">
      <nav aria-label="More for linked competitions">
        <button v-if="!isMain" type="button" :class="MENU_ROW" :disabled="!canEdit || busy" @click="makeMain">
          <Star class="text-muted-foreground size-5 shrink-0" /> Make this the main one
        </button>
        <button v-if="primary && shared.length" type="button" :class="MENU_ROW" :disabled="!canEdit || busy" @click="shareAgain">
          <RefreshCw class="text-muted-foreground size-5 shrink-0" /> Share again now
        </button>
        <button type="button" :class="[MENU_ROW, 'text-destructive']" :disabled="!canEdit || busy" @click="takeOut">
          <Unlink class="size-5 shrink-0" /> Take out of the link
        </button>
      </nav>
    </Dialog>

    <LinkCompetitionSheet :morph="picking" :members="members" />
  </section>
</template>
