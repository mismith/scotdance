<script setup lang="ts">
import { computed, toRef } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import DancerBottomNav from '@/components/nav/DancerBottomNav.vue'
import FavoriteDancerProfileButton from '@/components/FavoriteDancerProfileButton.vue'
import ShareButton from '@/components/ShareButton.vue'
import Skeleton from '@/components/Skeleton.vue'
import EmptyState from '@/components/EmptyState.vue'
import { UserSearch } from '@lucide/vue'
import { provideDancerProfile } from '@/composables/useDancerProfile'

const route = useRoute()
const dancerId = computed(() => String(route.params.dancerId ?? ''))

const { displayName, location, appearances, loading, notFound } = provideDancerProfile(
  toRef(dancerId),
)

const isInfo = computed(() => String(route.name ?? '') === 'dancer.info')

const initials = computed(() => {
  const parts = displayName.value.split(' ').filter(Boolean)
  return (parts[0]?.charAt(0) ?? '?') + (parts.at(-1)?.charAt(0) ?? '')
})
</script>

<template>
  <div class="flex flex-1 flex-col">
    <nav class="pt-safe pointer-events-none fixed inset-x-0 top-0 z-30 px-3">
      <div class="mx-auto flex max-w-3xl items-center gap-2 pt-3">
        <RouterLink
          v-if="!isInfo"
          :to="{ name: 'dancer.info', params: { dancerId } }"
          class="bg-nav/90 text-nav-foreground pointer-events-auto flex min-w-0 flex-1 items-center gap-2 rounded-full p-1 pr-4 shadow-lg backdrop-blur-xl [view-transition-name:nav-pill] hover:opacity-90"
          :title="displayName"
        >
          <div
            class="bg-nav-foreground/15 flex size-10 shrink-0 items-center justify-center rounded-full font-serif text-lg font-medium [view-transition-name:nav-avatar]"
          >
            {{ initials || '?' }}
          </div>
          <div class="min-w-0 flex-1">
            <div
              class="truncate font-serif text-lg leading-none font-medium tracking-tight [view-transition-class:fit] [view-transition-name:nav-name]"
            >
              {{ displayName || (loading ? 'Loading…' : 'Dancer') }}
            </div>
            <div
              v-if="location"
              class="mt-1 truncate text-xs leading-none opacity-70 [view-transition-name:nav-location]"
            >
              {{ location }}
            </div>
          </div>
        </RouterLink>

        <div v-else class="min-w-0 flex-1" />

        <div
          class="bg-nav/90 text-nav-foreground pointer-events-auto flex h-12 shrink-0 items-center gap-0.5 rounded-full px-1.5 shadow-lg backdrop-blur-xl [view-transition-class:fixed-height] [view-transition-name:nav-actions]"
        >
          <FavoriteDancerProfileButton
            v-if="isInfo"
            :appearances="appearances"
            :name="displayName"
            class="hover:bg-nav-foreground/10! flex! size-9! items-center justify-center rounded-full! p-0! [view-transition-name:match-element]"
          />
          <ShareButton
            :title="displayName || undefined"
            class="hover:bg-nav-foreground/10! flex! size-9! items-center justify-center rounded-full! p-0! [view-transition-name:match-element]"
          />
        </div>
      </div>
    </nav>

    <main class="pt-safe-nav mx-auto w-full max-w-3xl flex-1 px-4 pb-4">
      <div v-if="loading" class="space-y-5" aria-busy="true" aria-live="polite">
        <span class="sr-only">Searching across competitions…</span>
        <header class="space-y-3 pr-16">
          <Skeleton class="size-20 rounded-full!" />
          <Skeleton class="h-9 w-3/4" />
          <Skeleton class="h-5 w-1/2" />
        </header>
        <div class="grid grid-cols-2 gap-2">
          <Skeleton v-for="i in 4" :key="i" class="h-20" />
        </div>
        <div class="space-y-2">
          <Skeleton class="h-3 w-24" />
          <Skeleton class="h-14 w-full" />
        </div>
      </div>
      <EmptyState
        v-else-if="notFound"
        :icon="UserSearch"
        :title="`No record of ${displayName}`"
        description="We couldn’t find this dancer across the competitions we know about."
      />
      <RouterView v-else />
    </main>

    <DancerBottomNav />
  </div>
</template>
