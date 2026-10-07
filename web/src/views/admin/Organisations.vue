<script setup lang="ts">
import { computed, onScopeDispose, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { onValue } from 'firebase/database'
import { Check, ChevronDown, ChevronRight, Landmark, Plus, Sparkles, X } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import Dialog from '@/components/Dialog.vue'
import FormInput from '@/components/admin/FormInput.vue'
import Checkbox from '@/components/ui/Checkbox.vue'
import Segmented from '@/components/ui/Segmented.vue'
import EmptyState from '@/components/EmptyState.vue'
import OrganisationMark from '@/components/OrganisationMark.vue'
import OrganisationPicker from '@/components/OrganisationPicker.vue'
import Skeleton from '@/components/Skeleton.vue'
import VisibilityChip from '@/components/VisibilityChip.vue'
import SearchField from '@/components/admin/SearchField.vue'
import SectionHeader from '@/components/admin/SectionHeader.vue'
import { useOrganisations } from '@/composables/useOrganisations'
import { dataRef } from '@/firebase'
import { toast } from '@/lib/admin/feedback'
import { createOrganisation } from '@/lib/admin/organisations'
import { canEdit, friendlyError, write } from '@/lib/admin/write'
import { formatLongDate } from '@/lib/format'
import { useMorph } from '@/lib/morph'
import { familyName, familyTags, groupFamilies, organisationsInNames, suggest, type Family, type NewOrganisation, type TagCompetition } from '@/lib/organisationTagging'
import { visibilityOf } from '@/lib/visibility'
import { organisationLabel, type OrganisationListItem } from '@/types/organisation'
import type { Competition } from '@/types/competition'

// Every organisation, and a tool for putting the competitions already on
// ScotDance.app under theirs: each competition's years are one family,
// tagged in one go, and a family that's tagged some years suggests the same
// for the rest.

const route = useRoute()
const router = useRouter()
const o = useOrganisations()
const orgName = (id: string) => o.byId.value.get(id)?.name ?? 'A deleted organisation'
const orgOf = (id: string) => o.byId.value.get(id) ?? { name: '?', shortName: null, image: null }

const view = computed<'list' | 'tag'>({
  get: () => (route.query.view === 'tag' ? 'tag' : 'list'),
  set: (v) => void router.replace({ query: { ...route.query, view: v === 'tag' ? 'tag' : undefined } }),
})

// Every competition, live, so the tags change as soon as they're saved.
const all = ref<TagCompetition[]>([])
const loaded = ref(false)
const off = onValue(dataRef('competitions'), (snap) => {
  all.value = Object.entries((snap.val() ?? {}) as Record<string, Competition>)
    .filter(([, c]) => c && typeof c === 'object')
    .map(([id, c]) => ({ ...c, id }))
  loaded.value = true
})
onScopeDispose(off)

// --- The list
const listQuery = ref('')
const counts = computed(() => {
  const m = new Map<string, number>()
  for (const c of all.value) for (const [id, on] of Object.entries(c.organisations ?? {})) if (on) m.set(id, (m.get(id) ?? 0) + 1)
  return m
})
const shownOrgs = computed(() => {
  const q = listQuery.value.trim().toLowerCase()
  return o.organisations.value.filter((org) => !q || [org.name, org.shortName, org.location].join(' ').toLowerCase().includes(q))
})

const starting = useMorph()
async function start({ name, shortName }: { name: string; shortName: string }) {
  try {
    const id = await createOrganisation({ name, shortName, join: false })
    toast(`Started ${name}`)
    await router.push({ name: 'organisation.manage', params: { organisationId: id } })
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  }
}

// --- Tagging
const year = new Date().getFullYear()
const scope = ref<'recent' | 'all'>('recent')
const untaggedOnly = ref(true)
const tagQuery = ref('')
const isTagged = (c: Competition) => Object.values(c.organisations ?? {}).some((on) => on === true)
const inScope = computed(() => all.value.filter((c) => scope.value === 'all' || String(c.date ?? '') >= `${year}`))
// Progress counts what people can see: listed (or published) competitions.
const progress = computed(() => {
  const shown = inScope.value.filter((c) => c.listed === true || c.published === true)
  const done = shown.filter(isTagged).length
  return { done, total: shown.length, pct: shown.length ? Math.round((done / shown.length) * 100) : 0 }
})
const families = computed(() => {
  const q = tagQuery.value.trim().toLowerCase()
  return groupFamilies(inScope.value).filter((f) => {
    if (q && ![f.name, f.location].join(' ').toLowerCase().includes(q)) return false
    return !untaggedOnly.value || f.competitions.some((c) => !isTagged(c))
  })
})
const suggestions = computed(() => new Map(families.value.map((f) => [f.key, suggest(f, o.organisations.value)])))
const strongCount = computed(() => [...suggestions.value.values()].filter((s) => s.some((x) => x.strong)).length)

const open = reactive(new Set<string>())
const toggleOpen = (key: string) => (open.has(key) ? open.delete(key) : open.add(key))

// Choosing competitions, a family or one year at a time.
const selected = reactive(new Set<string>())
const familyState = (f: Family) => {
  const n = f.competitions.filter((c) => selected.has(c.id)).length
  return n === 0 ? 'none' : n === f.competitions.length ? 'all' : 'some'
}
function toggleFamily(f: Family) {
  const on = familyState(f) !== 'all'
  for (const c of f.competitions) {
    if (on) selected.add(c.id)
    else selected.delete(c.id)
  }
}
function toggleOne(id: string) {
  if (selected.has(id)) selected.delete(id)
  else selected.add(id)
}
// How it's hidden, if it is (VisibilityChip shows nothing for published).
const hiddenOf = (c: Competition) => {
  const v = visibilityOf(c)
  return v === 'published' ? null : v
}
watch([scope, untaggedOnly], () => selected.clear())

async function tag(organisationId: string, competitionIds: string[], on: boolean, label = organisationLabel(orgOf(organisationId))) {
  const ids = competitionIds.filter((cid) => (all.value.find((c) => c.id === cid)?.organisations?.[organisationId] === true) !== on)
  if (!ids.length) return
  const updates = Object.fromEntries(ids.map((cid) => [`competitions/${cid}/organisations/${organisationId}`, on || null]))
  const undo = Object.fromEntries(ids.map((cid) => [`competitions/${cid}/organisations/${organisationId}`, on ? null : true]))
  const what = ids.length === 1 ? '1 competition' : `${ids.length} competitions`
  try {
    await write(updates)
    toast(on ? `Added ${label} to ${what}` : `Took ${label} off ${what}`, {
      action: { label: 'Undo', run: () => write(undo) },
    })
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  }
}
const accept = (f: Family, organisationId: string) => tag(organisationId, f.competitions.map((c) => c.id), true)

async function acceptAllStrong() {
  const updates: Record<string, true> = {}
  for (const f of families.value) {
    for (const s of suggestions.value.get(f.key) ?? []) {
      if (!s.strong) continue
      for (const c of f.competitions) if (c.organisations?.[s.organisationId] !== true) updates[`competitions/${c.id}/organisations/${s.organisationId}`] = true
    }
  }
  const n = Object.keys(updates).length
  if (!n) return
  try {
    await write(updates)
    toast(`Tagged ${n === 1 ? '1 competition' : `${n} competitions`} like their other years`, {
      action: { label: 'Undo', run: () => write(Object.fromEntries(Object.keys(updates).map((p) => [p, null]))) },
    })
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  }
}

// Adding to (or taking off) the chosen competitions.
const adding = useMorph()
const removing = useMorph()
const selectedOrgs = computed(() => {
  const ids = new Set<string>()
  for (const c of all.value) if (selected.has(c.id)) for (const [id, on] of Object.entries(c.organisations ?? {})) if (on) ids.add(id)
  return [...ids]
})
async function addSelected(org: OrganisationListItem) {
  await tag(org.id, [...selected], true)
  selected.clear()
}
async function createForSelected({ name, shortName }: { name: string; shortName: string }) {
  try {
    const id = await createOrganisation({ name, shortName, join: false })
    // Named here: the list may not have the new one yet.
    await tag(id, [...selected], true, organisationLabel({ name, shortName }))
    selected.clear()
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  }
}
// Organisations the competitions' names point to that aren't here yet:
// started from what's known (the abbreviation, where they mostly are), and
// added to every competition that names them, in one go.
const fromNames = computed(() => organisationsInNames(all.value, o.organisations.value))
const allFromNames = ref(false)
const shownFromNames = computed(() => (allFromNames.value ? fromNames.value : fromNames.value.slice(0, 4)))
const startingFrom = useMorph()
const draft = reactive({ name: '', shortName: '', location: '', competitionIds: [] as string[], busy: false, error: null as string | null })
function startFrom(n: NewOrganisation, e: Event) {
  Object.assign(draft, { name: n.name, shortName: n.shortName ?? '', location: n.location ?? '', competitionIds: n.competitions.map((c) => c.id), error: null })
  startingFrom.show(e)
}
async function startDraft() {
  const name = draft.name.trim()
  if (!name) return void (draft.error = 'It needs a name.')
  draft.busy = true
  try {
    const shortName = draft.shortName.trim()
    const id = await createOrganisation({ name, shortName, join: false })
    if (draft.location.trim()) await write({ [`organisations/${id}/location`]: draft.location.trim() })
    startingFrom.dismiss()
    await tag(id, draft.competitionIds, true, organisationLabel({ name, shortName }))
  } catch (e) {
    draft.error = friendlyError(e)
  } finally {
    draft.busy = false
  }
}
const competitionsLabel = (n: number) => (n === 1 ? '1 competition' : `${n} competitions`)

async function removeSelected(org: OrganisationListItem) {
  await tag(org.id, [...selected], false)
  selected.clear()
}

const yearsLabel = (f: Family) => (f.years ? (f.years[0] === f.years[1] ? String(f.years[0]) : `${f.years[0]}–${f.years[1]}`) : null)
const CHIP = 'inline-flex h-8 max-w-full items-center gap-1.5 rounded-full pr-3 pl-1 text-callout font-medium'
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-5 p-4 pb-[calc(7rem+var(--safe-bottom))] md:p-6">
    <SectionHeader title="Organisations" :count="o.organisations.value.length || null">
      <template #actions>
        <Button variant="tonal" :disabled="!canEdit" @click="starting.show($event)"><Plus /> New</Button>
      </template>
      <Segmented
        v-model="view"
        label="Show"
        :options="[
          { value: 'list', label: 'All' },
          { value: 'tag', label: 'Tag competitions' },
        ]"
      />
    </SectionHeader>

    <!-- Every organisation -->
    <template v-if="view === 'list'">
      <SearchField v-model="listQuery" label="Find an organisation" />
      <div v-if="!o.loaded.value" class="space-y-2"><Skeleton v-for="i in 5" :key="i" class="h-16 w-full rounded-2xl!" /></div>
      <EmptyState v-else-if="!shownOrgs.length" size="inline" :icon="Landmark" :title="listQuery ? `Nothing matches “${listQuery.trim()}”.` : 'No organisations yet.'" />
      <ul v-else class="surface divide-y overflow-hidden rounded-2xl">
        <li v-for="org in shownOrgs" :key="org.id">
          <RouterLink :to="{ name: 'organisation.manage', params: { organisationId: org.id } }" class="press-row focus-inset flex min-h-16 items-center gap-3 px-4 py-2">
            <OrganisationMark :organisation="org" />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-base font-semibold">{{ org.name }}</span>
              <span class="text-muted-foreground block truncate text-sm">
                {{ [org.shortName, org.location, `${counts.get(org.id) ?? 0} ${(counts.get(org.id) ?? 0) === 1 ? 'competition' : 'competitions'}`].filter(Boolean).join(' · ') }}
              </span>
            </span>
            <ChevronRight class="text-muted-foreground size-5 shrink-0" />
          </RouterLink>
        </li>
      </ul>
    </template>

    <!-- Tagging -->
    <template v-else>
      <section class="surface space-y-3 rounded-2xl p-4" aria-label="How far along">
        <div class="flex items-baseline justify-between gap-3">
          <p class="text-base">
            <span class="text-title tabular-nums">{{ progress.done }}</span>
            <span class="text-muted-foreground"> of {{ progress.total }} listed competitions have an organisation</span>
          </p>
          <span class="text-muted-foreground text-sm font-medium tabular-nums">{{ progress.pct }}%</span>
        </div>
        <div class="bg-blue-paper h-2 overflow-hidden rounded-full" role="progressbar" :aria-valuenow="progress.pct" aria-valuemin="0" aria-valuemax="100">
          <div class="bg-primary-fill h-full rounded-full transition-[width] duration-(--dur-base)" :style="{ width: `${progress.pct}%` }" />
        </div>
        <p class="text-muted-foreground text-sm">Each competition’s years are grouped, so one tap tags them all. Untagged years of a tagged competition are suggested.</p>
      </section>

      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Segmented
          v-model="scope"
          label="Which years"
          class="sm:w-72"
          :options="[
            { value: 'recent', label: `From ${year}` },
            { value: 'all', label: 'Every year' },
          ]"
        />
        <button type="button" class="press focus-inset flex h-11 items-center gap-2 rounded-full px-3 text-callout font-medium" :aria-pressed="untaggedOnly" @click="untaggedOnly = !untaggedOnly">
          <Checkbox :checked="untaggedOnly" /> Untagged only
        </button>
        <SearchField v-model="tagQuery" label="Find a competition" class="sm:flex-1" />
      </div>

      <div v-if="strongCount" class="bg-blue-paper flex flex-wrap items-center gap-3 rounded-2xl py-3 pr-3 pl-4">
        <Sparkles class="text-primary size-5 shrink-0" aria-hidden="true" />
        <p class="text-callout min-w-0 flex-1 font-medium">
          {{ strongCount === 1 ? '1 competition has' : `${strongCount} competitions have` }} years to tag like the others.
        </p>
        <Button variant="primary" :disabled="!canEdit" @click="acceptAllStrong">Tag them all</Button>
      </div>

      <!-- Organisations their names point to, not here yet -->
      <section v-if="fromNames.length" class="space-y-2" aria-labelledby="from-names-h">
        <div>
          <h3 id="from-names-h" class="text-heading">In competitions’ names</h3>
          <p class="text-muted-foreground text-sm">Not organisations here yet. Start one and it’s added to every competition that names it.</p>
        </div>
        <ul class="surface divide-y overflow-hidden rounded-2xl">
          <li v-for="n in shownFromNames" :key="n.name" class="flex min-h-16 items-center gap-3 py-2 pr-2 pl-4">
            <OrganisationMark :organisation="{ name: n.name, shortName: n.shortName, image: null }" />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-base font-semibold">{{ n.name }}</span>
              <span class="text-muted-foreground block truncate text-sm">{{ [competitionsLabel(n.competitions.length), n.location].filter(Boolean).join(' · ') }}</span>
            </span>
            <Button variant="tonal" :disabled="!canEdit" @click="startFrom(n, $event)"><Plus /> Start</Button>
          </li>
        </ul>
        <Button v-if="fromNames.length > 4" variant="plain" class="-ml-4" @click="allFromNames = !allFromNames">
          {{ allFromNames ? 'Show fewer' : `Show all ${fromNames.length}` }}
        </Button>
      </section>

      <div v-if="!loaded" class="space-y-2"><Skeleton v-for="i in 6" :key="i" class="h-16 w-full rounded-2xl!" /></div>
      <EmptyState
        v-else-if="!families.length"
        size="inline"
        :icon="Check"
        :title="tagQuery ? `Nothing matches “${tagQuery.trim()}”.` : untaggedOnly ? 'Everything here has an organisation.' : 'No competitions here.'"
      />
      <ul v-else class="space-y-2">
        <!-- A card per competition, its years inside it. -->
        <li
          v-for="f in families"
          :key="f.key"
          :class="['surface overflow-hidden rounded-2xl transition-colors duration-(--dur-quick)', familyState(f) !== 'none' && 'bg-blue-paper/40']"
        >
          <div class="flex items-start gap-1 py-2 pr-3 pl-1">
            <button
              type="button"
              class="press focus-inset flex size-11 shrink-0 items-center justify-center rounded-full"
              :aria-label="`Choose ${f.name}`"
              :aria-pressed="familyState(f) === 'all'"
              @click="toggleFamily(f)"
            >
              <Checkbox :checked="familyState(f) === 'all'" :class="familyState(f) === 'some' && 'opacity-60'" />
            </button>
            <div class="min-w-0 flex-1 py-1.5">
              <!-- One year: the competition itself. -->
              <template v-if="f.competitions.length === 1">
                <RouterLink :to="{ name: 'competition.info', params: { competitionId: f.competitions[0].id } }" class="focus-inset block rounded-md text-base font-semibold hover:underline">{{ f.name }}</RouterLink>
                <span class="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  {{ [f.competitions[0].date ? formatLongDate(f.competitions[0].date) : 'No date', f.location].filter(Boolean).join(' · ') }}
                  <VisibilityChip :visibility="hiddenOf(f.competitions[0])" />
                </span>
              </template>
              <template v-else>
                <span class="block text-base font-semibold">{{ f.name }}</span>
                <span class="text-muted-foreground block text-sm">{{ [yearsLabel(f), competitionsLabel(f.competitions.length), f.location].filter(Boolean).join(' · ') }}</span>
              </template>
              <div v-if="familyTags(f).all.length || familyTags(f).some.length || (suggestions.get(f.key) ?? []).some((x) => !x.strong)" class="mt-2 flex flex-wrap gap-1.5">
                <span v-for="id in familyTags(f).all" :key="id" :class="[CHIP, 'surface border']">
                  <OrganisationMark :organisation="orgOf(id)" size="xs" />
                  <span class="truncate">{{ organisationLabel(orgOf(id)) }}</span>
                  <button type="button" class="press -mr-2 flex size-7 items-center justify-center rounded-full" :aria-label="`Take ${orgName(id)} off`" @click="tag(id, f.competitions.map((c) => c.id), false)">
                    <X class="size-4" />
                  </button>
                </span>
                <!-- On some years: tag the rest. -->
                <button
                  v-for="id in familyTags(f).some"
                  :key="`some-${id}`"
                  type="button"
                  :class="[CHIP, 'press border-primary text-primary border border-dashed']"
                  :title="`On ${f.competitions.filter((c) => c.organisations?.[id]).length} of ${f.competitions.length} years: add it to the rest`"
                  :disabled="!canEdit"
                  @click="accept(f, id)"
                >
                  <OrganisationMark :organisation="orgOf(id)" size="xs" />
                  <span class="truncate">{{ organisationLabel(orgOf(id)) }}</span>
                  <span class="tabular-nums opacity-75">{{ f.competitions.filter((c) => c.organisations?.[id]).length }}/{{ f.competitions.length }}</span>
                  <Plus class="size-4" aria-hidden="true" />
                </button>
                <button
                  v-for="s in (suggestions.get(f.key) ?? []).filter((x) => !x.strong)"
                  :key="`s-${s.organisationId}`"
                  type="button"
                  :class="[CHIP, 'press text-muted-foreground border border-dashed']"
                  :title="s.reason"
                  :disabled="!canEdit"
                  @click="accept(f, s.organisationId)"
                >
                  <OrganisationMark :organisation="orgOf(s.organisationId)" size="xs" />
                  <span class="truncate">{{ organisationLabel(orgOf(s.organisationId)) }}?</span>
                  <span class="sr-only">{{ s.reason }}</span>
                  <Plus class="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
          <template v-if="f.competitions.length > 1">
            <button
              type="button"
              class="press-row focus-inset text-primary flex min-h-11 w-full items-center gap-1.5 border-t px-4 text-sm font-semibold"
              :aria-expanded="open.has(f.key)"
              @click="toggleOpen(f.key)"
            >
              {{ open.has(f.key) ? 'Hide them' : f.competitions.length === 2 ? 'Show both' : `Show all ${f.competitions.length}` }}
              <ChevronDown :class="['size-4 transition-transform duration-(--dur-quick)', open.has(f.key) && 'rotate-180']" aria-hidden="true" />
            </button>
            <ul v-if="open.has(f.key)" class="bg-muted/60 divide-y border-t">
              <li v-for="c in f.competitions" :key="c.id" class="flex items-center gap-1 py-1 pr-3 pl-1">
                <button type="button" class="press focus-inset flex size-11 shrink-0 items-center justify-center rounded-full" :aria-label="`Choose ${c.name}`" @click="toggleOne(c.id)">
                  <Checkbox :checked="selected.has(c.id)" />
                </button>
                <span class="min-w-0 flex-1">
                  <RouterLink :to="{ name: 'competition.info', params: { competitionId: c.id } }" class="block truncate text-callout font-semibold hover:underline">{{ c.date ? formatLongDate(c.date) : 'No date' }}</RouterLink>
                  <!-- Its own name only when it isn't the family's. -->
                  <span v-if="familyName(c.name) !== f.name" class="text-muted-foreground block truncate text-sm">{{ c.name }}</span>
                </span>
                <VisibilityChip :visibility="hiddenOf(c)" />
                <span class="flex shrink-0 -space-x-1.5">
                  <OrganisationMark v-for="(on, id) in (c.organisations ?? {})" :key="id" :organisation="orgOf(String(id))" size="xs" :title="orgName(String(id))" />
                </span>
              </li>
            </ul>
          </template>
        </li>
      </ul>
    </template>

    <!-- What to do with the chosen ones -->
    <Transition
      enter-active-class="transition-[translate,opacity] duration-(--dur-base) ease-snappy"
      enter-from-class="translate-y-4 opacity-0"
      leave-active-class="transition-[translate,opacity] duration-(--dur-quick) ease-exit"
      leave-to-class="translate-y-4 opacity-0"
    >
      <div
        v-if="view === 'tag' && selected.size"
        class="surface fixed inset-x-chrome-3 bottom-[calc(var(--chrome-bottom)+0.75rem)] z-30 mx-auto flex max-w-2xl flex-wrap items-center gap-2 rounded-2xl border p-2 pl-4 shadow-lg md:left-[calc(var(--chrome-left)+1rem)]"
        role="toolbar"
        aria-label="Chosen competitions"
      >
        <p class="text-callout min-w-0 flex-1 font-semibold tabular-nums">{{ selected.size === 1 ? '1 competition' : `${selected.size} competitions` }}</p>
        <Button variant="primary" :disabled="!canEdit" @click="adding.show($event)"><Plus /> Add to…</Button>
        <Button v-if="selectedOrgs.length" :disabled="!canEdit" @click="removing.show($event)">Take off…</Button>
        <Button variant="plain" @click="selected.clear()">Clear</Button>
      </div>
    </Transition>

    <Dialog :open="startingFrom.open" :morph="startingFrom" variant="sheet" @close="startingFrom.hide()">
      <template #header>
        <h2 class="text-title">Start {{ draft.shortName.trim() || draft.name.trim() || 'an organisation' }}</h2>
        <p class="text-muted-foreground text-sm">It’s added to the {{ competitionsLabel(draft.competitionIds.length) }} that name it. You won’t be its admin: invite theirs from its page.</p>
      </template>
      <form class="space-y-4 p-4 pb-[calc(1rem+var(--safe-bottom))]" novalidate @submit.prevent="startDraft">
        <FormInput v-model="draft.name" label="Name" required hint="Its full name, if you know it. You can change it later." />
        <FormInput v-model="draft.shortName" label="Short name" placeholder="e.g. FHDA" />
        <FormInput v-model="draft.location" label="Based in" placeholder="e.g. Calgary, AB" />
        <p v-if="draft.error" class="text-destructive text-sm font-medium" role="alert">{{ draft.error }}</p>
        <Button type="submit" variant="primary" size="lg" block :busy="draft.busy" :disabled="!canEdit">Start and add to {{ competitionsLabel(draft.competitionIds.length) }}</Button>
      </form>
    </Dialog>

    <OrganisationPicker :morph="starting" title="New organisation" :mine="[]" any create-hint="You won’t be its admin. Invite theirs from its page." @pick="(org) => router.push({ name: 'organisation.manage', params: { organisationId: org.id } })" @create="start" />
    <OrganisationPicker
      :morph="adding"
      :title="`Add ${selected.size === 1 ? '1 competition' : `${selected.size} competitions`} to…`"
      :mine="o.organisations.value.map((org) => org.id)"
      mine-label="Organisations"
      any
      create-hint="You won’t be its admin. Invite theirs from its page."
      @pick="addSelected"
      @create="createForSelected"
    />
    <OrganisationPicker :morph="removing" title="Take off which?" :mine="selectedOrgs" mine-label="On the ones you chose" :creatable="false" @pick="removeSelected" />
  </div>
</template>
