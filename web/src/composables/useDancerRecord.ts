import { computed, inject, provide, ref, watch, type InjectionKey, type Ref } from 'vue'
import type { UseDancerProfile } from '@/composables/useDancerProfile'
import { useDancerCards } from '@/composables/useDancerCards'
import { useCompetitionLinks } from '@/composables/useCompetitionLinks'
import { useDancerHidden, type HiddenInfo } from '@/composables/useDancerHidden'
import { fetchEntrySummary, type EntrySummary } from '@/lib/entrySummary'
import { seasonLabel, seasonOf } from '@/lib/seasons'
import { parseDate } from '@/lib/format'
import { orderLinked, railRows, type RailPosition } from '@/lib/linked'
import { recordProfileView } from '@/lib/profileViews'
import { useAuthStore } from '@/stores/auth'
import { useMeStore } from '@/stores/me'
import type { Competition } from '@/types/competition'

// A dancer's record across every competition, loaded once by DancerLayout:
// the competition rows and each entry's placings. Signed-in people get all of
// it; everyone else, and a hidden profile, the latest ten competitions only.

/** One competition they entered (entries in two age groups share a number). */
export interface Row {
  competitionId: string
  competition: Competition
  numbers: number[]
  entryIds: string[]
}
/** A row as a list draws it: linked competitions on their rail. */
export type ListRow = Row & {
  id: string
  date: Competition['date']
  name: string | undefined
  rail: RailPosition
  withOthers: string | null
}
type Summary = EntrySummary & { entryId: string }

/** How many competitions the basic profile shows. */
export const BASIC_LATEST = 10

function createDancerRecord(dancerId: Ref<string>, profile: UseDancerProfile) {
  const auth = useAuthStore()
  const me = useMeStore()
  const hidden = useDancerHidden(dancerId)

  // Signed in and not hidden: the full profile (a system admin sees past
  // hidden). Until who they are is known, neither: nothing is loaded for a
  // profile that may turn out hidden.
  const pending = computed(
    () =>
      !auth.authReady ||
      (auth.isSignedIn &&
        (hidden.loading.value || (hidden.hidden.value && !me.accessKnown))),
  )
  const rich = computed(
    () => !pending.value && auth.isSignedIn && (!hidden.hidden.value || me.isAdmin),
  )
  const hiddenInfo = computed<HiddenInfo | null>(() => hidden.info.value)

  const name = computed(() => profile.displayName.value)
  const person = computed(() =>
    dancerId.value ? [{ id: dancerId.value, name: name.value }] : [],
  )
  const { cards } = useDancerCards(person)
  const focus = computed(() => cards.value[0]?.focus ?? null)
  // Their day as a card only while it's to come or on; once it's over, that
  // competition is just the top of the list (its ribbons named there), not
  // shown twice.
  const showFocus = computed(
    () => !!focus.value?.days.length && focus.value.phase !== 'after',
  )

  const rows = computed<Row[]>(() => {
    const map = new Map<string, Row>()
    for (const a of profile.appearances.value) {
      const cid = a.raw.competitionId
      if (!cid || !a.competition) continue
      const r = map.get(cid) ?? {
        competitionId: cid,
        competition: a.competition,
        numbers: [],
        entryIds: [],
      }
      if (a.raw.number != null && !r.numbers.includes(Number(a.raw.number)))
        r.numbers.push(Number(a.raw.number))
      if (a.raw.dancerId && !r.entryIds.includes(a.raw.dancerId))
        r.entryIds.push(a.raw.dancerId)
      map.set(cid, r)
    }
    return [...map.values()]
  })

  // Linked competitions together on their rail, newest first (ADR 0007 §8);
  // one without the rest of its set names them.
  const { linkOf, othersLine } = useCompetitionLinks()
  const at = (r: { date?: number | string }) => (r.date ? parseDate(r.date).getTime() : 0)
  function railed(list: Row[], limit?: number): ListRow[] {
    const keyed = list.map((r) => ({
      ...r,
      id: r.competitionId,
      date: r.competition.date,
      name: r.competition.name,
    }))
    return railRows(orderLinked(keyed, linkOf, { descending: true, at }), limit).map(
      ({ item, rail, alone }) => ({
        ...item,
        rail,
        withOthers: alone
          ? othersLine({ id: item.id, date: item.date, name: item.name })
          : null,
      }),
    )
  }

  /** Every competition but today's card, a season (September to August) at a time, newest first. */
  const bySeason = computed(() => {
    const out = new Map<string, Row[]>()
    for (const r of rows.value) {
      const y = r.competition.date
        ? seasonLabel(seasonOf(parseDate(r.competition.date).getTime()))
        : 'Date to be announced'
      out.set(y, [...(out.get(y) ?? []), r])
    }
    return [...out.entries()].map(([year, list]) => [year, railed(list)] as const)
  })
  /** Every competition but today's card, newest first (not grouped by season, so a set can span one season's end). */
  const listRows = computed(() =>
    rows.value.filter(
      (r) => !showFocus.value || r.competitionId !== focus.value!.competitionId,
    ),
  )
  /** The `n` newest competitions, for the basic profile. */
  const latest = (n: number) => railed(listRows.value, n)

  // Every placing, all at once (each competition is a few small reads, and
  // fetchEntrySummary keeps them), so a long record has ribbons all the way
  // back. The basic profile reads only the competitions it shows.
  const summaries = ref<Record<string, Summary[]>>({})
  const wanted = computed<Row[]>(() =>
    pending.value ? [] : rich.value ? rows.value : latest(BASIC_LATEST),
  )
  watch(
    wanted,
    (list) => {
      for (const r of list) {
        if (summaries.value[r.competitionId]) continue
        Promise.all(
          r.entryIds.map((id) =>
            fetchEntrySummary(r.competitionId, id).then(
              (s) => s && { ...s, entryId: id },
            ),
          ),
        ).then((got) => {
          summaries.value = {
            ...summaries.value,
            [r.competitionId]: got.filter((x): x is Summary => !!x),
          }
        })
      }
    },
    { immediate: true },
  )
  /** Every fetched competition's placings are in. */
  const ready = computed(
    () =>
      wanted.value.length > 0 &&
      wanted.value.every((r) => summaries.value[r.competitionId]),
  )

  // Counted once the profile is there; signed out, it does nothing.
  let counted = ''
  watch(
    [dancerId, () => profile.loading.value, () => profile.notFound.value],
    ([id, loading, missing]) => {
      if (!id || loading || missing || counted === id) return
      counted = id
      recordProfileView(id)
    },
    { immediate: true },
  )

  return {
    pending,
    rich,
    hiddenInfo,
    name,
    focus,
    showFocus,
    focusId: computed(() => (showFocus.value ? focus.value!.competitionId : null)),
    rows,
    bySeason,
    listRows,
    latest,
    summaries: computed(() => {
      const out: Record<string, EntrySummary[]> = summaries.value
      return out
    }),
    ready,
  }
}

export type DancerRecord = ReturnType<typeof createDancerRecord>

const KEY: InjectionKey<DancerRecord> = Symbol('dancerRecord')

// Takes the profile rather than injecting it: the layout provides both, and a
// component can't inject what it provides itself.
export function provideDancerRecord(
  dancerId: Ref<string>,
  profile: UseDancerProfile,
): DancerRecord {
  const record = createDancerRecord(dancerId, profile)
  provide(KEY, record)
  return record
}

export function useDancerRecord(): DancerRecord {
  const injected = inject(KEY, null)
  if (!injected) throw new Error('useDancerRecord() called outside DancerLayout')
  return injected
}
