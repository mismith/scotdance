<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRouter, type RouteLocationRaw } from 'vue-router'
import { LogIn, LogOut, Settings, UserRound } from '@lucide/vue'
import Dialog from '@/components/Dialog.vue'
import MeAvatar from '@/components/MeAvatar.vue'
import { useAuthStore } from '@/stores/auth'
import { useMeStore } from '@/stores/me'

// Top right of every page on phones: who you're signed in as. Tapping it
// opens a small menu: your account, Settings, Sign out (Manage and System
// admin are in More, and a competition you manage has its own pencil).
// Signed out, it opens Sign in and Settings, so Settings is always one tap
// from anywhere. As a `row` (the foot of the sidebar on wide screens) it
// names you and goes to your Account page (Sign out is there, and Settings
// is in the sidebar); signed out, it's Sign in.
withDefaults(defineProps<{ variant?: 'icon' | 'row' }>(), { variant: 'icon' })

const router = useRouter()
const auth = useAuthStore()
const me = useMeStore()

// The menu grows out of the button and hangs under it (Dialog anchors it).
const open = ref(false)
const show = () => (open.value = true)
function go(to: RouteLocationRaw) {
  open.value = false
  void router.push(to)
}
async function signOut() {
  open.value = false
  await auth.signOut()
}
function signIn() {
  open.value = false
  auth.openLogin({ reason: 'account' })
}

// One menu anatomy: inset rounded rows, medium labels, muted icons.
const row =
  'press-row focus-inset flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-base font-medium [&>svg]:text-muted-foreground [&>svg]:size-5 [&>svg]:shrink-0'
</script>

<template>
  <template v-if="variant === 'row'">
    <button
      v-if="!auth.isSignedIn"
      type="button"
      class="press-row focus-inset text-callout text-primary flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-1.5 text-left font-semibold"
      @click="auth.openLogin({ reason: 'account' })"
    >
      <LogIn class="size-5 shrink-0" aria-hidden="true" />
      Sign in
    </button>
    <RouterLink
      v-else
      :to="{ name: 'profile' }"
      :aria-label="`Signed in as ${me.displayName ?? me.email ?? 'you'}`"
      active-class="bg-blue-paper"
      class="press-row focus-inset flex min-h-12 w-full items-center gap-3 rounded-xl px-2 py-1.5"
    >
      <MeAvatar />
      <span class="min-w-0 flex-1">
        <span class="text-callout block truncate font-semibold">{{ me.displayName ?? 'Your account' }}</span>
        <span v-if="me.email" class="text-muted-foreground block truncate text-xs">{{ me.email }}</span>
      </span>
    </RouterLink>
  </template>
  <button
    v-else-if="!auth.isSignedIn"
    type="button"
    aria-label="Sign in and settings"
    title="Sign in"
    aria-haspopup="dialog"
    :aria-expanded="open"
    class="press hover:bg-accent text-primary relative flex size-9 items-center justify-center rounded-full after:absolute after:-inset-1"
    @click="show"
  >
    <UserRound class="size-5" />
  </button>
  <button
    v-else
    type="button"
    :aria-label="`Signed in as ${me.displayName ?? me.email ?? 'you'}`"
    aria-haspopup="dialog"
    :aria-expanded="open"
    class="press hover:ring-accent relative flex size-9 items-center justify-center rounded-full hover:ring-4 after:absolute after:-inset-1"
    @click="show"
  >
    <MeAvatar />
  </button>

  <Dialog v-if="variant === 'icon'" :open="open" variant="dropdown" aria-label="Your account" @close="open = false">
    <nav v-if="!auth.isSignedIn" aria-label="Your account" class="[&>div+div]:mt-1.5 [&>div+div]:border-t [&>div+div]:pt-1.5">
      <div>
        <button type="button" :class="row" @click="signIn">
          <LogIn class="size-5" /> Sign in
        </button>
        <button type="button" :class="row" @click="go({ name: 'settings' })">
          <Settings class="size-5" /> Settings
        </button>
      </div>
    </nav>
    <template v-else>
      <nav aria-label="Your account" class="[&>div+div]:mt-1.5 [&>div+div]:border-t [&>div+div]:pt-1.5">
        <div>
          <button type="button" :class="row" @click="go({ name: 'profile' })">
            <UserRound class="size-5" />
            <span class="min-w-0 flex-1">
              <span class="block truncate">{{ me.displayName ?? 'Your account' }}</span>
              <span v-if="me.email" class="text-muted-foreground block truncate text-sm font-medium">{{ me.email }}</span>
            </span>
          </button>
        </div>
        <div>
          <button type="button" :class="row" @click="go({ name: 'settings' })">
            <Settings class="size-5" /> Settings
          </button>
          <button type="button" :class="row" @click="signOut">
            <LogOut class="size-5" /> Sign out
          </button>
        </div>
      </nav>
    </template>
  </Dialog>
</template>
