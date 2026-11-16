<script setup lang="ts">
import Avatar from '@/components/Avatar.vue'
defineProps<{ name: string; email?: string | null; image?: string | null }>()
</script>
<template>
  <header class="mb-5 space-y-2">
    <div class="flex items-center gap-4">
      <Avatar :name="name" :email="email" :image="image" size="lg" you />
      <h1 class="text-hero">Account</h1>
    </div>
    <p class="text-muted-foreground text-sm">
      Your picture comes from
      <a
        href="https://gravatar.com/"
        target="_blank"
        rel="noopener"
        class="text-primary font-semibold"
        >Gravatar</a
      >.
    </p>
  </header>
</template>
