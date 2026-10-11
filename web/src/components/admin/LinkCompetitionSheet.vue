<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ChevronLeft, Link2 } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import Switch from '@/components/ui/Switch.vue'
import CompetitionName from '@/components/CompetitionName.vue'
import DateTile from '@/components/DateTile.vue'
import Dialog from '@/components/Dialog.vue'
import SearchField from '@/components/admin/SearchField.vue'
import { useManagedCompetition } from '@/composables/admin/useManagedCompetition'
import { useCompetitionLinks } from '@/composables/useCompetitionLinks'
import { useCompetitions, type CompetitionListItem } from '@/composables/useCompetitions'
import { changeLink, previewLink, type LinkPreview } from '@/lib/admin/links'
import { toast } from '@/lib/admin/feedback'
import { canEdit, friendlyError } from '@/lib/admin/write'
import { replacesSentence } from '@/lib/admin/linkWords'
import { parseDate } from '@/lib/format'
import { LINK_PARTS, type LinkPart } from '@/lib/linked'
import type { useMorph } from '@/lib/morph'
import { useMeStore } from '@/stores/me'

// Linking a competition (ADR 0007 §7): pick one you manage (those nearest
// these dates first; a system admin can find any), then see what it will
// take from the primary, and what that replaces, before linking. Every part
// starts on; switch off what it should keep of its own.
const props = defineProps<{
  morph: ReturnType<typeof useMorph>
  /** This one's set (itself among them), when it's linked. */
  members: CompetitionListItem[]
}>()

const m = useManagedCompetition()
const me = useMeStore()
const { setOf } = useCompetitionLinks()
// Every competition (the past too), but only once the sheet's opened.
const everything = ref(false)
const { competitions } = useCompetitions(everything)

const here = computed(() => m.competitionId.value)
const hereLinked = computed(() => !!setOf(here.value))
const when = (c: { date?: number | string }) => (c.date ? parseDate(c.date).getTime() : NaN)

const query = ref('')
const choices = computed(() => {
  const q = query.value.trim().toLowerCase()
  const at = when(m.competition.value ?? {})
  const inSet = new Set(props.members.map((c) => c.id))
  return competitions.value
    .filter((c) => c.id !== here.value && !inSet.has(c.id))
    // You need to manage both; a system admin finds others by typing.
    .filter((c) => (me.organises(c.id) || (me.isAdmin && q)) && (!q || [c.name, c.location, c.venue].join(' ').toLowerCase().includes(q)))
    .map((c) => {
      const theirs = setOf(c.id)
      return {
        c,
        distance: Number.isNaN(at) || Number.isNaN(when(c)) ? Number.POSITIVE_INFINITY : Math.abs(when(c) - at),
        note: theirs ? `Linked with ${theirs.ids.length - 1} ${theirs.ids.length === 2 ? 'other' : 'others'}` : null,
        // Both in links already: one has to come out of its own first.
        blocked: !!theirs && hereLinked.value,
      }
    })
    .sort((a, b) => a.distance - b.distance || (a.c.name ?? '').localeCompare(b.c.name ?? ''))
    .slice(0, 40)
})

// --- Confirming
const picked = ref<CompetitionListItem | null>(null)
const preview = ref<LinkPreview | null>(null)
const loading = ref(false)
const linking = ref(false)
const chosen = reactive(new Set<LinkPart>())
const nameOf = (cid?: string | null) =>
  cid === here.value
    ? m.competition.value?.name?.trim() || 'This one'
    : (cid === picked.value?.id ? picked.value?.name : props.members.find((c) => c.id === cid)?.name)?.trim() || 'the other'

const parts = computed(() =>
  LINK_PARTS.map((p) => {
    const plan = preview.value?.targets[0]?.parts.find((x) => x.part === p.id)
    return {
      ...p,
      description: 'more' in p ? `${p.detail} ${p.more}` : p.detail,
      blocked: plan?.blocked ?? null,
      replaces: plan?.replaces ? replacesSentence(nameOf(preview.value?.joining), plan, nameOf(preview.value?.primary)) : null,
    }
  }),
)

async function pick(c: CompetitionListItem) {
  picked.value = c
  preview.value = null
  loading.value = true
  try {
    preview.value = await previewLink({ action: 'link', competitionId: c.id, withId: here.value })
    chosen.clear()
    for (const p of parts.value) if (!p.blocked) chosen.add(p.id)
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
    picked.value = null
  } finally {
    loading.value = false
  }
}

function toggle(part: LinkPart, on: boolean) {
  if (on) chosen.add(part)
  else chosen.delete(part)
}

async function link() {
  if (!picked.value || linking.value) return
  linking.value = true
  try {
    await changeLink({ action: 'link', competitionId: picked.value.id, withId: here.value, parts: LINK_PARTS.map((p) => p.id).filter((p) => chosen.has(p)) })
    toast(`Linked with ${picked.value.name?.trim() || 'it'}`)
    void props.morph.hide()
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  } finally {
    linking.value = false
  }
}

// Each time it opens, it starts at the list.
watch(
  () => props.morph.open,
  (open) => {
    if (!open) return
    everything.value = true
    picked.value = null
    preview.value = null
    query.value = ''
  },
)
</script>

<template>
  <Dialog :open="morph.open" :morph="morph" variant="sheet" size="md" @close="morph.hide()">
    <template #header>
      <div v-if="picked" class="flex items-center gap-1">
        <button type="button" class="press -ml-2 flex size-9 shrink-0 items-center justify-center rounded-full" aria-label="Back to the list" @click="picked = null">
          <ChevronLeft class="size-5" />
        </button>
        <h2 class="text-title truncate">Link {{ picked.name?.trim() || 'it' }}</h2>
      </div>
      <template v-else>
        <h2 class="text-title">Link a competition</h2>
        <p class="text-muted-foreground text-sm">One you run on the days around this one, like the other half of a weekend.</p>
      </template>
    </template>

    <!-- Pick one -->
    <template v-if="!picked">
      <div class="p-4 pt-1">
        <SearchField v-model="query" label="Find a competition" />
      </div>
      <ul class="divide-y pb-[var(--safe-bottom)]">
        <li v-for="x in choices" :key="x.c.id">
          <button
            type="button"
            class="press-row focus-inset flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left disabled:opacity-(--disabled-opacity)"
            :disabled="x.blocked"
            @click="pick(x.c)"
          >
            <DateTile :date="x.c.date" :managed="me.organises(x.c.id)" />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-base font-semibold"><CompetitionName :competition="x.c" /></span>
              <span class="text-muted-foreground block truncate text-sm">
                {{ x.blocked ? 'In another link: take one out of its link first' : [x.c.venue || x.c.location, x.note].filter(Boolean).join(' · ') }}
              </span>
            </span>
            <Link2 class="text-primary size-5 shrink-0" aria-hidden="true" />
          </button>
        </li>
        <li v-if="!choices.length" class="text-muted-foreground px-4 py-3 text-sm">
          {{ query.trim() ? `Nothing you manage matches “${query.trim()}”.` : 'No other competitions you manage. Ask its organisers to link it from theirs.' }}
        </li>
      </ul>
    </template>

    <!-- What it takes -->
    <div v-else class="space-y-4 p-4 pt-1 pb-[calc(1.5rem+var(--safe-bottom))]">
      <p v-if="loading" class="text-muted-foreground text-callout" aria-live="polite">Checking what it would copy…</p>
      <template v-else-if="preview">
        <p class="text-callout">
          <template v-if="preview.joining === here">This one takes these from <strong>{{ nameOf(preview.primary) }}</strong>, the primary.</template>
          <template v-else-if="preview.primary === here">It takes these from this one, the primary.</template>
          <template v-else>It takes these from <strong>{{ nameOf(preview.primary) }}</strong>, the primary.</template>
          Switch off anything it should keep of its own.
        </p>
        <ul class="surface divide-y rounded-2xl px-4 py-1">
          <li v-for="p in parts" :key="p.id" class="flex items-center gap-3 py-2.5">
            <span class="min-w-0 flex-1">
              <span class="block text-base font-medium">{{ p.label }}</span>
              <span class="text-muted-foreground block text-sm">{{ p.description }}</span>
              <span v-if="p.blocked" class="text-destructive block text-sm font-medium">{{ p.blocked }}</span>
              <span v-else-if="p.replaces && chosen.has(p.id)" class="text-next-foreground block text-sm font-medium">{{ p.replaces }}</span>
            </span>
            <Switch
              :model-value="chosen.has(p.id)"
              :disabled="!!p.blocked"
              :aria-label="p.label"
              @update:model-value="(on: boolean) => toggle(p.id, on)"
            />
          </li>
        </ul>
        <p class="text-muted-foreground text-sm">Each keeps its own name, date and registration number. Families can jump between them from the title of each.</p>
        <Button variant="primary" size="lg" block :disabled="!canEdit" :busy="linking" @click="link">
          <Link2 /> Link them
        </Button>
      </template>
    </div>
  </Dialog>
</template>
