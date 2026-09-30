import { computed, watchEffect } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useFavoritesStore } from '@/stores/favorites'
import { useDancerLooksStore } from '@/stores/dancerLooks'
import { useTartansStore } from '@/stores/tartans'
import { tartanAccents, tartanLayer } from '@/lib/tartan'

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

const PALETTE = ['var(--dancer-1)', 'var(--dancer-2)', 'var(--dancer-3)', 'var(--dancer-4)', 'var(--dancer-5)']
/** Light-theme values of the above, only to keep clear of tartan colours. */
const PALETTE_HEX = ['#b0102c', '#1d6a48', '#6a3fa0', '#8a5f00', '#0065bd']

function near(a: string, b: string) {
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const [x, y] = [rgb(a), rgb(b)]
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) < 110
}

export function useFollowing() {
  const auth = useAuthStore()
  const favorites = useFavoritesStore()

  const looks = useDancerLooksStore()
  const tartans = useTartansStore()

  // Colours follow the order dancers were followed (push-id-like keys sort
  // chronologically; plain ids fall back to name order), so a family's first
  // dancer is always red, the second always green. A dancer whose tartan is
  // set takes its main colour instead, and their sash shows the real cloth.
  // Siblings often share a tartan, so the second takes its next colour.
  const order = computed(() => Object.keys(favorites.dancers))
  watchEffect(() => looks.ensure(order.value))

  const tartanOf = (id: string) => tartans.get(looks.tartanIdOf(id))

  const assigned = computed(() => {
    const out: Record<string, { color: string; sash: string | null }> = {}
    // Tartans first, so a plain colour never matches a tartan's.
    const taken: string[] = []
    for (const id of order.value) {
      const t = tartanOf(id)
      if (!t) continue
      const color = tartanAccents(t).find((c) => !taken.includes(c)) ?? tartanAccents(t)[0]
      taken.push(color)
      out[id] = { color, sash: tartanLayer(t) }
    }
    // Colours unlike any tartan in use come first; the rest still follow,
    // so a big list never collapses into one colour.
    const clash = (i: number) => taken.some((c) => near(c, PALETTE_HEX[i]))
    const palette = [...PALETTE.filter((_, i) => !clash(i)), ...PALETTE.filter((_, i) => clash(i))]
    let n = 0
    for (const id of order.value) {
      if (!out[id]) out[id] = { color: palette[n++ % palette.length], sash: null }
    }
    return out
  })

  function colorFor(aggregateId: string | undefined | null): string | null {
    if (!aggregateId) return null
    const a = assigned.value[aggregateId]
    if (a) return a.color
    const t = tartanOf(aggregateId)
    return t ? tartanAccents(t)[0] ?? null : null
  }

  function sashFor(aggregateId: string | undefined | null): string | null {
    if (!aggregateId) return null
    const a = assigned.value[aggregateId]
    if (a) return a.sash
    const t = tartanOf(aggregateId)
    return t ? tartanLayer(t) : null
  }

  /** Inline style for anything drawn in a dancer's colours (see `sash`). */
  function paint(aggregateId: string | undefined | null, fallback = 'var(--primary)') {
    return { '--dc': colorFor(aggregateId) ?? fallback, '--sash': sashFor(aggregateId) ?? 'none' }
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

  return { isFollowing, colorFor, sashFor, paint, toggle, setFollowing, followedIds }
}
