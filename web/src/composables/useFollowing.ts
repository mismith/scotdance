import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useFavoritesStore } from '@/stores/favorites'
import { useAlertsPrompt } from '@/composables/useAlertsPrompt'

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

export function useFollowing() {
  const auth = useAuthStore()
  const favorites = useFavoritesStore()
  const alerts = useAlertsPrompt()

  // Colours follow the order dancers were followed (push-id-like keys sort
  // chronologically; plain ids fall back to name order), so a family's first
  // dancer is always red, the second always green.
  const order = computed(() => Object.keys(favorites.dancers))

  function colorFor(aggregateId: string | undefined | null): string | null {
    if (!aggregateId) return null
    const i = order.value.indexOf(aggregateId)
    return i < 0 ? null : PALETTE[i % PALETTE.length]
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
    const apply = async () => {
      await favorites.setFavorite('dancers', id, on, name)
      if (on) alerts.offerAfterFollow(name)
    }
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

  return { isFollowing, colorFor, toggle, setFollowing, followedIds }
}
