<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { Star } from '@lucide/vue'
import { useFollowing, type FollowableDancer } from '@/composables/useFollowing'
import { toast } from '@/lib/admin/feedback'
import { followHaptic } from '@/lib/haptics'
import { askForAlerts } from '@/components/AlertsPrompt.vue'

// Follow a dancer. On their page it's a full-width button, Follow then
// Following, and one tap either way: stopping says so with an Undo (their
// look is kept, so following again brings it back). Their look itself is
// chosen from their avatar or number card (DancerLookButton). In long lists
// it's just the star, filled red once followed (the one mark for
// following), so a list of 150 isn't a wall of buttons. Hidden when the
// record isn't linked to a person yet (no aggregate id), since following is
// per person, not per entry.
defineOptions({ inheritAttrs: false })
const props = withDefaults(
  defineProps<{
    dancer: FollowableDancer
    size?: 'row' | 'block'
  }>(),
  { size: 'row' },
)

const following = useFollowing()
const on = computed(() => following.isFollowing(props.dancer))
const popping = ref(false)
const name = computed(
  () => props.dancer.fullName ?? `${props.dancer.firstName ?? ''} ${props.dancer.lastName ?? ''}`.trim(),
)

async function onClick(e: Event) {
  e.preventDefault()
  e.stopPropagation()
  const was = on.value
  await following.toggle(props.dancer)
  // A small lift and a firm tap for following; nothing for unfollowing.
  if (!was && following.isFollowing(props.dancer)) {
    followHaptic()
    // The moment notifications mean something: offer them (once).
    askForAlerts(props.dancer.firstName ?? name.value.split(' ')[0] ?? '')
    popping.value = false
    await nextTick()
    popping.value = true
  } else if (was && props.size === 'block' && !following.isFollowing(props.dancer)) {
    const first = props.dancer.firstName || name.value.split(' ')[0] || 'them'
    toast(`Stopped following ${first}`, { action: { label: 'Undo', run: () => following.setFollowing(props.dancer, true) } })
  }
}
</script>

<template>
  <button
    v-if="dancer.dancerId"
    v-bind="$attrs"
    type="button"
    :aria-pressed="on"
    :aria-label="`${on ? 'Following' : 'Follow'} ${name}`"
    :class="[
      'relative inline-flex shrink-0 items-center justify-center gap-1.5 font-semibold transition-colors',
      size === 'row'
        ? ['press size-11 rounded-full', on ? 'text-secondary' : 'text-muted-foreground']
        : [
            // The full width of a phone; on wider pages a button's width, not a bar.
            'h-12 w-full rounded-full px-5 text-base sm:w-auto sm:min-w-56',
            on ? 'bg-blue-paper text-primary press' : 'bg-primary-fill text-primary-foreground press-fill',
          ],
    ]"
    @click="onClick"
  >
    <Star
      :class="[
        size === 'row' ? 'size-6' : 'size-5',
        on && 'fill-current',
        on && size === 'block' && 'text-secondary',
        popping && 'motion-safe:animate-pop',
      ]"
      :stroke-width="size === 'row' ? 2 : 2.25"
      aria-hidden="true"
      @animationend="popping = false"
    />
    <template v-if="size !== 'row'">
      {{ on ? 'Following' : 'Follow' }}
    </template>
  </button>
</template>
