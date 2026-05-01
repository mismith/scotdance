<script setup lang="ts">
import { ref, watch } from 'vue';
import { onKeyStroke } from '@vueuse/core';
import { useRoute, RouterLink } from 'vue-router';
import { CalendarDays, Home, Menu, X } from 'lucide-vue-next';
import AccountMenu from './AccountMenu.vue';

const drawerOpen = ref(false);
const route = useRoute();

const navItems = [
  { name: 'Home', to: { name: 'home' }, icon: Home },
  { name: 'Competitions', to: { name: 'competitions' }, icon: CalendarDays },
];

watch(() => route.fullPath, () => {
  drawerOpen.value = false;
});

onKeyStroke('Escape', () => {
  if (drawerOpen.value) drawerOpen.value = false;
});
</script>

<template>
  <div class="min-h-svh flex flex-col">
    <header class="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b">
      <div class="max-w-3xl mx-auto px-2 sm:px-4 h-14 flex items-center gap-2">
        <button
          type="button"
          class="p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground"
          title="Menu"
          aria-label="Open menu"
          @click="drawerOpen = true"
        >
          <Menu class="size-5" />
        </button>
        <RouterLink
          :to="{ name: 'home' }"
          class="flex-1 min-w-0 truncate font-semibold tracking-tight hover:text-primary"
        >
          ScotDance.app
        </RouterLink>
        <AccountMenu />
      </div>
    </header>

    <slot />

    <transition
      enter-active-class="transition-opacity duration-150"
      leave-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="drawerOpen"
        class="fixed inset-0 z-40 bg-black/50"
        @click="drawerOpen = false"
      />
    </transition>

    <transition
      enter-active-class="transition-transform duration-200"
      leave-active-class="transition-transform duration-200"
      enter-from-class="-translate-x-full"
      leave-to-class="-translate-x-full"
    >
      <aside
        v-if="drawerOpen"
        class="fixed left-0 top-0 bottom-0 z-40 w-72 max-w-[85vw] bg-background border-r shadow-xl flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
      >
        <div class="h-14 px-4 flex items-center justify-between border-b">
          <span class="font-semibold tracking-tight">ScotDance.app</span>
          <button
            type="button"
            class="p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground"
            aria-label="Close menu"
            @click="drawerOpen = false"
          >
            <X class="size-5" />
          </button>
        </div>
        <nav class="flex-1 p-2 space-y-1">
          <RouterLink
            v-for="item in navItems"
            :key="item.name"
            :to="item.to"
            class="flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-accent"
            active-class="bg-accent text-foreground"
          >
            <component :is="item.icon" class="size-4 text-muted-foreground" />
            <span>{{ item.name }}</span>
          </RouterLink>
        </nav>
      </aside>
    </transition>
  </div>
</template>
