<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter, type RouteLocationRaw } from 'vue-router'
import { ClipboardList, LogIn, LogOut, Pencil, Settings, UserRound } from '@lucide/vue'
import Dialog from '@/components/Dialog.vue'
import { useAuthStore } from '@/stores/auth'
import { useMeStore } from '@/stores/me'
import { gravatarUrl } from '@/lib/gravatar'
import { initialsOf } from '@/lib/format'

// Who you're signed in as, from a top bar: inside a competition the tab bar
// is the competition's, so the More menu (and your account) isn't there.
// Tapping it opens a small menu: your account, Manage, Settings, Sign out.
const props = defineProps<{ competitionId?: string }>()

const router = useRouter()
const auth = useAuthStore()
const me = useMeStore()

const avatar = ref<string | null>(null)
watch(
  () => me.email,
  async (email) => (avatar.value = await gravatarUrl(email, 64)),
  { immediate: true },
)
const initials = computed(() => initialsOf(me.displayName ?? me.email ?? '?'))
const canManageHere = computed(() => !!props.competitionId && me.hasCompetitionPerm(props.competitionId))

const button = ref<HTMLButtonElement | null>(null)
const open = ref(false)
function show() {
  // Line the menu's right edge up with the button.
  const r = button.value?.getBoundingClientRect()
  if (r) document.documentElement.style.setProperty('--dropdown-right', `${Math.max(12, window.innerWidth - r.right)}px`)
  open.value = true
}
function go(to: RouteLocationRaw) {
  open.value = false
  void router.push(to)
}
async function signOut() {
  open.value = false
  await auth.signOut()
}

const row = 'flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left text-base font-bold hover:bg-accent focus-visible:-outline-offset-2'
</script>

<template>
  <button
    v-if="!auth.isSignedIn"
    type="button"
    aria-label="Sign in"
    title="Sign in"
    class="hover:bg-accent text-primary flex size-9 items-center justify-center rounded-full"
    @click="auth.openLogin({ reason: 'account' })"
  >
    <LogIn class="size-5" />
  </button>
  <template v-else>
    <button
      ref="button"
      type="button"
      :aria-label="`Signed in as ${me.displayName ?? me.email ?? 'you'}`"
      aria-haspopup="dialog"
      :aria-expanded="open"
      class="hover:ring-accent flex size-9 items-center justify-center rounded-full hover:ring-4"
      @click="show"
    >
      <img v-if="avatar" :src="avatar" alt="" class="size-8 rounded-full" />
      <span v-else class="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-full text-xs font-extrabold">{{ initials }}</span>
    </button>

    <Dialog :open="open" variant="dropdown" aria-label="Your account" @close="open = false">
      <nav aria-label="Your account" class="divide-y">
        <div class="py-1">
          <button type="button" :class="row" @click="go({ name: 'profile' })">
            <UserRound class="text-primary size-5 shrink-0" />
            <span class="min-w-0 flex-1">
              <span class="block truncate">{{ me.displayName ?? 'Your account' }}</span>
              <span v-if="me.email" class="text-muted-foreground block truncate text-sm font-medium">{{ me.email }}</span>
            </span>
          </button>
        </div>
        <div v-if="canManageHere || me.canManageAny" class="py-1">
          <button v-if="canManageHere" type="button" :class="row" @click="go({ name: 'manage', params: { competitionId } })">
            <Pencil class="text-primary size-5" /> Manage this competition
          </button>
          <button v-if="me.canManageAny" type="button" :class="row" @click="go({ name: 'manage.competitions' })">
            <ClipboardList class="text-primary size-5" /> Manage competitions
          </button>
        </div>
        <div class="py-1">
          <button type="button" :class="row" @click="go({ name: 'settings' })">
            <Settings class="text-primary size-5" /> Settings
          </button>
          <button type="button" :class="row" @click="signOut">
            <LogOut class="text-primary size-5" /> Sign out
          </button>
        </div>
      </nav>
    </Dialog>
  </template>
</template>
