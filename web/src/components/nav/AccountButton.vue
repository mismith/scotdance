<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter, type RouteLocationRaw } from 'vue-router'
import { ClipboardList, LogIn, LogOut, Pencil, ServerCog, Settings, UserRound } from '@lucide/vue'
import AdminMark from '@/components/AdminMark.vue'
import Dialog from '@/components/Dialog.vue'
import { useAuthStore } from '@/stores/auth'
import { useMeStore } from '@/stores/me'
import { useRoles } from '@/composables/useRoles'
import { gravatarUrl } from '@/lib/gravatar'
import { initialsOf } from '@/lib/format'

// Top right of every page: who you're signed in as. Tapping it opens a small
// menu: your account, Manage, Settings, Sign out. Signed out, it opens Sign
// in and Settings, so Settings is always one tap from anywhere.
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
// Same rule as the More menu: anyone who manages a competition, or said they run them.
const roles = useRoles()
const canManage = computed(() => me.canManageAny || roles.has('organizer'))

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
  <button
    v-if="!auth.isSignedIn"
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
    <img v-if="avatar" :src="avatar" alt="" class="size-8 rounded-full" />
    <span v-else class="bg-primary-fill text-primary-foreground flex size-8 items-center justify-center rounded-full text-xs font-semibold">{{ initials }}</span>
  </button>

  <Dialog :open="open" variant="dropdown" aria-label="Your account" @close="open = false">
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
        <div v-if="canManageHere || canManage || me.isAdmin">
          <button v-if="canManageHere" type="button" :class="row" @click="go({ name: 'manage', params: { competitionId } })">
            <span class="relative flex text-muted-foreground"><Pencil class="size-5" /><AdminMark ring="raised" /></span> Manage this competition
          </button>
          <button v-if="canManage" type="button" :class="row" @click="go({ name: 'manage.competitions' })">
            <span class="relative flex text-muted-foreground"><ClipboardList class="size-5" /><AdminMark ring="raised" /></span> Manage competitions
          </button>
          <button v-if="me.isAdmin" type="button" :class="row" @click="go({ name: 'admin' })">
            <span class="relative flex text-muted-foreground"><ServerCog class="size-5" /><AdminMark ring="raised" /></span> System admin
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
