<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { MapPin } from '@lucide/vue'
import FormInput from '@/components/admin/FormInput.vue'
import VenueField from '@/components/admin/VenueField.vue'
import { placesAvailable, type VenueFields, type VenuePlace } from '@/lib/maps'
import { countryChoice, townHint } from '@/lib/submitCountries'

// Where it is, three ways: search for the venue (choosing one fills in the
// address and town, and puts it on the map), just the town while the venue
// isn't booked, or the venue typed in by hand. Only the town is needed.

const venue = defineModel<string>('venue', { default: '' })
const address = defineModel<string>('address', { default: '' })
const location = defineModel<string>('location', { default: '' })
const place = defineModel<VenuePlace | null>('place', { default: null })
const props = defineProps<{ country: string | null; error?: string | null }>()

type Mode = 'search' | 'town' | 'typed'
// A draft opens the way it was left.
const mode = ref<Mode>(
  place.value || location.value
    ? venue.value || address.value || place.value
      ? 'typed'
      : 'town'
    : placesAvailable
      ? 'search'
      : 'typed',
)
const picked = computed(() => !!place.value)
const town = computed(() => townHint(props.country))
const regionCodes = computed(() =>
  props.country ? [countryChoice(props.country).iso] : undefined,
)

function onPick({ venue: v, address: a, location: l, ...rest }: VenueFields) {
  venue.value = v ?? ''
  address.value = a ?? ''
  location.value = l ?? ''
  place.value = rest
  mode.value = 'typed'
}
async function to(next: Mode) {
  if (next === 'search') {
    place.value = null
    address.value = ''
    location.value = ''
  }
  if (next === 'town') {
    place.value = null
    venue.value = ''
    address.value = ''
  }
  mode.value = next
  await nextTick()
  document.querySelector<HTMLElement>('[data-venue-step] :is(input, textarea)')?.focus()
}
/** Searched for but not picked: what's typed is the venue, and the town's still needed. */
function settle() {
  if (mode.value === 'search' && venue.value.trim()) mode.value = 'typed'
}
defineExpose({ settle })
</script>

<template>
  <div data-venue-step class="space-y-4">
    <template v-if="mode === 'search'">
      <VenueField v-model="venue" :region-codes="regionCodes" @pick="onPick" />
      <p v-if="error" class="text-destructive text-sm font-medium" role="alert">
        {{ error }}
      </p>
    </template>

    <!-- Picked from the search: what it filled in, to check. -->
    <div v-else-if="picked" class="surface flex items-start gap-3 rounded-2xl p-4">
      <span
        class="bg-blue-paper text-primary flex size-10 shrink-0 items-center justify-center rounded-full"
        aria-hidden="true"
      >
        <MapPin class="size-5" stroke-width="2.2" />
      </span>
      <span class="min-w-0 flex-1">
        <span class="block text-base font-semibold">{{ venue || location }}</span>
        <span v-if="address" class="text-muted-foreground text-callout block">{{
          address
        }}</span>
        <span v-if="location && venue" class="text-muted-foreground text-callout block">{{
          location
        }}</span>
      </span>
      <button
        type="button"
        class="press-row text-primary text-callout -my-2 -mr-2 flex min-h-11 shrink-0 items-center rounded-full px-3 font-semibold"
        @click="to('search')"
      >
        Change
      </button>
    </div>

    <template v-else-if="mode === 'town'">
      <FormInput
        v-model="location"
        label="Town or city"
        :placeholder="town.example ? `e.g. ${town.example}` : undefined"
        :hint="town.hint ?? undefined"
        :error="error"
        autocomplete="address-level2"
      />
    </template>

    <template v-else>
      <FormInput
        v-model="venue"
        label="Venue name"
        placeholder="e.g. Telus Convention Centre"
      />
      <FormInput
        v-model="address"
        label="Address"
        placeholder="e.g. 120 9th Ave SE"
        autocomplete="street-address"
      />
      <FormInput
        v-model="location"
        label="Town or city"
        :placeholder="town.example ? `e.g. ${town.example}` : undefined"
        :hint="town.hint ?? undefined"
        :error="error"
        autocomplete="address-level2"
      />
    </template>

    <div class="-mx-4 flex flex-wrap gap-x-1">
      <button
        v-if="mode !== 'town' && !picked"
        type="button"
        class="press-row text-primary text-callout flex min-h-11 items-center rounded-full px-4 font-semibold"
        @click="to('town')"
      >
        Just the town for now
      </button>
      <button
        v-if="mode === 'search'"
        type="button"
        class="press-row text-primary text-callout flex min-h-11 items-center rounded-full px-4 font-semibold"
        @click="to('typed')"
      >
        Type it in
      </button>
      <button
        v-if="mode !== 'search' && placesAvailable"
        type="button"
        class="press-row text-primary text-callout flex min-h-11 items-center rounded-full px-4 font-semibold"
        @click="to('search')"
      >
        Search for the venue
      </button>
    </div>
  </div>
</template>
