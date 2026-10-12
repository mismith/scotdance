<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { Palette } from '@lucide/vue'
import Dialog from '@/components/Dialog.vue'
import DancerLookPicker from '@/components/DancerLookPicker.vue'
import TartanSheet from '@/components/TartanSheet.vue'
import { useFollowing } from '@/composables/useFollowing'
import { useMorph } from '@/lib/morph'

// The thing that wears a followed dancer's look (their avatar on their page,
// their number card on a competition's) is where it's chosen: a palette
// badge says so, a tap opens the picker under it, and Customise opens the
// loom. For anyone you don't follow it's just the avatar or card.
const props = withDefaults(
  defineProps<{
    dancerId: string
    name: string
    /** A round avatar, or a number card's rounded rectangle. */
    shape?: 'round' | 'card'
    /** What the wrapped thing says, since the button's own label replaces it (e.g. "Number 331"). */
    label?: string
  }>(),
  { shape: 'round', label: undefined },
)

const following = useFollowing()
const on = computed(() => following.isFollowing(props.dancerId))
const first = computed(() => props.name.split(' ')[0] || 'this dancer')
const menu = useMorph()
const sheet = useMorph()
const button = useTemplateRef<HTMLButtonElement>('button')

function customise() {
  menu.dismiss()
  void sheet.show(button.value)
}
</script>

<template>
  <template v-if="on">
    <button
      ref="button"
      type="button"
      :aria-label="`${label ? `${label}. ` : ''}Choose ${first}’s look`"
      aria-haspopup="dialog"
      :aria-expanded="menu.open"
      :class="['press relative inline-flex', shape === 'round' ? 'rounded-full' : 'rounded-2xl']"
      @click="menu.show($event)"
    >
      <slot />
      <span
        :class="[
          'bg-raised text-foreground absolute flex size-8 items-center justify-center rounded-full shadow-[0_0_0_3px_var(--background),0_2px_6px_rgb(0_0_0/0.18)]',
          shape === 'round' ? '-right-0.5 -bottom-0.5' : '-right-2 -bottom-2',
        ]"
        aria-hidden="true"
      >
        <Palette class="size-[1.125rem]" stroke-width="2.25" />
      </span>
    </button>
    <Dialog :open="menu.open" :morph="menu" variant="dropdown" :aria-label="`${first}’s look`" @close="menu.hide()">
      <DancerLookPicker :dancer-id="dancerId" :dancer-name="name" class="px-3 pt-2 pb-3" @customise="customise" />
    </Dialog>
    <TartanSheet :open="sheet.open" :morph="sheet" :dancer-id="dancerId" :dancer-name="name" @close="sheet.hide()" />
  </template>
  <slot v-else />
</template>
