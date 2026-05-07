<script setup lang="ts">
import { computed, toRef } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { provideDancerProfile } from '@/composables/useDancerProfile'

const route = useRoute()
const dancerId = computed(() => String(route.params.dancerId ?? ''))

const { displayName, location, groupName, loading, notFound } = provideDancerProfile(
  toRef(dancerId),
)

const initials = computed(() => {
  const parts = displayName.value.split(' ').filter(Boolean)
  return (parts[0]?.charAt(0) ?? '?') + (parts.at(-1)?.charAt(0) ?? '')
})

const subtitle = computed(() => {
  const parts = [groupName.value, location.value].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
})
</script>

<template>
  <div class="flex flex-1 flex-col">
    <header
      class="sticky top-0 z-30 overflow-hidden pt-safe text-white"
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
      <div class="relative mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
        <div
          class="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/15 font-serif text-sm font-medium"
        >
          {{ initials || '?' }}
        </div>
        <div class="min-w-0 flex-1">
          <h1
            class="font-serif truncate text-lg font-medium tracking-tight leading-tight"
          >
            {{ displayName || 'Dancer' }}
          </h1>
          <p class="truncate text-[11px] text-white/70">
            {{ subtitle || 'Across every comp' }}
          </p>
        </div>
      </div>
    </header>

    <main class="mx-auto w-full max-w-3xl flex-1 p-4 pt-6">
      <div
        v-if="loading"
        class="text-muted-foreground font-serif text-sm italic"
      >
        Searching across competitions…
      </div>
      <div
        v-else-if="notFound"
        class="text-muted-foreground font-serif text-sm italic"
      >
        No record of {{ displayName }} found across the comps we know about.
      </div>
      <RouterView v-else />
    </main>
  </div>
</template>
