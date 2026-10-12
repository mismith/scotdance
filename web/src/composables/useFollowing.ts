import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useFavoritesStore } from '@/stores/favorites'
import { clothBackground } from '@/lib/tartan'
import {
  DANCER_COLORS,
  baseColor,
  isCustomColor,
  isTartan,
  useDancerColorsStore,
  type DancerColor,
  type DancerLook,
} from '@/stores/dancerColors'

// Following a dancer means favouriting their AGGREGATE record (one person
// across every competition). A per-competition record carries a back-pointer
// `dancerId` to it. Competitor numbers belong to a competition entry, never
// to the person, so nothing here keys on a number.

export interface FollowableDancer {
  /** Aggregate id: the person. */
  dancerId?: string
  firstName?: string
  lastName?: string
  fullName?: string
}

/**
 * Each person once: a dancer can have several entries in one group or
 * competition (e.g. re-imported under a new id), so lists of "your dancers"
 * go by the person, not the entry.
 */
export function oncePerPerson<T extends { id: string; dancerId?: string }>(list: T[]): T[] {
  const seen = new Set<string>()
  return list.filter((d) => {
    const key = d.dancerId ?? d.id
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function useFollowing() {
  const auth = useAuthStore()
  const favorites = useFavoritesStore()

  const colors = useDancerColorsStore()

  // Each followed dancer gets a look: the one you chose for them (a colour or
  // a tartan), or else the next colour nobody's using, in the order you
  // followed them (push-id-like keys sort chronologically), so a family's
  // first dancer is always red. A tartan takes its first colour's turn; your
  // own colours (hex) sit outside the palette, so they take no turn.
  const order = computed(() => Object.keys(favorites.dancers))
  const assigned = computed(() => {
    const out: Record<string, DancerLook> = {}
    const taken = new Set<string>(order.value.flatMap((id) => (colors.chosen[id] ? [baseColor(colors.chosen[id])] : [])))
    const free = [...DANCER_COLORS.filter((c) => !taken.has(c.id)), ...DANCER_COLORS.filter((c) => taken.has(c.id))]
    let n = 0
    for (const id of order.value) out[id] = colors.chosen[id] ?? free[n++ % free.length].id
    return out
  })

  /** A followed dancer's look: a colour id (e.g. 'dancer-3', or your own '#rrggbb'), or a tartan. */
  const lookFor = (aggregateId: string | undefined | null): DancerLook | null =>
    aggregateId ? (assigned.value[aggregateId] ?? null) : null

  /** A followed dancer's own colour: their colour, or their tartan's first. */
  const colorIdFor = (aggregateId: string | undefined | null): DancerColor | null => {
    const look = lookFor(aggregateId)
    return look ? baseColor(look) : null
  }

  /**
   * A followed dancer's look as a CSS background: their colour, or their
   * tartan's cloth (a `var(--cloth-…)`; see lib/tartan's solidOf for dots).
   */
  function colorFor(aggregateId: string | undefined | null): string | null {
    const look = lookFor(aggregateId)
    if (!look || !aggregateId) return null
    if (isTartan(look)) return clothBackground(look, aggregateId)
    return isCustomColor(look) ? look : `var(--${look})`
  }

  /** Inline style for anything drawn in a dancer's look (see `sash`). */
  function paint(aggregateId: string | undefined | null, fallback = 'var(--primary)') {
    return { '--dc': colorFor(aggregateId) ?? fallback }
  }

  function isFollowing(d: FollowableDancer | string | null | undefined): boolean {
    const id = typeof d === 'string' ? d : d?.dancerId
    return !!id && favorites.isFavorite('dancers', id)
  }

  function nameOf(d: FollowableDancer) {
    return d.fullName ?? `${d.firstName ?? ''} ${d.lastName ?? ''}`.trim()
  }

  async function setFollowing(d: FollowableDancer, on: boolean) {
    const id = d.dancerId
    if (!id) return
    const name = nameOf(d)
    const apply = () => favorites.setFavorite('dancers', id, on, name)
    if (!auth.isSignedIn) {
      auth.requireSignIn(apply, { reason: 'follow', name })
      return
    }
    await apply()
  }

  function toggle(d: FollowableDancer) {
    return setFollowing(d, !isFollowing(d))
  }

  const followedIds = computed(() => order.value)

  return { isFollowing, lookFor, colorFor, colorIdFor, paint, toggle, setFollowing, followedIds }
}
