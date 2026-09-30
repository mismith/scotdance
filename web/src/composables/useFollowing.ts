import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useFavoritesStore } from '@/stores/favorites'
import { DANCER_COLORS, useDancerColorsStore } from '@/stores/dancerColors'

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

export function useFollowing() {
  const auth = useAuthStore()
  const favorites = useFavoritesStore()

  const colors = useDancerColorsStore()

  // Each followed dancer gets a colour: the one you chose for them, or else
  // the next one nobody's using, in the order you followed them (push-id-like
  // keys sort chronologically), so a family's first dancer is always red.
  const order = computed(() => Object.keys(favorites.dancers))
  const assigned = computed(() => {
    const out: Record<string, string> = {}
    const taken = new Set<string>(order.value.map((id) => colors.chosen[id]).filter(Boolean))
    const free = [...DANCER_COLORS.filter((c) => !taken.has(c.id)), ...DANCER_COLORS.filter((c) => taken.has(c.id))]
    let n = 0
    for (const id of order.value) out[id] = colors.chosen[id] ?? free[n++ % free.length].id
    return out
  })

  /** The colour id (e.g. 'dancer-3') for a followed dancer. */
  const colorIdFor = (aggregateId: string | undefined | null) => (aggregateId ? (assigned.value[aggregateId] ?? null) : null)

  function colorFor(aggregateId: string | undefined | null): string | null {
    const id = colorIdFor(aggregateId)
    return id ? `var(--${id})` : null
  }

  /** Inline style for anything drawn in a dancer's colour (see `sash`). */
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

  return { isFollowing, colorFor, colorIdFor, paint, toggle, setFollowing, followedIds }
}
