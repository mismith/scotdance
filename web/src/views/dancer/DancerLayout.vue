<script setup lang="ts">
import { computed, toRef } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import DancerBottomNav from '@/components/nav/DancerBottomNav.vue'
import FavoriteDancerProfileButton from '@/components/FavoriteDancerProfileButton.vue'
import ShareButton from '@/components/ShareButton.vue'
import EmptyState from '@/components/EmptyState.vue'
import { UserSearch } from '@lucide/vue'
import { provideDancerProfile } from '@/composables/useDancerProfile'
import { useVtScope } from '@/lib/viewTransitionFocus'

const route = useRoute()
const dancerId = computed(() => String(route.params.dancerId ?? ''))

// Tag the current dancer as the view-transition source so back-nav re-tags
// the right row before the list remounts.
useVtScope('dancer').syncFocus(dancerId)

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
  <div class="flex flex-1 flex-col pb-(--chrome-bottom)">
    <nav class="pointer-events-none fixed inset-x-0 top-0 z-30 px-3 pt-(--safe-top)">
      <div class="mx-auto flex max-w-3xl items-center gap-2 pt-3">
        <RouterLink
          v-if="!isInfo"
          :to="{ name: 'dancer.info', params: { dancerId } }"
          class="bg-nav/90 text-nav-foreground pointer-events-auto flex min-w-0 flex-1 items-center gap-2 rounded-full p-1 pr-4 shadow-lg backdrop-blur-xl [view-transition-class:fixed-height] [view-transition-name:nav-pill] hover:opacity-90"
          :title="displayName"
        >
          <div
            class="bg-nav-foreground/15 flex size-10 shrink-0 items-center justify-center rounded-full text-lg font-medium [view-transition-class:nav-avatar] [view-transition-name:dancer-avatar]"
          >
            {{ initials || '?' }}
          </div>
          <div class="min-w-0 flex-1">
            <div
              class="truncate text-lg leading-none font-medium tracking-tight [view-transition-class:fit_nav-title] [view-transition-name:dancer-name]"
            >
              {{ displayName || (loading ? 'Loading…' : 'Dancer') }}
            </div>
            <div v-if="location" class="mt-1 truncate text-xs leading-none opacity-70">
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

    <main class="mx-auto w-full max-w-3xl flex-1 px-4 pt-(--chrome-top) pb-4">
      <EmptyState
        v-if="!loading && notFound"
        :icon="UserSearch"
        :title="`No record of ${displayName}`"
        description="We couldn’t find this dancer across the competitions we know about."
      />
      <RouterView v-else />
    </main>

    <DancerBottomNav />
  </div>
</template>
