<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ChevronRight, Link2, RefreshCw } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import DateTile from '@/components/DateTile.vue'
import CompetitionName from '@/components/CompetitionName.vue'
import SwitchField from '@/components/admin/SwitchField.vue'
import LinkCompetitionSheet from '@/components/admin/LinkCompetitionSheet.vue'
import { useManagedCompetition } from '@/composables/admin/useManagedCompetition'
import { useLinkSync, useLinkedSet } from '@/composables/useCompetitionLinks'
import { changeLink, previewLink, type PartPreview } from '@/lib/admin/links'
import { confirm, toast } from '@/lib/admin/feedback'
import { canEdit, friendlyError } from '@/lib/admin/write'
import { replacesSentence } from '@/lib/admin/linkWords'
import { formatWeekday, parseDate } from '@/lib/format'
import { LINK_PARTS, linkPartLabel, type LinkPart } from '@/lib/linked'
import { useMorph } from '@/lib/morph'
import { useMeStore } from '@/stores/me'
import type { CompetitionListItem } from '@/composables/useCompetitions'

// Manage › Details › Linked competitions (ADR 0007 §7). Competitions that
// go together (a weekend's two, a week's seven) are linked here. One is the
// primary: the others copy what's switched on from it, and functions keep
// them in step. On the primary, a switch per part for all the others; on
// another, its own switches, and the ways to change the link.
const m = useManagedCompetition()
const me = useMeStore()
const id = computed(() => m.competitionId.value)
const { set, members, primary } = useLinkedSet(id)
const { takes, partsOf } = useLinkSync()

const linked = computed(() => !!set.value)
const isPrimary = computed(() => linked.value && primary.value === id.value)
const others = computed(() => members.value.filter((c) => c.id !== id.value))
const primaryRecord = computed(() => members.value.find((c) => c.id === primary.value) ?? null)
const primaryName = computed(() => primaryRecord.value?.name?.trim() || 'the primary')
const count = computed(() => (set.value?.ids.length ?? 1) - 1)

const parts = LINK_PARTS.map((p) => ({ ...p, description: 'more' in p ? `${p.detail}\n${p.more}` : p.detail }))

// How to name one of the others briefly: its weekday when they're all
// within a week ("Sunday has its own"), else its name.
const withinAWeek = computed(() => {
  const days = members.value.map((c) => (c.date ? parseDate(c.date).getTime() : NaN)).filter((t) => !Number.isNaN(t))
  return days.length > 1 && Math.max(...days) - Math.min(...days) < 7 * 86_400_000
})
const shortName = (c: CompetitionListItem) => (withinAWeek.value && c.date ? formatWeekday(c.date) : c.name?.trim() || 'One')

/** On the primary: which of the others don't take a part. */
const notTaking = (part: LinkPart) => others.value.filter((c) => !takes(c.id, part))
function primaryDetail(p: (typeof parts)[number]) {
  const missing = notTaking(p.id)
  if (!missing.length || missing.length === others.value.length) return p.description
  const own = missing.length === 1 ? `${shortName(missing[0])} has its own` : `${missing.length} have their own`
  return p.description.replace(/^([^\n]*)/, `$1 · ${own}`)
}

/** What one of the others takes, in a few words. */
function takesLine(c: CompetitionListItem) {
  if (c.id === primary.value) return 'Primary'
  const theirs = partsOf(c.id)
  if (!theirs.length) return 'Takes nothing from the primary'
  if (theirs.length === LINK_PARTS.length) return isPrimary.value ? 'Everything above' : 'Everything'
  const missing = LINK_PARTS.filter((p) => !theirs.includes(p.id))
  if (missing.length <= 2) return `All but ${missing.map((p) => p.label).join(' and ')}`
  return theirs.map(linkPartLabel).join(' · ')
}

/** Confirms what turning a part on (or a new primary) would replace; true to go ahead. */
async function confirmReplacing(previews: Array<{ competitionId: string; parts: PartPreview[] }>, from: string, title: string, confirmLabel: string) {
  const blocked = previews.flatMap((t) => t.parts.filter((p) => p.blocked))
  if (blocked.length) {
    toast(blocked[0].blocked!, { tone: 'error' })
    return false
  }
  const lines = previews.flatMap((t) => {
    const c = members.value.find((x) => x.id === t.competitionId)
    const name = c ? shortName(c) : 'One'
    return t.parts.filter((p) => p.replaces).map((p) => replacesSentence(name, p, from))
  })
  if (!lines.length) return true
  return confirm({ title, message: lines.join('\n'), confirmLabel })
}

const busy = ref<string | null>(null)
async function run(key: string, fn: () => Promise<unknown>) {
  if (busy.value) return
  busy.value = key
  try {
    await fn()
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  } finally {
    busy.value = null
  }
}

/** A part's switch: on the primary, for all the others; else for this one. */
async function setPart(part: LinkPart, on: boolean) {
  const label = linkPartLabel(part)
  if (on) {
    const preview = await previewLink({ action: 'sync', competitionId: id.value, part, on: true })
    const ok = await confirmReplacing(
      preview.targets,
      primaryName.value,
      isPrimary.value ? `Copy ${label} to the others?` : `Take ${label} from ${primaryName.value}?`,
      'Copy it',
    )
    if (!ok) return
  }
  await changeLink({ action: 'sync', competitionId: id.value, part, on })
  toast(
    on
      ? isPrimary.value
        ? `The others take ${label} from this one`
        : `Takes ${label} from ${primaryName.value}`
      : isPrimary.value
        ? `Each keeps its own ${label} now`
        : `Keeps its own ${label} now`,
  )
}

const makePrimary = () =>
  run('primary', async () => {
    const preview = await previewLink({ action: 'primary', competitionId: id.value })
    const ok = await confirmReplacing(
      preview.targets,
      m.competition.value?.name?.trim() || 'this one',
      'Make this the primary?',
      'Make it the primary',
    )
    if (!ok) return
    // Nothing to replace: still say what it means.
    if (!preview.targets.some((t) => t.parts.some((p) => p.replaces))) {
      const yes = await confirm({
        title: 'Make this the primary?',
        message: 'The others then copy what they take from this one.',
        confirmLabel: 'Make it the primary',
      })
      if (!yes) return
    }
    await changeLink({ action: 'primary', competitionId: id.value })
    toast('This one is the primary now')
  })

const syncNow = () =>
  run('sync', async () => {
    await changeLink({ action: 'syncNow', competitionId: id.value })
    toast(isPrimary.value ? 'Copied to the others again' : `Copied from ${primaryName.value} again`)
  })

const takeOut = () =>
  run('out', async () => {
    const ok = await confirm({
      title: 'Take it out of the link?',
      message: isPrimary.value
        ? 'This one keeps everything it has. The others stop copying from it until one of them is made the primary.'
        : `It keeps everything it has, and stops copying from ${primaryName.value}. Families won’t see it with the others any more.`,
      confirmLabel: 'Take it out',
      destructive: true,
    })
    if (!ok) return
    await changeLink({ action: 'unlink', competitionId: id.value })
    toast('Taken out of the link')
  })

const picking = useMorph()
const to = (c: CompetitionListItem) =>
  me.hasCompetitionPerm(c.id)
    ? { name: 'manage.details', params: { competitionId: c.id } }
    : { name: 'competition.info', params: { competitionId: c.id } }
</script>

<template>
  <section id="linked" class="scroll-mt-(--chrome-top) space-y-3">
    <h2 class="text-heading">Linked competitions</h2>

    <!-- Not linked yet -->
    <template v-if="!linked">
      <p class="text-muted-foreground text-sm">
        For competitions that go together, like a weekend’s two or a week’s seven. Families can jump between them, and
        this one’s staff and details are copied into the others, so they’re set up once.
      </p>
      <Button :disabled="!canEdit" @click="picking.show($event)"><Link2 /> Link a competition</Button>
    </template>

    <template v-else>
      <!-- Who's the primary -->
      <div class="flex items-start gap-3">
        <span class="bg-blue-paper text-primary flex size-10 shrink-0 items-center justify-center rounded-full" aria-hidden="true">
          <RefreshCw class="size-5" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="text-base leading-snug font-semibold">
            <template v-if="isPrimary">This one is the primary</template>
            <template v-else>Linked with {{ count }} {{ count === 1 ? 'other' : 'others' }}</template>
          </p>
          <p class="text-muted-foreground text-sm">
            <template v-if="isPrimary">
              The other {{ count }} copy what’s switched on below. Change it here and it changes in all of them.
            </template>
            <template v-else-if="primary">
              <RouterLink v-if="primaryRecord" :to="to(primaryRecord)" class="text-primary font-semibold">{{ primaryName }}</RouterLink>
              <template v-else>Another competition</template>
              is the primary. This one copies what’s switched on below from it.
            </template>
            <template v-else>None of them is the primary, so nothing’s copied between them. Make one the primary to share its details again.</template>
          </p>
        </div>
      </div>

      <!-- What's copied -->
      <template v-if="primary">
        <h3 class="text-callout pt-2 font-semibold">{{ isPrimary ? 'What they copy' : `What it takes from ${primaryName}` }}</h3>
        <div class="surface divide-y rounded-2xl px-4 py-1.5">
          <SwitchField
            v-for="p in parts"
            :key="p.id"
            :model-value="isPrimary ? notTaking(p.id).length < others.length : takes(id, p.id)"
            :label="p.label"
            :description="isPrimary ? primaryDetail(p) : p.description"
            :disabled="!!busy"
            :save="(on) => setPart(p.id, on)"
          />
        </div>
        <p class="text-muted-foreground text-sm">Each keeps its own name, date and registration number.</p>
      </template>

      <!-- The others -->
      <h3 class="text-callout pt-2 font-semibold">{{ isPrimary ? `The other ${count}` : 'The others' }}</h3>
      <ul class="surface rows-inset overflow-hidden rounded-2xl [--inset:4.5rem]">
        <li v-for="c in others" :key="c.id">
          <RouterLink :to="to(c)" class="press-row focus-inset flex min-h-15 items-center gap-3 py-2 pr-3 pl-4">
            <DateTile :date="c.date" :managed="me.organises(c.id)" />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-base font-semibold"><CompetitionName :competition="c" /></span>
              <span :class="['block truncate text-sm font-medium', c.id === primary ? 'text-primary' : 'text-muted-foreground']">{{ takesLine(c) }}</span>
            </span>
            <ChevronRight class="text-muted-foreground size-5 shrink-0" aria-hidden="true" />
          </RouterLink>
        </li>
        <li v-if="isPrimary || !primary">
          <button
            type="button"
            class="press-row focus-inset text-primary text-callout flex min-h-13 w-full items-center gap-2.5 px-4 font-semibold disabled:opacity-(--disabled-opacity)"
            :disabled="!canEdit"
            @click="picking.show($event)"
          >
            <Link2 class="size-5" aria-hidden="true" /> Link a competition
          </button>
        </li>
      </ul>
      <p v-if="isPrimary" class="text-muted-foreground text-sm">
        Families can jump between linked competitions from the title of each one. Open one to choose what it copies, or to
        make it the primary.
      </p>

      <div class="flex flex-wrap gap-2 pt-1">
        <Button v-if="!isPrimary" :disabled="!canEdit || !!busy" :busy="busy === 'primary'" @click="makePrimary">Make this the primary</Button>
        <Button v-if="primary && (isPrimary ? others.some((o) => partsOf(o.id).length) : partsOf(id).length)" :disabled="!canEdit || !!busy" :busy="busy === 'sync'" @click="syncNow">
          <RefreshCw /> Sync now
        </Button>
        <Button class="text-destructive!" :disabled="!canEdit || !!busy" :busy="busy === 'out'" @click="takeOut">Take out of the link</Button>
      </div>
    </template>

    <LinkCompetitionSheet :morph="picking" :members="members" />
  </section>
</template>
