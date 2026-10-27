<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { Palette } from '@lucide/vue'
import Dialog from '@/components/Dialog.vue'
import DancerLookPicker from '@/components/DancerLookPicker.vue'
import TartanSheet from '@/components/TartanSheet.vue'
import { useFollowing } from '@/composables/useFollowing'
import { useMorph } from '@/lib/morph'

// The thing that wears a followed dancer's look (their avatar on their page,
// their number card on a competition's) is where it's chosen: a palette
// badge says so, a tap opens the picker (under it on wide screens, a sheet on
// phones, like the loom it leads to), and Customise opens the loom. For
// anyone you don't follow it's just the avatar or card.
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
const wide = useMediaQuery('(min-width: 768px)')
// On wide screens the picker and the loom grow out of the palette badge and
// shrink back into it, not the whole avatar or card around it.
const badge = useTemplateRef<HTMLElement>('badge')

// Customise swaps the picker for the loom: the picker goes first (on a phone
// it slides down), then the loom comes in (slides up).
let toLoom = false
function customise() {
  toLoom = true
  menu.dismiss()
}
function pickerClosed() {
  if (!toLoom) return
  toLoom = false
  void sheet.show(badge.value)
}
</script>

<template>
  <template v-if="on">
    <button
      type="button"
      :aria-label="`${label ? `${label}. ` : ''}Choose ${first}’s look`"
      aria-haspopup="dialog"
      :aria-expanded="menu.open"
      :class="['press relative inline-flex', shape === 'round' ? 'rounded-full' : 'rounded-2xl']"
      @click="menu.show(badge)"
    >
      <slot />
      <span
        ref="badge"
        :class="[
          'bg-raised text-foreground absolute flex size-8 items-center justify-center rounded-full shadow-[0_0_0_3px_var(--background),0_2px_6px_rgb(0_0_0/0.18)]',
          shape === 'round' ? '-right-0.5 -bottom-0.5' : '-right-2 -bottom-2',
        ]"
        aria-hidden="true"
      >
        <Palette class="size-[1.125rem]" stroke-width="2.25" />
      </span>
    </button>
    <Dialog
      :open="menu.open"
      :morph="menu"
      :variant="wide ? 'dropdown' : 'sheet'"
      :aria-label="`${first}’s look`"
      @close="menu.hide()"
      @closed="pickerClosed"
    >
      <template #header>
        <h2 class="text-title">{{ first }}’s look</h2>
      </template>
      <DancerLookPicker
        :dancer-id="dancerId"
        :dancer-name="name"
        :class="wide ? 'px-3 pt-2 pb-3' : 'p-4 pb-[calc(1.5rem+var(--safe-bottom))]'"
        @customise="customise"
      />
    </Dialog>
    <TartanSheet :open="sheet.open" :morph="sheet" :dancer-id="dancerId" :dancer-name="name" @close="sheet.hide()" />
  </template>
  <slot v-else />
</template>
