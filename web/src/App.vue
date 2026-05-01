<script setup lang="ts">
import { RouterView } from 'vue-router';
import AppShell from '@/components/AppShell.vue';
import LoginDialog from '@/components/LoginDialog.vue';
</script>

<template>
  <AppShell>
    <RouterView />
  </AppShell>
  <LoginDialog />
</template>
