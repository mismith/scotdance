<script setup lang="ts">
import { computed, ref } from 'vue';
import { onClickOutside } from '@vueuse/core';
import { LogIn, LogOut, User } from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const open = ref(false);
const menuRef = ref<HTMLElement | null>(null);

onClickOutside(menuRef, () => (open.value = false));

const initial = computed(() => {
  const name = auth.displayName ?? '';
  return (name[0] ?? '?').toUpperCase();
});

function handleClick() {
  if (auth.isSignedIn) {
    open.value = !open.value;
  } else {
    auth.openLogin();
  }
}

async function handleSignOut() {
  open.value = false;
  await auth.signOut();
}
</script>

<template>
  <div ref="menuRef" class="relative">
    <button
      type="button"
      @click="handleClick"
      :title="auth.isSignedIn ? (auth.displayName ?? 'Account') : 'Sign in'"
      class="inline-flex items-center gap-2 p-1 rounded-full hover:bg-accent text-muted-foreground hover:text-foreground"
    >
      <img
        v-if="auth.photoURL"
        :src="auth.photoURL"
        :alt="auth.displayName ?? ''"
        class="size-7 rounded-full"
      />
      <span
        v-else-if="auth.isSignedIn"
        class="size-7 rounded-full bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center"
      >
        {{ initial }}
      </span>
      <LogIn v-else class="size-5 mr-1 ml-1" />
    </button>

    <div
      v-if="open && auth.isSignedIn"
      class="absolute right-0 top-full mt-1 z-40 w-64 rounded-md border bg-background shadow-lg p-1"
    >
      <div class="px-3 py-2 border-b">
        <div class="text-xs text-muted-foreground">Signed in as</div>
        <div class="text-sm font-medium truncate">{{ auth.displayName ?? '—' }}</div>
      </div>
      <button
        type="button"
        disabled
        class="w-full flex items-center gap-2 px-3 py-2 rounded text-sm text-muted-foreground cursor-not-allowed"
        title="Coming soon"
      >
        <User class="size-4" />
        <span>Profile</span>
      </button>
      <button
        type="button"
        class="w-full flex items-center gap-2 px-3 py-2 rounded text-sm hover:bg-accent"
        @click="handleSignOut"
      >
        <LogOut class="size-4" />
        <span>Sign out</span>
      </button>
    </div>
  </div>
</template>
