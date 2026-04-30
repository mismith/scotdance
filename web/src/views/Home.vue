<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const router = useRouter();
const competitionId = ref('');

function go() {
  const id = competitionId.value.trim();
  if (!id) return;
  router.push({ name: 'competition.info', params: { competitionId: id } });
}
</script>

<template>
  <main class="min-h-svh flex items-center justify-center p-8">
    <div class="max-w-md w-full text-center space-y-6">
      <div class="space-y-2">
        <h1 class="text-3xl font-semibold tracking-tight">ScotDance.app</h1>
        <p class="text-muted-foreground text-sm">v4 scaffold is alive.</p>
        <p class="text-xs text-muted-foreground">
          Signed in: <span class="font-mono">{{ auth.isSignedIn }}</span>
        </p>
      </div>

      <form class="flex gap-2" @submit.prevent="go">
        <input
          v-model="competitionId"
          type="text"
          placeholder="Competition ID"
          class="flex-1 px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="submit"
          class="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
          :disabled="!competitionId.trim()"
        >
          Open
        </button>
      </form>
    </div>
  </main>
</template>
