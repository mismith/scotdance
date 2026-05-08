<script setup lang="ts">
import { computed, toRef } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import FavoriteDancerProfileButton from '@/components/FavoriteDancerProfileButton.vue'
import ShareButton from '@/components/ShareButton.vue'
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
          class="bg-nav/90 text-nav-foreground pointer-events-auto flex min-w-0 flex-1 items-center gap-2 rounded-full p-1 pr-4 shadow-lg backdrop-blur-xl [view-transition-class:fixed-height] [view-transition-group:contain] [view-transition-name:nav-pill] hover:opacity-90"
          :title="displayName"
        >
          <div
            class="bg-nav-foreground/15 flex size-10 shrink-0 items-center justify-center rounded-full font-serif text-sm font-medium [view-transition-name:nav-avatar]"
          >
            {{ initials || '?' }}
          </div>
          <div class="min-w-0 flex-1">
            <div
              class="truncate font-serif text-sm leading-tight font-medium tracking-tight [view-transition-class:fit] [view-transition-name:nav-name]"
            >
              {{ displayName || (loading ? 'Loading…' : 'Dancer') }}
            </div>
            <div
              v-if="location"
              class="truncate text-[10px] leading-tight opacity-70 [view-transition-name:nav-location]"
            >
              {{ location }}
            </div>
          </div>
        </RouterLink>

        <div v-else class="min-w-0 flex-1" />

        <div
          class="bg-nav/90 text-nav-foreground pointer-events-auto flex h-12 shrink-0 items-center gap-0.5 rounded-full px-1.5 shadow-lg backdrop-blur-xl [view-transition-class:clip_fixed-height] [view-transition-group:contain] [view-transition-name:nav-actions]"
        >
          <FavoriteDancerProfileButton
            v-if="isInfo"
            :appearances="appearances"
            :name="displayName"
            class="flex! size-9 items-center justify-center rounded-full! p-0! hover:bg-nav-foreground/10! [view-transition-name:match-element]"
          />
          <ShareButton
            :title="displayName || undefined"
            :text="displayName || undefined"
            class="flex! size-9 items-center justify-center rounded-full! p-0! hover:bg-nav-foreground/10! [view-transition-name:match-element]"
          />
        </div>
      </div>
    </nav>

    <main class="pt-safe-nav mx-auto w-full max-w-3xl flex-1 px-4 pb-4">
      <div v-if="loading" class="text-muted-foreground font-serif text-sm italic">
        Searching across competitions…
      </div>
      <div v-else-if="notFound" class="text-muted-foreground font-serif text-sm italic">
        No record of {{ displayName }} found across the comps we know about.
      </div>
      <RouterView v-else />
    </main>
  </div>
</template>
