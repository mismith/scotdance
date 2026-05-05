<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { onKeyStroke } from '@vueuse/core';
import { useRoute, RouterLink } from 'vue-router';
import {
  ArrowDownToLine,
  CalendarDays,
  Home,
  Menu,
  Monitor,
  Moon,
  Sun,
  Users,
  X,
} from '@lucide/vue';
import { useUpdate } from '@/composables/useUpdate';
import { useTheme, type Theme } from '@/composables/useTheme';
import AccountMenu from './AccountMenu.vue';

const drawerOpen = ref(false);
const route = useRoute();
const update = useUpdate();
const { theme } = useTheme();

const themeOptions: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'auto', label: 'System', icon: Monitor },
  { value: 'dark', label: 'Dark', icon: Moon },
];

function openUpdateDialog() {
  drawerOpen.value = false;
  update.openDialog();
}

const navItems = computed(() => {
  const items: Array<{ name: string; to: { name: string }; icon: typeof Home }> = [
    { name: 'Home', to: { name: 'home' }, icon: Home },
    { name: 'Competitions', to: { name: 'competitions' }, icon: CalendarDays },
    { name: 'Dancers', to: { name: 'dancers' }, icon: Users },
  ];
  return items;
});

watch(
  () => route.fullPath,
  () => {
    drawerOpen.value = false;
  },
);

onKeyStroke('Escape', () => {
  if (drawerOpen.value) drawerOpen.value = false;
});
</script>

<template>
  <div class="flex min-h-svh flex-col">
    <header
      class="bg-background/95 supports-backdrop-filter:bg-background/80 sticky top-0 z-30 border-b backdrop-blur"
    >
      <div class="mx-auto flex h-14 max-w-3xl items-center gap-2 px-2 sm:px-4">
        <button
          type="button"
          class="hover:bg-accent text-muted-foreground hover:text-foreground relative rounded-md p-2"
          title="Menu"
          aria-label="Open menu"
          @click="drawerOpen = true"
        >
          <Menu class="size-5" />
          <span
            v-if="update.updateAvailable"
            class="bg-secondary ring-background absolute top-1.5 right-1.5 size-2 rounded-full ring-2"
            aria-hidden="true"
          />
        </button>
        <RouterLink
          :to="{ name: 'home' }"
          class="hover:text-primary min-w-0 flex-1 truncate font-semibold tracking-tight"
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
      <div v-if="drawerOpen" class="fixed inset-0 z-40 bg-black/50" @click="drawerOpen = false" />
    </transition>

    <transition
      enter-active-class="transition-transform duration-200"
      leave-active-class="transition-transform duration-200"
      enter-from-class="-translate-x-full"
      leave-to-class="-translate-x-full"
    >
      <aside
        v-if="drawerOpen"
        class="bg-background fixed top-0 bottom-0 left-0 z-40 flex w-72 max-w-[85vw] flex-col border-r shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
      >
        <div class="flex h-14 items-center justify-between border-b px-4">
          <span class="font-semibold tracking-tight">ScotDance.app</span>
          <button
            type="button"
            class="hover:bg-accent text-muted-foreground hover:text-foreground rounded-md p-2"
            aria-label="Close menu"
            @click="drawerOpen = false"
          >
            <X class="size-5" />
          </button>
        </div>
        <nav class="flex-1 space-y-1 p-2">
          <RouterLink
            v-for="item in navItems"
            :key="item.name"
            :to="item.to"
            class="hover:bg-accent flex items-center gap-3 rounded-md px-3 py-2 text-sm"
            active-class="bg-accent text-foreground"
          >
            <component :is="item.icon" class="text-muted-foreground size-4" />
            <span>{{ item.name }}</span>
          </RouterLink>
        </nav>
        <div class="space-y-2 border-t p-2">
          <div
            class="bg-muted grid grid-cols-3 gap-1 rounded-md p-1"
            role="radiogroup"
            aria-label="Theme"
          >
            <button
              v-for="opt in themeOptions"
              :key="opt.value"
              type="button"
              role="radio"
              :aria-checked="theme === opt.value"
              :title="opt.label"
              :class="[
                'flex items-center justify-center gap-1.5 rounded-sm py-1.5 text-xs font-medium transition-colors',
                theme === opt.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              ]"
              @click="theme = opt.value"
            >
              <component :is="opt.icon" class="size-3.5" />
              <span>{{ opt.label }}</span>
            </button>
          </div>

          <button
            v-if="update.updateAvailable"
            type="button"
            class="hover:bg-accent flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm"
            @click="openUpdateDialog"
          >
            <ArrowDownToLine class="text-secondary size-4" />
            <span class="flex-1">Update available</span>
            <span class="bg-secondary size-2 rounded-full" aria-hidden="true" />
          </button>
        </div>
      </aside>
    </transition>
  </div>
</template>
