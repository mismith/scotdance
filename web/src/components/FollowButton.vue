<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { Star } from '@lucide/vue'
import { useFollowing, type FollowableDancer } from '@/composables/useFollowing'

// Follow a dancer. On their page it's a full-width "Follow" / "Following"
// button; in long lists it's just the star (the familiar v3 symbol), filled
// in their colour once followed, so a list of 150 isn't a wall of buttons.
// Hidden when the record isn't linked to a person yet (no aggregate id),
// since following is per person, not per entry.
const props = withDefaults(
  defineProps<{
    dancer: FollowableDancer
    size?: 'row' | 'block'
  }>(),
  { size: 'row' },
)

const following = useFollowing()
const on = computed(() => following.isFollowing(props.dancer))
const color = computed(() => following.colorFor(props.dancer.dancerId) ?? 'var(--primary)')
const popping = ref(false)
const name = computed(
  () => props.dancer.fullName ?? `${props.dancer.firstName ?? ''} ${props.dancer.lastName ?? ''}`.trim(),
)

async function onClick(e: Event) {
  e.preventDefault()
  e.stopPropagation()
  await following.toggle(props.dancer)
  popping.value = false
  await nextTick()
  popping.value = true
}
</script>

<template>
  <button
    v-if="dancer.dancerId"
    v-tap-feedback
    type="button"
    :aria-pressed="on"
    :aria-label="`${on ? 'Following' : 'Follow'} ${name}`"
    :style="on ? (size === 'row' ? { color } : { backgroundColor: `color-mix(in srgb, ${color} 16%, var(--card))`, borderColor: 'transparent' }) : undefined"
    :class="[
      'relative inline-flex shrink-0 items-center justify-center gap-1.5 font-bold transition-colors',
      size === 'row'
        ? ['size-11 rounded-full hover:bg-accent', !on && 'text-muted-foreground']
        : ['h-12 w-full rounded-xl border px-4 text-base', on ? 'text-foreground' : 'bg-primary border-primary text-primary-foreground'],
    ]"
    @click="onClick"
  >
    <Star
      :class="[size === 'row' ? 'size-6' : 'size-5', on && 'fill-current', popping && 'animate-pop']"
      :stroke-width="size === 'row' ? 2 : 2.4"
      :style="on && size !== 'row' ? { color } : undefined"
      @animationend="popping = false"
    />
    <template v-if="size !== 'row'">{{ on ? 'Following' : 'Follow' }}</template>
  </button>
</template>
