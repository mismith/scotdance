<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import AccountMenu from '@/components/AccountMenu.vue'

const route = useRoute()
const dancerId = computed(() => String(route.params.dancerId ?? ''))

// Provisional: derive a display name from the slug until profile data lands.
const displayName = computed(() =>
  dancerId.value
    .split('-')
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' '),
)
const initials = computed(() => {
  const parts = displayName.value.split(' ').filter(Boolean)
  return (parts[0]?.charAt(0) ?? '?') + (parts.at(-1)?.charAt(0) ?? '')
})
</script>

<template>
  <div class="relative flex flex-1 flex-col">
    <!-- Pink editorial hero band — dancer profiles read as personal/yours. -->
    <div
      class="from-secondary relative h-32 overflow-hidden text-white"
      style="
        background-image: linear-gradient(
          160deg,
          var(--secondary) 0%,
          color-mix(in oklch, var(--secondary) 60%, black) 100%
        );
      "
    >
      <div
        aria-hidden="true"
        class="absolute inset-0"
        style="
          background-image: radial-gradient(
            70% 60% at 30% 20%,
            rgba(255, 255, 255, 0.18) 0%,
            transparent 70%
          );
        "
      />
    </div>

    <header
      class="sticky top-0 z-20 -mt-32 border-b border-white/15 bg-zinc-950/55 text-white backdrop-blur-xl"
    >
      <div class="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
        <div
          class="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/15 backdrop-blur-md"
        >
          <span class="text-xs font-semibold uppercase">{{ initials || '?' }}</span>
        </div>
        <div class="min-w-0 flex-1">
          <h1
            class="font-serif truncate text-base font-medium tracking-tight leading-[1.1]"
          >
            {{ displayName || 'Dancer' }}
          </h1>
          <p class="truncate font-mono text-[11px] text-white/60">{{ dancerId }}</p>
        </div>
        <AccountMenu />
      </div>
    </header>

    <main class="mx-auto w-full max-w-3xl flex-1 p-4">
      <RouterView />
    </main>
  </div>
</template>
