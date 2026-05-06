<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import AccountMenu from '@/components/AccountMenu.vue'

const route = useRoute()
const dancerId = computed(() => String(route.params.dancerId ?? ''))

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
  <div class="flex flex-1 flex-col">
    <!-- Pink hero band -->
    <div
      class="relative h-32 shrink-0 overflow-hidden text-white"
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
        class="pointer-events-none absolute inset-0"
        style="
          background-image: radial-gradient(
            70% 60% at 30% 20%,
            rgba(255, 255, 255, 0.18) 0%,
            transparent 70%
          );
        "
      />
    </div>

    <!-- Floating chrome (no chevron — bottom-nav home button leaves the
         dancer profile) -->
    <div
      class="top-safe sticky z-30 -mt-22 mb-11 mx-auto flex w-full max-w-3xl items-center gap-2 px-3"
    >
      <div
        class="flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-full border border-white/15 bg-zinc-950/55 pr-3.5 pl-1.5 text-white shadow-md backdrop-blur-xl"
      >
        <div
          class="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/15"
        >
          <span class="text-[10px] font-semibold uppercase">{{ initials || '?' }}</span>
        </div>
        <h1
          class="font-serif min-w-0 flex-1 truncate text-sm font-medium tracking-tight leading-tight"
        >
          {{ displayName || 'Dancer' }}
        </h1>
      </div>
      <div
        class="flex size-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-zinc-950/55 text-white shadow-md backdrop-blur-xl [&_button]:text-white/85 [&_button]:hover:bg-white/10! [&_button]:hover:text-white"
      >
        <AccountMenu />
      </div>
    </div>

    <main class="mx-auto w-full max-w-3xl flex-1 p-4">
      <RouterView />
    </main>
  </div>
</template>
