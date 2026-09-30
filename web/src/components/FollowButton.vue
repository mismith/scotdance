<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { Star } from '@lucide/vue'
import { useFollowing, type FollowableDancer } from '@/composables/useFollowing'

// "Follow" / "Following", with the star kept as the familiar v3 symbol but
// never on its own. Hidden when the record isn't linked to a person yet
// (no aggregate id), since following is per person, not per entry.
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
    :style="on ? { backgroundColor: color, borderColor: color } : undefined"
    :class="[
      'relative inline-flex shrink-0 items-center justify-center gap-1.5 border font-bold transition-colors',
      size === 'row'
        ? 'h-9 rounded-full pr-3.5 pl-2.5 text-sm after:absolute after:-inset-1 after:content-[\'\']'
        : 'h-12 w-full rounded-xl px-4 text-base',
      on ? 'text-white' : 'bg-card border-strong text-foreground hover:bg-accent',
    ]"
    @click="onClick"
  >
    <Star
      :class="[size === 'row' ? 'size-4' : 'size-5', on && 'fill-current', popping && 'animate-pop']"
      stroke-width="2.4"
      @animationend="popping = false"
    />
    {{ on ? 'Following' : 'Follow' }}
  </button>
</template>
