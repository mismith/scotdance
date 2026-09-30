<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter, type RouteLocationRaw } from 'vue-router'
import { ArrowDownToLine, Gavel, Info, LifeBuoy, LogIn, Music, School, Settings, Users } from '@lucide/vue'
import Dialog from '@/components/Dialog.vue'
import { useCrisp } from '@/composables/useCrisp'
import { useUpdate } from '@/composables/useUpdate'
import { useAuthStore } from '@/stores/auth'
import { useMeStore } from '@/stores/me'
import { gravatarUrl } from '@/lib/gravatar'
import { initialsOf } from '@/lib/format'
import type { Morph } from '@/lib/morph'

// The More tab's menu: grows out of the tab, one tap to the everyday places
// (your account, the people lists, About). The fine print lives in Settings.
const props = defineProps<{ menu: Morph }>()

const router = useRouter()
const auth = useAuthStore()
const me = useMeStore()
const crisp = useCrisp()
const update = useUpdate()

const avatar = ref<string | null>(null)
watch(
  () => me.email,
  async (email) => (avatar.value = await gravatarUrl(email, 64)),
  { immediate: true },
)
const initials = computed(() => initialsOf(me.displayName ?? me.email ?? '?'))

const browse = [
  { label: 'Dancers', icon: Users, to: { name: 'dancers' } },
  { label: 'Judges', icon: Gavel, to: { name: 'judges' } },
  { label: 'Pipers', icon: Music, to: { name: 'pipers' } },
  { label: 'Venues', icon: School, to: { name: 'venues' } },
]

function go(to: RouteLocationRaw) {
  props.menu.dismiss()
  router.push(to)
}
function run(action: () => void) {
  props.menu.dismiss()
  action()
}

// Focus ring drawn inside the row, so the menu's rounded edge can't clip it.
const row = 'flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left text-base font-bold hover:bg-accent focus-visible:-outline-offset-2'
</script>

<template>
  <Dialog :open="menu.open" :morph="menu" variant="menu" aria-label="More" @close="menu.hide()">
    <nav aria-label="More" class="divide-y">
      <div class="py-1">
        <button v-if="auth.isSignedIn" type="button" :class="row" @click="go({ name: 'profile' })">
          <img v-if="avatar" :src="avatar" alt="" class="size-8 shrink-0 rounded-full" />
          <span v-else class="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold">
            {{ initials }}
          </span>
          <span class="min-w-0 flex-1 truncate">{{ me.displayName ?? 'Your account' }}</span>
        </button>
        <button v-else type="button" :class="row" @click="run(() => auth.openLogin({ reason: 'account' }))">
          <LogIn class="text-primary size-5" /> Sign in
        </button>
        <button type="button" :class="row" @click="go({ name: 'settings' })">
          <Settings class="text-primary size-5" /> Settings
        </button>
      </div>
      <div class="py-1">
        <button v-for="b in browse" :key="b.label" type="button" :class="row" @click="go(b.to)">
          <component :is="b.icon" class="text-primary size-5" /> {{ b.label }}
        </button>
      </div>
      <div class="py-1">
        <button v-if="update.updateAvailable" type="button" :class="row" @click="run(() => update.openDialog())">
          <ArrowDownToLine class="text-secondary size-5" /> Update available
        </button>
        <button type="button" :class="row" @click="go({ name: 'about' })">
          <Info class="text-primary size-5" /> About ScotDance
        </button>
        <button v-if="crisp.available" type="button" :class="row" @click="run(() => crisp.open())">
          <LifeBuoy class="text-primary size-5" />
          <span class="flex-1">Help</span>
          <span v-if="crisp.unread > 0" class="bg-secondary text-secondary-foreground rounded-full px-2 text-sm">{{ crisp.unread }}</span>
        </button>
      </div>
    </nav>
  </Dialog>
</template>
