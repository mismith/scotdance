<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { Bell, Star } from '@lucide/vue'
import { askForAlerts } from '@/components/AlertsPrompt.vue'
import { followHaptic } from '@/lib/haptics'
import { useAuthStore } from '@/stores/auth'
import { useFavoritesStore, type FavoriteType } from '@/stores/favorites'

// Favourite a judge, piper, venue or organisation: the star (filled red once
// it's a favourite, the one mark for favourites), or with `labelled` a pill
// that says so: filled, or tonal where something else is the view's main
// action. A competition can't be a favourite (ADR 0008): on one this is the
// bell, Alerts, then Alerts on (its entry in favourites is its alerts).
const props = defineProps<{
  type: FavoriteType
  id: string
  /** Denormed display name stored alongside the favourite — lets list pages
   *  show favourites before the slim index for that entity loads. */
  name?: string
  /** Show the word ("Favourite", or "Alerts" on a competition) next to the icon. */
  labelled?: boolean
  /** Labelled only: tonal where another button is the view's main action; a tile in a row of actions. */
  variant?: 'filled' | 'tonal' | 'tile'
}>()

const auth = useAuthStore()
const favorites = useFavoritesStore()

const isFavorite = computed(() => favorites.isFavorite(props.type, props.id))
const alerts = computed(() => props.type === 'competitions')
const word = computed(() => (alerts.value ? (isFavorite.value ? 'Alerts on' : 'Alerts') : 'Favourite'))
const animating = ref(false)

async function handleClick(e: Event) {
  e.preventDefault()
  e.stopPropagation()
  if (!auth.isSignedIn) {
    auth.enqueueAfterLogin(() =>
      favorites.setFavorite(props.type, props.id, true, props.name),
    )
    auth.openLogin(alerts.value ? { reason: 'alerts', name: props.name } : { reason: 'favorite', name: props.name })
    return
  }
  const was = isFavorite.value
  await favorites.toggle(props.type, props.id, props.name)
  // A small lift and a firm tap for turning it on; nothing for off.
  if (was) return
  followHaptic()
  // A competition's alerts: the moment notifications mean something.
  if (alerts.value) askForAlerts({ competition: props.name ?? '' })
  animating.value = false
  await nextTick()
  animating.value = true
}
</script>

<template>
  <button
    type="button"
    :aria-pressed="isFavorite"
    :aria-label="labelled ? undefined : `${word}${name ? ` ${alerts ? 'for ' : ''}${name}` : ''}`"
    :class="[
      variant === 'tile'
        ? ['press action-tile text-primary transition-colors', isFavorite ? 'surface' : 'bg-blue-paper']
        : 'press flex shrink-0 items-center justify-center rounded-full transition-colors',
      variant === 'tile'
        ? null
        : labelled
        ? [
            'h-11 gap-1.5 px-4 text-callout font-semibold',
            isFavorite
              ? 'surface text-foreground'
              : variant === 'tonal'
                ? 'bg-blue-paper text-primary'
                : 'bg-primary-fill text-primary-foreground press-fill',
          ]
        : ['size-11', isFavorite ? (alerts ? 'text-primary' : 'text-secondary') : 'text-muted-foreground'],
    ]"
    @click="handleClick"
  >
    <component
      :is="alerts ? Bell : Star"
      :class="[
        variant !== 'tile' && 'size-5',
        isFavorite && (alerts ? 'text-primary fill-current' : 'text-secondary fill-current'),
        animating && 'motion-safe:animate-pop',
      ]"
      aria-hidden="true"
      @animationend="animating = false"
    />
    <template v-if="labelled">{{ word }}</template>
  </button>
</template>
