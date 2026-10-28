<script setup lang="ts">
import { computed, onScopeDispose, reactive, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { onValue } from 'firebase/database'
import { ChevronDown, MapPinCheck, X } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import EmptyState from '@/components/EmptyState.vue'
import Skeleton from '@/components/Skeleton.vue'
import DiffText from '@/components/admin/DiffText.vue'
import SectionHeader from '@/components/admin/SectionHeader.vue'
import FormInput from '@/components/admin/FormInput.vue'
import { dataRef } from '@/firebase'
import { confirm, toast } from '@/lib/admin/feedback'
import { canEdit, friendlyError, write } from '@/lib/admin/write'
import {
  canonicalFields,
  defaultKeeper,
  duplicateGroups,
  googleFits,
  leaveSeparate,
  mergeVenues,
  moveFollowers,
  separated,
  spaceFrom,
  tierOf,
  venuesFrom,
  type CompetitionRecord,
  type Distinct,
  type Favorites,
  type Venue,
} from '@/lib/admin/venueMerge'
import { venueKey, venueTown } from '@/lib/entityIndex'
import { formatShortDate } from '@/lib/format'
import { fetchVenueSuggestions, placesAvailable, resolveVenue, type VenueFields } from '@/lib/maps'

// Venues that look like one place, typed more than one way (see
// lib/admin/venueMerge), in one list to read down. Each group says plainly
// what merging does: "After merging", what all its competitions will say
// (Google's name, address and pin when Google knows the place: each group is
// looked up once, kept in venues:google), which Edit changes; and "Now", each
// way it's entered, with the space one keeps when its name says more than
// the venue's. Merge does exactly that. "Not the same place" leaves a group
// separate until it's brought back from the list at the bottom. Each says so
// in a toast with Undo.

const comps = ref<Record<string, CompetitionRecord> | null>(null)
const synced = ref(new Set<string>())
const distinct = ref<Distinct>({})
const favorites = ref<Favorites | null>(null)
const google = ref<Record<string, { v?: number; fields?: VenueFields } | null> | null>(null)
function listen(path: string, set: (v: never) => void) {
  onScopeDispose(onValue(dataRef(path), (s) => set((s.val() ?? {}) as never), () => set({} as never)))
}
listen('competitions', (v: Record<string, CompetitionRecord>) => (comps.value = v))
listen('competitionLinks:sync', (v: Record<string, { venue?: boolean }>) => {
  synced.value = new Set(Object.keys(v).filter((id) => v[id]?.venue === true))
})
listen('venues:distinct', (v: Distinct) => (distinct.value = v))
listen('users:favorites', (v: Favorites) => (favorites.value = v))
listen('venues:google', (v: Record<string, { v?: number; fields?: VenueFields } | null>) => (google.value = v))

// Merged venues, until the triggers have moved their competitions over.
const gone = reactive(new Set<string>())
const venues = computed(() => (comps.value ? venuesFrom(comps.value).filter((v) => !gone.has(v.id)) : null))
const groups = computed(() => (venues.value ? duplicateGroups(venues.value, distinct.value) : null))
const leftSeparate = computed(() => (venues.value ? separated(venues.value, distinct.value) : []))

// Google's version of each group, kept under its most used venue. Google
// counts every place looked up against a daily allowance the venue search
// shares, so each group is looked up once, a second apart, and a place only
// when it's at the group's spot. (A lookup from before v2, which didn't
// search near the venue, is done again only if it found somewhere else.)
const LOOKUP = 2
// Groups Google couldn't be reached for on this visit (tried again next time).
const unreached = ref(false)
const looked = (g: Venue[]) => {
  const e = google.value?.[g[0].id]
  return !!e && (e.v === LOOKUP || googleFits(g, e.fields))
}
const asked = (g: Venue[]) => !placesAvailable || unreached.value || looked(g)
const googleFor = (g: Venue[]) => {
  const f = google.value?.[g[0].id]?.fields
  return googleFits(g, f) ? f : null
}
let looking = false
/**
 * Google's place for a group: searched for by each of its names in turn
 * (three at most), near its pin, until a suggestion is at its spot. Only
 * that one is looked up.
 */
async function lookUp(g: Venue[]): Promise<VenueFields | null> {
  const pinned = g.find((v) => v.fields.lat != null && v.fields.lng != null)?.fields
  const near = pinned ? { lat: pinned.lat!, lng: pinned.lng! } : undefined
  const tried = new Set<string>()
  for (const v of g) {
    const q = [v.fields.venue, v.fields.locality].filter(Boolean).join(', ')
    if (tried.has(q) || tried.size >= 3) continue
    tried.add(q)
    const found = await fetchVenueSuggestions(q, v.fields.country ? [v.fields.country] : undefined, near)
    const here = near ? found.find((s) => s.distanceMeters != null && s.distanceMeters <= 300) : found[0]
    if (!here) continue
    const place = await resolveVenue(here.placeId)
    if (googleFits(g, place)) return Object.fromEntries(Object.entries(place).filter(([, x]) => x != null)) as unknown as VenueFields
  }
  return null
}
watch(
  [groups, google],
  async () => {
    if (looking || unreached.value || !groups.value || !google.value || !placesAvailable || !canEdit.value) return
    looking = true
    try {
      for (const g of groups.value) {
        if (looked(g)) continue
        const fields = await lookUp(g)
        await write({ [`venues:google/${g[0].id}`]: { v: LOOKUP, at: Date.now(), ...(fields && { fields }) } })
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    } catch {
      // Google's daily allowance used up, say: tried again next time the page opens.
      unreached.value = true
    } finally {
      looking = false
    }
  },
  { immediate: true },
)

// What each group becomes: Google's version under the name it's best known
// by (see canonicalFields), or what's typed in after Edit.
interface Edit { venue: string; space: string; address: string; location: string }
const groupKey = (g: Venue[]) => g.map((v) => v.id).join()
const edits = reactive<Record<string, Edit>>({})
const editing = reactive(new Set<string>())
const suggested = (g: Venue[]) => canonicalFields(defaultKeeper(g, googleFor(g)), googleFor(g))
function after(g: Venue[]): VenueFields {
  const base = suggested(g)
  const e = edits[groupKey(g)]
  if (!e) return base
  const location = e.location.trim() || null
  // A town typed in is the town the venue goes by.
  const town = location?.split(',')[0].trim() || null
  const sameTown = venueTown(base.locality, base.location) === venueTown(town, location)
  return { ...base, venue: e.venue.trim() || base.venue, address: e.address.trim() || null, location, locality: sameTown ? base.locality : town }
}
/** The venue of the group the merged competitions join, or null when their name or town makes a new one. */
const keepOf = (g: Venue[]) => {
  const f = after(g)
  const key = venueKey(f.venue, f.locality, f.location)
  return g.find((v) => v.key === key) ?? null
}
const edited = (g: Venue[]) => !!edits[groupKey(g)]
function startEdit(g: Venue[]) {
  const f = after(g)
  edits[groupKey(g)] = { venue: f.venue ?? '', space: '', address: f.address ?? '', location: f.location ?? '' }
  editing.add(groupKey(g))
}
function resetEdit(g: Venue[]) {
  delete edits[groupKey(g)]
  editing.delete(groupKey(g))
}
const addressLine = (f: { address?: string | null; location?: string | null }) => [f.address, f.location].filter(Boolean).join(', ')
// Names entered for it other than the one it'll have, to use instead.
const otherNames = (g: Venue[]) => [...new Set(g.map((v) => v.fields.venue).filter((n): n is string => !!n && n !== after(g).venue))]

// The space a venue's name adds to what it'll be called ("…School – Assembly
// Hall": Assembly Hall), kept unless it's dropped.
const noSpace = reactive(new Set<string>())
// The space typed in under Edit, for every competition in the group.
const groupSpace = (g: Venue[]) => edits[groupKey(g)]?.space.trim() || null
const spaceOf = (g: Venue[], v: Venue) => (groupSpace(g) ? null : spaceFrom(v.fields.venue, after(g).venue))
const spacesFor = (g: Venue[]) =>
  Object.fromEntries(g.map((v) => [v.id, spaceOf(g, v)] as const).filter(([id, sp]) => sp && !noSpace.has(id))) as Record<string, string>
const toggleSpace = (id: string) => (noSpace.has(id) ? noSpace.delete(id) : noSpace.add(id))
const noTown = (v: Venue) => !venueTown(v.fields.locality, v.fields.location)

// Ready ones (one name written differently) merge all at once; the rest are
// for a look, the same spot first.
const readyGroups = computed(() => (groups.value ?? []).filter((g) => tierOf(g) === 'name'))
const toLook = computed(() => {
  const rest = (groups.value ?? []).filter((g) => tierOf(g) !== 'name')
  return [...rest.filter((g) => tierOf(g) === 'spot'), ...rest.filter((g) => tierOf(g) === 'near')]
})

const competitions = (n: number) => (n === 1 ? '1 competition' : `${n} competitions`)
const count = (g: Venue[]) => g.reduce((n, v) => n + v.competitionIds.length, 0)
const open = reactive(new Set<string>())
const toggle = (id: string) => (open.has(id) ? open.delete(id) : open.add(id))
const competitionsOf = (v: Venue) => v.competitionIds.map((id) => ({ id, c: comps.value?.[id] }))

const busy = ref<string | null>(null)
const ready = computed(() => canEdit.value && !!favorites.value && !busy.value)

function planFor(g: Venue[]) {
  const keep = keepOf(g)
  const fields = after(g)
  return {
    g,
    fields,
    keep,
    drop: g.filter((v) => v.id !== keep?.id),
    ...mergeVenues({ keep, group: g, fields, comps: comps.value!, synced: synced.value, favorites: favorites.value!, spaces: spacesFor(g), space: groupSpace(g) }),
  }
}
// Merged into a new name: once the triggers have made its venue, its
// followers follow it.
function followOnceMade(plan: ReturnType<typeof planFor>) {
  const key = venueKey(plan.fields.venue, plan.fields.locality, plan.fields.location)
  const off = onValue(dataRef(`venues:index/${key}`), (s) => {
    const id = (s.val() as { id?: string } | null)?.id
    if (!id) return
    off()
    const moved = moveFollowers(favorites.value ?? {}, new Set(plan.g.map((v) => v.id)), id, plan.fields.venue)
    if (Object.keys(moved.after).length) void write(moved.after).catch((e) => toast(friendlyError(e), { tone: 'error' }))
  })
  setTimeout(off, 120_000)
}
async function run(key: string, list: Venue[][], message: string) {
  busy.value = key
  try {
    const plans = list.map(planFor)
    const after = Object.assign({}, ...plans.map((p) => p.after))
    const before = Object.assign({}, ...plans.map((p) => p.before))
    const dropped = plans.flatMap((p) => p.drop)
    await write(after)
    dropped.forEach((v) => gone.add(v.id))
    plans.filter((p) => !p.keep).forEach(followOnceMade)
    list.forEach(resetEdit)
    toast(message, {
      action: {
        label: 'Undo',
        run: () =>
          write(before)
            .then(() => dropped.forEach((v) => gone.delete(v.id)))
            .catch((e) => toast(friendlyError(e), { tone: 'error' })),
      },
    })
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  } finally {
    busy.value = null
  }
}
const merge = (g: Venue[]) => run(g[0].id, [g], `${competitions(count(g))} now at ${after(g).venue}`)
async function mergeAll() {
  const list = readyGroups.value
  const n = list.reduce((sum, g) => sum + count(g), 0)
  const ok = await confirm({
    title: `Merge all ${list.length}?`,
    message: `Their ${competitions(n)} each change to what’s under After merging.`,
    confirmLabel: 'Merge all',
  })
  if (ok) await run('all', list, `Merged all ${list.length}`)
}

async function mark(paths: Record<string, true | null>, message: string) {
  try {
    await write(paths)
    const undo = Object.fromEntries(Object.entries(paths).map(([p, v]) => [p, v ? null : true]))
    toast(message, { action: { label: 'Undo', run: () => write(undo).catch((e) => toast(friendlyError(e), { tone: 'error' })) } })
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  }
}
const separate = (g: Venue[]) => mark(leaveSeparate(g), `${after(g).venue} left separate`)
const bringBack = (s: { venues: Venue[]; paths: string[] }) =>
  mark(Object.fromEntries(s.paths.map((p) => [p, null])), `${s.venues[0].fields.venue} brought back`)
const showSeparate = ref(false)
</script>

<template>
  <div class="max-w-3xl space-y-8 p-4 pb-[calc(3rem+var(--safe-bottom))]">
    <SectionHeader
      title="Venues"
      :count="groups?.length || null"
      description="Places entered more than one way. Merging changes all their competitions to what’s under After merging, and anyone following one follows the merged venue."
    />

    <div v-if="!groups" class="space-y-4" aria-busy="true">
      <Skeleton v-for="i in 3" :key="i" class="h-44 w-full rounded-2xl!" />
    </div>
    <EmptyState v-else-if="!groups.length" :icon="MapPinCheck" title="No duplicate venues" description="Places entered more than one way show up here." />

    <section v-for="list in [{ key: 'ready', title: 'Ready to merge', groups: readyGroups }, { key: 'look', title: 'Take a look', groups: toLook }].filter((l) => l.groups.length)" :key="list.key" class="space-y-3">
      <div class="flex items-center gap-3">
        <h2 class="text-heading min-w-0 flex-1">{{ list.title }} <span class="text-muted-foreground font-medium tabular-nums">{{ list.groups.length }}</span></h2>
        <Button v-if="list.key === 'ready'" variant="tonal" size="sm" :busy="busy === 'all'" :disabled="!ready || !list.groups.every(asked)" @click="mergeAll()">Merge all</Button>
      </div>

      <ul class="surface divide-y rounded-2xl">
        <li v-for="g in list.groups" :key="groupKey(g)" class="space-y-3 py-4 pr-3 pl-4">
          <!-- What every competition in it will say. -->
          <div>
            <div class="flex items-center gap-2">
              <p class="text-muted-foreground min-w-0 flex-1 text-sm font-medium">After merging</p>
              <button v-if="!editing.has(groupKey(g))" type="button" class="press-row focus-inset text-primary -my-1 rounded-full px-2 py-1 text-sm font-semibold" @click="startEdit(g)">Edit</button>
            </div>
            <template v-if="!editing.has(groupKey(g))">
              <p class="text-base font-semibold">{{ after(g).venue }}</p>
              <p v-if="groupSpace(g)" class="text-sm font-medium">Space: {{ groupSpace(g) }}</p>
              <p class="text-muted-foreground text-sm">
                {{ addressLine(after(g)) || 'No address' }}
                <!-- Where it comes from, when it isn't just how it's entered. -->
                <span v-if="edited(g)" class="bg-next text-next-foreground ml-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap">Edited</span>
                <span v-else-if="googleFor(g)" class="bg-blue-paper text-primary ml-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap">Google</span>
                <span v-else-if="!asked(g)" class="ml-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap shadow-[inset_0_0_0_1px_var(--border)]">Checking Google…</span>
              </p>
            </template>
            <div v-else class="mt-2 space-y-3">
              <FormInput v-model="edits[groupKey(g)].venue" label="Name" />
              <div v-if="otherNames(g).length" class="-mt-1 flex flex-wrap gap-1.5">
                <button
                  v-for="n in otherNames(g)"
                  :key="n"
                  type="button"
                  class="press focus-inset rounded-full px-2.5 py-1 text-left text-xs font-semibold shadow-[inset_0_0_0_1px_var(--border)]"
                  @click="edits[groupKey(g)].venue = n"
                >
                  Use “{{ n }}”
                </button>
              </div>
              <FormInput v-model="edits[groupKey(g)].space" label="Space (optional)" placeholder="e.g. Main Hall" hint="Given to every competition here." />
              <FormInput v-model="edits[groupKey(g)].address" label="Address" />
              <FormInput v-model="edits[groupKey(g)].location" label="Town or city" />
              <div class="flex justify-end gap-2">
                <Button variant="plain" size="sm" @click="resetEdit(g)">{{ googleFor(g) ? 'Back to Google’s' : 'Back to how it was' }}</Button>
                <Button size="sm" @click="editing.delete(groupKey(g))">Done</Button>
              </div>
            </div>
          </div>

          <!-- How it's entered today. -->
          <div>
            <p class="text-muted-foreground text-sm font-medium">Now · {{ competitions(count(g)) }}</p>
            <ul class="mt-1 -ml-2">
              <li v-for="v in g" :key="v.id">
                <button
                  type="button"
                  class="press-row focus-inset flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm"
                  :aria-expanded="open.has(v.id)"
                  @click="toggle(v.id)"
                >
                  <span class="text-muted-foreground w-7 shrink-0 tabular-nums">{{ v.competitionIds.length }} ×</span>
                  <span class="min-w-0 flex-1">
                    <span class="block"><DiffText :text="v.fields.venue" :reference="after(g).venue" empty="No name" /></span>
                    <span class="text-muted-foreground block">
                      <DiffText :text="v.fields.address" :reference="after(g).address" empty="No address" :carets="false" /> ·
                      <template v-if="noTown(v)"><mark class="bg-next text-next-foreground rounded px-0.5">no town</mark></template>
                      <DiffText v-else :text="v.fields.location" :reference="after(g).location" empty="No town" :carets="false" />
                    </span>
                  </span>
                  <ChevronDown :class="['text-muted-foreground mt-0.5 size-4 shrink-0 transition-transform', open.has(v.id) && 'rotate-180']" aria-hidden="true" />
                </button>
                <!-- The rest of its name, kept as these competitions' space. -->
                <p v-if="spaceOf(g, v)" class="ml-11 flex items-center gap-1 text-sm">
                  <template v-if="!noSpace.has(v.id)">
                    <span>→ Space: <span class="font-semibold">{{ spaceOf(g, v) }}</span></span>
                    <button type="button" class="press-row focus-inset text-muted-foreground grid size-9 place-items-center rounded-full" :aria-label="`Don’t keep ${spaceOf(g, v)} as their space`" @click="toggleSpace(v.id)">
                      <X class="size-4" aria-hidden="true" />
                    </button>
                  </template>
                  <template v-else>
                    <span class="text-muted-foreground">→ No space</span>
                    <button type="button" class="press-row focus-inset text-primary rounded-full px-2 py-1 font-semibold" @click="toggleSpace(v.id)">Keep “{{ spaceOf(g, v) }}”</button>
                  </template>
                </p>
                <ul v-if="open.has(v.id)" class="mb-1 ml-9">
                  <li v-for="{ id, c } in competitionsOf(v)" :key="id">
                    <RouterLink :to="{ name: 'competition.info', params: { competitionId: id } }" class="press-row focus-inset flex items-baseline gap-2 rounded-lg px-2 py-1 text-sm">
                      <span class="text-muted-foreground shrink-0 tabular-nums">{{ formatShortDate(c?.date) || 'No date' }}</span>
                      <span class="min-w-0 truncate">{{ c?.name || 'Untitled competition' }}</span>
                    </RouterLink>
                  </li>
                </ul>
              </li>
            </ul>
          </div>

          <div class="flex items-center justify-between gap-2">
            <Button variant="plain" size="sm" class="-ml-3.5" :disabled="!canEdit" @click="separate(g)">Not the same place</Button>
            <Button variant="tonal" size="sm" :busy="busy === g[0].id" :disabled="!ready || editing.has(groupKey(g))" @click="merge(g)">Merge</Button>
          </div>
        </li>
      </ul>
    </section>

    <section v-if="leftSeparate.length" class="space-y-3">
      <button
        type="button"
        class="press-row focus-inset -mx-2 flex items-center gap-1 rounded-xl px-2 py-1 text-left"
        :aria-expanded="showSeparate"
        @click="showSeparate = !showSeparate"
      >
        <h2 class="text-heading">Left separate <span class="text-muted-foreground font-medium tabular-nums">{{ leftSeparate.length }}</span></h2>
        <ChevronDown :class="['text-muted-foreground size-5 transition-transform', showSeparate && 'rotate-180']" aria-hidden="true" />
      </button>
      <ul v-if="showSeparate" class="surface divide-y rounded-2xl">
        <li v-for="s in leftSeparate" :key="s.paths.join()" class="flex items-center gap-3 py-2 pr-2 pl-4">
          <span class="min-w-0 flex-1 text-sm">
            <span v-for="(v, i) in s.venues" :key="v.id" class="block" :class="i === 0 ? 'text-base font-medium' : 'text-muted-foreground'">{{ v.fields.venue }}</span>
          </span>
          <Button :disabled="!canEdit" @click="bringBack(s)">Bring back</Button>
        </li>
      </ul>
    </section>
  </div>
</template>
