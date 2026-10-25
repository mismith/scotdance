<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { Bell, BellOff, Star } from '@lucide/vue'
import { useFollowing, type FollowableDancer } from '@/composables/useFollowing'
import { toast } from '@/lib/admin/feedback'
import { followHaptic } from '@/lib/haptics'
import { askForAlerts } from '@/components/AlertsPrompt.vue'

// Favourite a dancer (ADR 0008). On their page it's a full-width button,
// Favourite, one tap either way: taking them off says so with an Undo (their
// look is kept, so favouriting again brings it back). Favouriting turns
// their alerts on, and a bell appears beside it: Alerts, or Alerts off once
// turned off (they stay a favourite). Their look itself is chosen from their
// avatar or number card (DancerLookButton). In long lists it's just the
// star, filled red once a favourite (the one mark for favourites), so a list
// of 150 isn't a wall of buttons. Hidden when the record isn't linked to a
// person yet (no aggregate id), since favourites are per person, not per
// entry.
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
const alerts = computed(() => following.alertsOn(props.dancer))
const popping = ref(false)
const ringing = ref(false)
const name = computed(
  () => props.dancer.fullName ?? `${props.dancer.firstName ?? ''} ${props.dancer.lastName ?? ''}`.trim(),
)
const first = computed(() => props.dancer.firstName || name.value.split(' ')[0] || '')

async function onClick(e: Event) {
  e.preventDefault()
  e.stopPropagation()
  const was = on.value
  await following.toggle(props.dancer)
  // A small lift and a firm tap for favouriting; nothing for taking off.
  if (!was && following.isFollowing(props.dancer)) {
    followHaptic()
    // Their alerts are on now: the moment notifications mean something, so
    // offer them (once).
    askForAlerts({ firstName: first.value })
    popping.value = false
    await nextTick()
    popping.value = true
  } else if (was && props.size === 'block' && !following.isFollowing(props.dancer)) {
    toast(`Removed ${first.value || 'them'} from favourites`, {
      action: { label: 'Undo', run: () => following.setFollowing(props.dancer, true) },
    })
  }
}

async function onBell(e: Event) {
  e.preventDefault()
  e.stopPropagation()
  const next = !alerts.value
  await following.setAlerts(props.dancer, next)
  if (!next) return
  followHaptic()
  askForAlerts({ firstName: first.value })
  ringing.value = false
  await nextTick()
  ringing.value = true
}
</script>

<template>
  <button
    v-if="dancer.dancerId && size === 'row'"
    v-bind="$attrs"
    type="button"
    :aria-pressed="on"
    :aria-label="`Favourite ${name}`"
    :class="['press relative inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors', on ? 'text-secondary' : 'text-muted-foreground']"
    @click="onClick"
  >
    <Star
      :class="['size-6', on && 'fill-current', popping && 'motion-safe:animate-pop']"
      :stroke-width="2"
      aria-hidden="true"
      @animationend="popping = false"
    />
  </button>
  <!-- The full width of a phone (the two share it once the bell is there); on
       wider pages a button's width, not a bar. -->
  <div v-else-if="dancer.dancerId" v-bind="$attrs" class="flex w-full items-center justify-center gap-2 sm:w-auto">
    <button
      type="button"
      :aria-pressed="on"
      :aria-label="`Favourite ${name}`"
      :class="[
        'inline-flex h-12 min-w-0 flex-1 shrink-0 items-center justify-center gap-1.5 rounded-full px-5 text-base font-semibold transition-colors sm:min-w-44 sm:flex-none',
        on ? 'bg-blue-paper text-primary press' : 'bg-primary-fill text-primary-foreground press-fill',
      ]"
      @click="onClick"
    >
      <Star
        :class="['size-5', on && 'text-secondary fill-current', popping && 'motion-safe:animate-pop']"
        :stroke-width="2.25"
        aria-hidden="true"
        @animationend="popping = false"
      />
      Favourite
    </button>
    <Transition
      enter-active-class="transition-[opacity,scale] duration-(--dur-base) ease-snappy"
      enter-from-class="scale-90 opacity-0"
      leave-active-class="transition-opacity duration-(--dur-quick) ease-exit"
      leave-to-class="opacity-0"
    >
      <button
        v-if="on"
        type="button"
        :aria-label="`${alerts ? 'Alerts on' : 'Alerts off'} for ${first || name}`"
        class="bg-blue-paper text-primary press inline-flex h-12 shrink-0 items-center justify-center gap-1.5 rounded-full px-5 text-base font-semibold"
        @click="onBell"
      >
        <component
          :is="alerts ? Bell : BellOff"
          :class="['size-5', alerts && 'fill-current', ringing && 'motion-safe:animate-pop']"
          :stroke-width="2.25"
          aria-hidden="true"
          @animationend="ringing = false"
        />
        {{ alerts ? 'Alerts' : 'Alerts off' }}
      </button>
    </Transition>
  </div>
</template>
