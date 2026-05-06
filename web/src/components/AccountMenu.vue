<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { useRouter } from 'vue-router'
import { LogOut, User } from '@lucide/vue'
import { useAuthStore } from '@/stores/auth'
import { useMeStore } from '@/stores/me'
import { gravatarUrl } from '@/lib/gravatar'

const auth = useAuthStore()
const me = useMeStore()
const router = useRouter()
const open = ref(false)
const menuRef = ref<HTMLElement | null>(null)

onClickOutside(menuRef, () => (open.value = false))

const initial = computed(() => {
  const name = me.displayName ?? me.email ?? ''
  return (name[0] ?? '?').toUpperCase()
})

const avatarUrl = ref<string | null>(null)
watch(
  () => me.email,
  async (email) => {
    avatarUrl.value = await gravatarUrl(email, 56)
  },
  { immediate: true },
)

function handleClick() {
  if (auth.isSignedIn) {
    open.value = !open.value
  } else {
    auth.openLogin()
  }
}

function goProfile() {
  open.value = false
  router.push({ name: 'profile' })
}

async function handleSignOut() {
  open.value = false
  await auth.signOut()
}
</script>

<template>
  <div ref="menuRef" class="relative">
    <button
      type="button"
      :title="auth.isSignedIn ? (auth.displayName ?? 'Account') : 'Sign in'"
      class="hover:bg-accent text-muted-foreground hover:text-foreground inline-flex items-center gap-2 rounded-full p-1"
      @click="handleClick"
    >
      <img
        v-if="auth.isSignedIn && avatarUrl"
        :src="avatarUrl"
        :alt="me.displayName ?? me.email ?? ''"
        class="bg-muted size-7 rounded-full"
      />
      <span
        v-else-if="auth.isSignedIn"
        class="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-full text-xs font-medium"
      >
        {{ initial }}
      </span>
      <User v-else class="mr-1 ml-1 size-5" />
    </button>

    <div
      v-if="open && auth.isSignedIn"
      class="bg-nav/90 text-nav-foreground absolute top-full right-0 z-40 mt-2 w-64 rounded-2xl border border-white/10 p-1 shadow-lg backdrop-blur-xl"
    >
      <div class="border-b border-white/10 px-3 py-2">
        <div class="text-[10px] font-semibold tracking-[0.14em] uppercase opacity-60">
          Signed in as
        </div>
        <div class="font-serif truncate text-sm font-medium tracking-tight">
          {{ me.displayName ?? me.email ?? '—' }}
        </div>
      </div>
      <button
        type="button"
        class="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-nav-foreground/10"
        @click="goProfile"
      >
        <User class="size-4" />
        <span>Profile</span>
      </button>
      <button
        type="button"
        class="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-nav-foreground/10"
        @click="handleSignOut"
      >
        <LogOut class="size-4" />
        <span>Sign out</span>
      </button>
    </div>
  </div>
</template>
