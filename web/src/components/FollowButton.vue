<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { ChevronDown, Star, StarOff } from '@lucide/vue'
import Dialog from '@/components/Dialog.vue'
import DancerColorPicker from '@/components/DancerColorPicker.vue'
import { useFollowing, type FollowableDancer } from '@/composables/useFollowing'
import { followHaptic } from '@/lib/haptics'
import { useMorph } from '@/lib/morph'

// Follow a dancer. On their page it's a full-width button: Follow, then
// Following, which opens a small menu with their colour and Stop following.
// In long lists it's just the star, filled red once followed (the one mark
// for following), so a list of 150 isn't a wall of buttons. Hidden when the
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
const menu = useMorph()

async function onClick(e: Event) {
  e.preventDefault()
  e.stopPropagation()
  if (on.value && props.size === 'block') {
    menu.show(e)
    return
  }
  const was = on.value
  await following.toggle(props.dancer)
  // A small lift and a firm tap for following; nothing for unfollowing.
  if (!was && following.isFollowing(props.dancer)) {
    followHaptic()
    popping.value = false
    await nextTick()
    popping.value = true
  }
}

function stop() {
  menu.dismiss()
  void following.setFollowing(props.dancer, false)
}
</script>

<template>
  <button
    v-if="dancer.dancerId"
    v-bind="$attrs"
    type="button"
    :aria-pressed="on"
    :aria-label="`${on ? 'Following' : 'Follow'} ${name}`"
    :aria-haspopup="on && size === 'block' ? 'dialog' : undefined"
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
      <ChevronDown v-if="on" class="size-4 opacity-70" aria-hidden="true" />
    </template>
  </button>

  <Dialog
    v-if="size === 'block' && dancer.dancerId"
    :open="menu.open"
    :morph="menu"
    variant="dropdown"
    :aria-label="`Following ${name}`"
    @close="menu.hide()"
  >
    <DancerColorPicker :dancer-id="dancer.dancerId" :dancer-name="name" class="px-3 pt-2 pb-3" />
    <button
      type="button"
      class="press-row focus-inset text-destructive flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-base font-medium"
      @click="stop"
    >
      <StarOff class="size-5" aria-hidden="true" />
      Stop following
    </button>
  </Dialog>
</template>
