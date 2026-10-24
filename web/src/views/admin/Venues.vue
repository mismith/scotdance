<script setup lang="ts">
import { computed, onScopeDispose, reactive, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { onValue } from 'firebase/database'
import { Check, ChevronDown, MapPinCheck, X } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import EmptyState from '@/components/EmptyState.vue'
import Skeleton from '@/components/Skeleton.vue'
import DiffText from '@/components/admin/DiffText.vue'
import SectionHeader from '@/components/admin/SectionHeader.vue'
import { dataRef } from '@/firebase'
import { confirm, toast } from '@/lib/admin/feedback'
import { canEdit, friendlyError, write } from '@/lib/admin/write'
import {
  canonicalFields,
  defaultKeeper,
  duplicateGroups,
  googleFits,
  keepApart,
  leaveSeparate,
  mergeVenues,
  separated,
  tierOf,
  venuesFrom,
  type CompetitionRecord,
  type Distinct,
  type Favorites,
  type Tier,
  type Venue,
} from '@/lib/admin/venueMerge'
import { formatShortDate } from '@/lib/format'
import { townLine } from '@/lib/knownVenues'
import { fetchVenueSuggestions, placesAvailable, resolveVenue, type VenueFields } from '@/lib/maps'

// Venues that look like one place, typed more than one way (see
// lib/admin/venueMerge), sorted by how sure that is. Each group is looked up
// on Google once (kept in venues:google) and shown against Google's version,
// the words that differ marked. The venue named as Google names it is kept by
// default, and merging gives every competition in the group its name with
// Google's address and pin. "Leave separate" keeps a group apart until it's
// brought back from the list at the bottom; ✕ takes one venue out of its
// group. Each says so in a toast with Undo.

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

// The one to keep in each group: as Google names it (else the most used),
// unless another's chosen.
const chosen = reactive(new Set<string>())
const keeper = (g: Venue[]) => g.find((v) => chosen.has(v.id)) ?? defaultKeeper(g, googleFor(g))
function choose(g: Venue[], v: Venue) {
  g.forEach((o) => chosen.delete(o.id))
  chosen.add(v.id)
}
const result = (g: Venue[]) => canonicalFields(keeper(g), googleFor(g))
// What each venue is compared with: Google's version, else what it becomes.
const reference = (g: Venue[]) => {
  const f = googleFor(g) ?? result(g)
  return { venue: f.venue ?? result(g).venue, address: f.address, town: townLine(f.locality, f.region) }
}

const TIERS: Array<{ tier: Tier; title: string; blurb: string }> = [
  { tier: 'name', title: 'Same name, written differently', blurb: 'Spelling, a word more or less, or no town. Check the list, then merge them all at once.' },
  { tier: 'spot', title: 'Same spot, different names', blurb: 'A school and the hall in it, or two places at one address: check each one.' },
  { tier: 'near', title: 'Close by', blurb: 'Pins up to 150 m apart, often different buildings.' },
]
const tiers = computed(() =>
  TIERS.map((t) => ({ ...t, groups: (groups.value ?? []).filter((g) => tierOf(g) === t.tier) })).filter((t) => t.groups.length),
)

const competitions = (n: number) => (n === 1 ? '1 competition' : `${n} competitions`)
const open = reactive(new Set<string>())
const toggle = (id: string) => (open.has(id) ? open.delete(id) : open.add(id))

const busy = ref<string | null>(null)
const ready = computed(() => canEdit.value && !!favorites.value && !busy.value)

function planFor(g: Venue[]) {
  const keep = keeper(g)
  return { keep, drop: g.filter((v) => v.id !== keep.id), ...mergeVenues({ keep, group: g, fields: result(g), comps: comps.value!, synced: synced.value, favorites: favorites.value! }) }
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
const merge = (g: Venue[]) => run(g[0].id, [g], `Merged into ${result(g).venue}`)
async function mergeAll(t: { tier: Tier; groups: Venue[][] }) {
  const n = t.groups.reduce((sum, g) => sum + g.reduce((s, v) => s + v.competitionIds.length, 0), 0)
  const ok = await confirm({
    title: `Merge all ${t.groups.length}?`,
    message: `Their ${competitions(n)} each take the name, address and map position their group shows.`,
    confirmLabel: 'Merge all',
  })
  if (ok) await run(t.tier, t.groups, `Merged all ${t.groups.length}`)
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
const apart = (v: Venue, g: Venue[]) => mark(keepApart(v.id, g), `${v.fields.venue} taken out`)
const separate = (g: Venue[]) => mark(leaveSeparate(g), `${g[0].fields.venue} left separate`)
const bringBack = (s: { venues: Venue[]; paths: string[] }) =>
  mark(Object.fromEntries(s.paths.map((p) => [p, null])), `${s.venues[0].fields.venue} brought back`)
const showSeparate = ref(false)
</script>

<template>
  <div class="max-w-3xl space-y-8 p-4 pb-[calc(3rem+var(--safe-bottom))]">
    <SectionHeader
      title="Venues"
      :count="groups?.length || null"
      description="Venues that look like one place, typed in more than one way, each against Google’s version with the differences marked. Merging gives all their competitions the chosen name with Google’s address and map position (or the chosen one’s, when Google doesn’t know the place), and their followers follow the venue kept."
    />

    <div v-if="!groups" class="space-y-4" aria-busy="true">
      <Skeleton v-for="i in 3" :key="i" class="h-44 w-full rounded-2xl!" />
    </div>
    <EmptyState v-else-if="!groups.length" :icon="MapPinCheck" title="No duplicate venues" description="Venues that look like one place show up here." />

    <section v-for="t in tiers" :key="t.tier" class="space-y-4">
      <div class="flex flex-wrap items-end gap-3">
        <div class="min-w-0 flex-1">
          <h2 class="text-heading">{{ t.title }} <span class="text-muted-foreground font-medium tabular-nums">{{ t.groups.length }}</span></h2>
          <p class="text-muted-foreground text-sm">{{ t.blurb }}</p>
        </div>
        <Button
          v-if="t.tier === 'name'"
          variant="primary"
          :busy="busy === t.tier"
          :disabled="!ready || !t.groups.every(asked)"
          @click="mergeAll(t)"
        >
          Merge all
        </Button>
      </div>

      <ul class="space-y-4">
        <li v-for="g in t.groups" :key="g.map((v) => v.id).join()" class="surface overflow-hidden rounded-2xl">
          <div class="space-y-0.5 border-b px-4 py-3">
            <p class="text-muted-foreground text-sm font-medium">
              {{
                googleFor(g)
                  ? 'On Google'
                  : looked(g) || !placesAvailable
                    ? 'Not on Google: merging uses the chosen one'
                    : unreached
                      ? 'Couldn’t check Google just now: merging uses the chosen one'
                      : 'Checking Google…'
              }}
            </p>
            <p class="text-base font-semibold">{{ reference(g).venue }}</p>
            <p class="text-muted-foreground text-sm">{{ [reference(g).address ?? 'No address', reference(g).town ?? 'No town'].join(' · ') }}</p>
          </div>
          <ul role="radiogroup" :aria-label="`Which name to keep for ${g[0].fields.venue}`" class="divide-y">
            <li v-for="v in g" :key="v.id" :class="keeper(g).id === v.id && 'bg-blue-paper'">
              <div class="flex items-center">
                <button
                  type="button"
                  role="radio"
                  :aria-checked="keeper(g).id === v.id"
                  class="press-row focus-inset flex min-h-14 min-w-0 flex-1 items-center gap-3 pt-2.5 pb-1 pl-4 text-left"
                  @click="choose(g, v)"
                >
                  <span class="min-w-0 flex-1">
                    <DiffText class="block text-base font-semibold" :text="v.fields.venue" :reference="reference(g).venue" empty="No name" />
                    <span class="text-muted-foreground block text-sm">
                      <DiffText :text="v.fields.address" :reference="reference(g).address" empty="No address" /> ·
                      <DiffText :text="townLine(v.fields.locality, v.fields.region)" :reference="reference(g).town" empty="No town" />
                    </span>
                  </span>
                  <Check v-if="keeper(g).id === v.id" class="text-primary size-5 shrink-0" stroke-width="2.6" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  class="press-row focus-inset text-muted-foreground mx-1 grid size-11 shrink-0 place-items-center rounded-full"
                  :aria-label="`${v.fields.venue}: not the same place`"
                  title="Not the same place"
                  :disabled="!canEdit"
                  @click="apart(v, g)"
                >
                  <X class="size-5" aria-hidden="true" />
                </button>
              </div>
              <button
                type="button"
                class="press-row focus-inset text-primary mb-1.5 ml-2 inline-flex min-h-9 items-center gap-1 rounded-full px-2 text-sm font-medium"
                :aria-expanded="open.has(v.id)"
                @click="toggle(v.id)"
              >
                {{ competitions(v.competitionIds.length) }}
                <ChevronDown :class="['size-4 transition-transform', open.has(v.id) && 'rotate-180']" aria-hidden="true" />
              </button>
              <ul v-if="open.has(v.id)" class="space-y-0.5 px-2 pb-2">
                <li v-for="cid in v.competitionIds" :key="cid">
                  <RouterLink :to="{ name: 'competition.info', params: { competitionId: cid } }" class="press-row focus-inset block rounded-xl px-2 py-1.5">
                    <span class="block text-sm font-medium">{{ comps?.[cid]?.name || 'Untitled competition' }}</span>
                    <span class="text-muted-foreground block text-sm">
                      {{ formatShortDate(comps?.[cid]?.date) || 'No date' }} ·
                      <DiffText :text="comps?.[cid]?.address" :reference="reference(g).address" empty="No address" />
                    </span>
                  </RouterLink>
                </li>
              </ul>
            </li>
          </ul>
          <div class="flex flex-wrap justify-end gap-2 border-t px-4 py-3">
            <Button :disabled="!canEdit" @click="separate(g)">Leave separate</Button>
            <Button variant="primary" :busy="busy === g[0].id" :disabled="!ready" @click="merge(g)">Merge</Button>
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
