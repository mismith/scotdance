<script setup lang="ts">
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
</script>

<template>
  <main class="min-h-svh flex items-center justify-center p-8">
    <div class="max-w-md text-center space-y-4">
      <h1 class="text-3xl font-semibold tracking-tight">ScotDance.app</h1>
      <p class="text-muted-foreground">v4 scaffold is alive.</p>
      <p class="text-sm text-muted-foreground">
        Signed in: <span class="font-mono">{{ auth.isSignedIn }}</span>
      </p>
    </div>
  </main>
</template>
