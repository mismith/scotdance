<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Link2 } from '@lucide/vue'
import LinkDancerSheet from '@/components/LinkDancerSheet.vue'
import TartanPicker from '@/components/TartanPicker.vue'
import TartanSwatch from '@/components/TartanSwatch.vue'
import { useAuthStore } from '@/stores/auth'
import { useDancerLooksStore } from '@/stores/dancerLooks'
import { useGuardiansStore, type Claim } from '@/stores/guardians'
import { useTartansStore } from '@/stores/tartans'
import { useFollowing } from '@/composables/useFollowing'

// A dancer's tartan, and linking them to your account so you can set it.
// Everyone sees the tartan; only you see your own link, and only people
// already linked see requests from others.
const props = defineProps<{ dancerId: string; dancerName: string }>()

const auth = useAuthStore()
const looks = useDancerLooksStore()
const tartans = useTartansStore()
const guardians = useGuardiansStore()
const following = useFollowing()

watch(() => props.dancerId, (id) => looks.ensure([id]), { immediate: true })

const first = computed(() => props.dancerName.split(' ')[0] || 'this dancer')
const tartanId = computed(() => looks.tartanIdOf(props.dancerId))
const tartan = computed(() => tartans.get(tartanId.value))
const claim = computed(() => guardians.claimFor(props.dancerId))
const isGuardian = computed(() => guardians.isGuardian(props.dancerId))
const showLinkPrompt = computed(() => auth.isSignedIn && !claim.value && following.isFollowing(props.dancerId))

const linkOpen = ref(false)
const pickerOpen = ref(false)
const justSet = ref(false)
function onSaved(id: string | null) {
  justSet.value = !!id
}

// Others asking to link, for someone already linked to approve.
const requests = ref<Record<string, Claim>>({})
let off: (() => void) | null = null
watch(
  [isGuardian, () => props.dancerId],
  ([yes, id]) => {
    off?.()
    off = null
    requests.value = {}
    if (yes) off = guardians.watchRequests(id, (all) => (requests.value = all))
  },
  { immediate: true },
)
onBeforeUnmount(() => off?.())
const pending = computed(() =>
  Object.entries(requests.value).filter(([uid, c]) => uid !== auth.uid && c.status === 'pending'),
)
const relationshipLabel = (c: Claim) => ({ parent: 'Parent or guardian', self: 'The dancer', teacher: 'Teacher' })[c.relationship]
</script>

<template>
  <section v-if="tartan || isGuardian || claim || showLinkPrompt" class="space-y-2">
    <h2 class="text-heading pt-1">Tartan</h2>

    <div v-if="tartan" class="bg-card overflow-hidden rounded-2xl border shadow-sm">
      <TartanSwatch
        :key="tartan.id"
        :tartan="tartan"
        :scale="0.8"
        :class="['h-24', justSet && 'motion-safe:animate-unfurl']"
      />
      <div class="flex items-center gap-3 p-3 pl-4">
        <p class="min-w-0 flex-1 text-base">
          <template v-if="justSet">Lovely. </template>{{ first }} dances in the <b>{{ tartan.name }}</b> tartan.
          <span v-if="tartan.status !== 'approved'" class="text-muted-foreground block text-sm">
            Only you can see it until it’s been checked.
          </span>
        </p>
        <button
          v-if="isGuardian"
          type="button"
          class="bg-card border-strong h-11 shrink-0 rounded-full border px-4 text-[0.9375rem] font-bold"
          @click="pickerOpen = true"
        >
          Change
        </button>
      </div>
    </div>

    <div v-else-if="isGuardian" class="bg-card space-y-3 rounded-2xl border p-4 shadow-sm">
      <p class="text-base">
        You’re linked to {{ first }}. Choose the tartan {{ first }} dances in, and their sash across ScotDance will
        wear it.
      </p>
      <button type="button" class="bg-primary text-primary-foreground h-12 w-full rounded-xl text-base font-bold" @click="pickerOpen = true">
        Choose {{ first }}’s tartan
      </button>
    </div>

    <div v-else-if="claim?.status === 'pending'" class="bg-card space-y-2 rounded-2xl border p-4 shadow-sm">
      <p class="text-base"><b>Link requested.</b> Once it’s checked, you can choose {{ first }}’s tartan here.</p>
      <button type="button" class="text-muted-foreground h-11 text-[0.9375rem] font-bold" @click="guardians.withdraw(dancerId)">
        Cancel request
      </button>
    </div>

    <div v-else-if="claim?.status === 'denied'" class="bg-card space-y-2 rounded-2xl border p-4 shadow-sm">
      <p class="text-base">The link to {{ first }} couldn’t be confirmed. If that’s a mistake, get in touch from Help in More.</p>
      <button type="button" class="text-muted-foreground h-11 text-[0.9375rem] font-bold" @click="guardians.withdraw(dancerId)">
        Clear this
      </button>
    </div>

    <button
      v-if="showLinkPrompt && !tartan"
      type="button"
      class="bg-card flex min-h-16 w-full items-center gap-3 rounded-2xl border p-3 text-left shadow-sm hover:bg-accent"
      @click="linkOpen = true"
    >
      <span class="bg-blue-paper text-primary flex size-10 shrink-0 items-center justify-center rounded-full"><Link2 class="size-5" /></span>
      <span class="min-w-0">
        <span class="block text-base font-bold">Your dancer?</span>
        <span class="text-muted-foreground block text-sm">Link {{ first }} to your account to add their tartan</span>
      </span>
    </button>
    <button
      v-else-if="showLinkPrompt"
      type="button"
      class="text-primary h-11 text-[0.9375rem] font-bold"
      @click="linkOpen = true"
    >
      Your dancer? Link {{ first }} to your account
    </button>

    <div v-if="pending.length" class="bg-card divide-y overflow-hidden rounded-2xl border shadow-sm">
      <div v-for="[uid, c] in pending" :key="uid" class="space-y-2 p-4">
        <p class="text-base">
          <b>{{ c.name || 'Someone' }}</b> asked to link to {{ first }}.
          <span class="text-muted-foreground block text-sm">{{ relationshipLabel(c) }}<template v-if="c.note"> · “{{ c.note }}”</template></span>
        </p>
        <div class="flex gap-2">
          <button type="button" class="bg-primary text-primary-foreground h-11 flex-1 rounded-xl text-[0.9375rem] font-bold" @click="guardians.decide(dancerId, uid, 'approved')">
            Approve
          </button>
          <button type="button" class="bg-card border-strong h-11 flex-1 rounded-xl border text-[0.9375rem] font-bold" @click="guardians.decide(dancerId, uid, 'denied')">
            Decline
          </button>
        </div>
      </div>
    </div>

    <LinkDancerSheet :open="linkOpen" :dancer-id="dancerId" :dancer-name="dancerName" @close="linkOpen = false" />
    <TartanPicker
      :open="pickerOpen"
      :dancer-id="dancerId"
      :dancer-name="dancerName"
      :current-id="tartanId"
      @close="pickerOpen = false"
      @saved="onSaved"
    />
  </section>
</template>
