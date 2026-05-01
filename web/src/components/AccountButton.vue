<script setup lang="ts">
import { LogIn, LogOut } from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();

async function handleClick() {
  if (auth.isSignedIn) {
    await auth.signOut();
  } else {
    await auth.signInWithGoogle();
  }
}
</script>

<template>
  <button
    type="button"
    @click="handleClick"
    :title="auth.isSignedIn ? `Sign out (${auth.displayName ?? 'signed in'})` : 'Sign in with Google'"
    class="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm hover:bg-accent text-muted-foreground hover:text-foreground"
  >
    <img
      v-if="auth.photoURL"
      :src="auth.photoURL"
      :alt="auth.displayName ?? ''"
      class="size-6 rounded-full"
    />
    <component v-else :is="auth.isSignedIn ? LogOut : LogIn" class="size-4" />
    <span class="hidden sm:inline">
      {{ auth.isSignedIn ? 'Sign out' : 'Sign in' }}
    </span>
  </button>
</template>
