<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import TartanPicker from '@/components/TartanPicker.vue'
import TartanSwatch from '@/components/TartanSwatch.vue'
import { useAuthStore } from '@/stores/auth'
import { useDancerLooksStore } from '@/stores/dancerLooks'
import { useTartansStore } from '@/stores/tartans'
import { useFollowing } from '@/composables/useFollowing'

// A dancer's tartan. Anyone who knows the dancer can pick it; your pick is
// private and is what you see. Once others who know them pick the same one,
// everyone sees it (see stores/dancerLooks).
const props = defineProps<{ dancerId: string; dancerName: string }>()

const auth = useAuthStore()
const looks = useDancerLooksStore()
const tartans = useTartansStore()
const following = useFollowing()

watch(() => props.dancerId, (id) => looks.ensure([id]), { immediate: true })

const first = computed(() => props.dancerName.split(' ')[0] || 'this dancer')
const pickId = computed(() => looks.pickOf(props.dancerId))
const publicId = computed(() => looks.publicTartanIdOf(props.dancerId))
const tartan = computed(() => tartans.get(pickId.value ?? publicId.value))
// "the Royal Stewart tartan", but not "the Smith Family Tartan tartan".
const tartanName = computed(() => tartan.value?.name ?? '')
const suffix = computed(() => (/tartan$/i.test(tartanName.value) ? '' : ' tartan'))
const agreed = computed(() => !!pickId.value && pickId.value === publicId.value)

const pickerOpen = ref(false)
const justSet = ref(false)
function openPicker() {
  if (auth.isSignedIn) pickerOpen.value = true
  else auth.requireSignIn(() => (pickerOpen.value = true), { reason: 'account' })
}
</script>

<template>
  <section v-if="tartan || following.isFollowing(dancerId)" class="space-y-2">
    <h2 class="text-heading pt-1">Tartan</h2>

    <div v-if="tartan" class="bg-card overflow-hidden rounded-2xl border shadow-sm">
      <TartanSwatch :key="tartan.id" :tartan="tartan" :scale="0.8" :class="['h-24', justSet && 'motion-safe:animate-unfurl']" />
      <div class="flex items-center gap-3 p-3 pl-4">
        <p class="min-w-0 flex-1 text-base">
          <template v-if="pickId && !agreed">You see {{ first }} in the <b>{{ tartanName }}</b>{{ suffix }}.</template>
          <template v-else>{{ first }} dances in the <b>{{ tartanName }}</b>{{ suffix }}.</template>
          <span v-if="pickId && !agreed" class="text-muted-foreground block text-sm">
            {{ tartan.custom ? 'Tartans you make are just for you.' : `Everyone sees it once someone else who knows ${first} picks it too.` }}
          </span>
        </p>
        <button type="button" class="bg-card border-strong h-11 shrink-0 rounded-full border px-4 text-[0.9375rem] font-bold" @click="openPicker">
          {{ pickId ? 'Change' : 'Not right?' }}
        </button>
      </div>
    </div>

    <div v-else class="bg-card space-y-3 rounded-2xl border p-4 shadow-sm">
      <p class="text-base">
        <b>Know {{ first }}’s tartan?</b> Pick it and {{ first }}’s sash wears it across ScotDance. Your pick is just
        for you until someone else who knows {{ first }} picks the same one.
      </p>
      <button type="button" class="bg-primary text-primary-foreground h-12 w-full rounded-xl text-base font-bold" @click="openPicker">
        Choose a tartan
      </button>
    </div>

    <TartanPicker
      :open="pickerOpen"
      :dancer-id="dancerId"
      :dancer-name="dancerName"
      :current-id="pickId"
      @close="pickerOpen = false"
      @saved="(id) => (justSet = !!id)"
    />
  </section>
</template>
