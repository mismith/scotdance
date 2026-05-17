<script setup lang="ts">
import { computed, type Component } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import ShareButton from '@/components/ShareButton.vue'
import EmptyState from '@/components/EmptyState.vue'
import { ChevronLeft, Info, Trophy } from '@lucide/vue'
import { preferBackClick, smartBackClick, useExternalBack } from '@/lib/back'
import { sectionMeta } from '@/lib/sectionMeta'

// Shared shell for entity profile pages (judge / piper / venue / dancer).
// Per-entity wrappers just pass props + drive the data composable; everything
// else (header, empty state, RouterView, tabs, share button) lives here.

const props = withDefaults(
  defineProps<{
    /** VT scope name. Used for view-transition-name elements (`{scope}-avatar`, etc). */
    scope: 'judge' | 'piper' | 'venue' | 'dancer'
    /** Aggregate id (route param value). */
    id: string
    /** Route param key — e.g. 'judgeId', 'dancerId'. */
    idParam: string
    /** Route name prefix — info/results derive from this, e.g. 'judge' → 'judge.info'. */
    routePrefix: string
    /** Route name of the section index this profile belongs to (e.g. 'judges').
     *  Drives the bottom-left back pill's icon, label, and target — all read
     *  from the route's sectionIcon/sectionLabel meta. */
    sectionRouteName: string
    displayName: string
    subtitle?: string | null
    image?: string | null
    /** Icon shown in the avatar when no image. Falls back to initials. */
    fallbackIcon?: Component
    /** Initials shown in the avatar when no image and no fallback icon. */
    initials?: string
    loading: boolean
    notFound: boolean
    emptyTitle: string
    emptyDescription: string
    /** Label for the second (non-Info) tab. Defaults to "Competitions". */
    resultsTabLabel?: string
    /** Apply favorite color treatment to the avatar (dancer pattern). */
    isFavorite?: boolean
  }>(),
  {
    resultsTabLabel: 'Competitions',
    subtitle: null,
    image: null,
    initials: '',
    isFavorite: false,
  },
)

const route = useRoute()
const router = useRouter()

const section = computed(() => sectionMeta(props.sectionRouteName))

const externalBack = useExternalBack(section.value.to)

const infoRoute = computed(() => `${props.routePrefix}.info`)
const resultsRoute = computed(() => `${props.routePrefix}.results`)
const isInfo = computed(() => String(route.name ?? '') === infoRoute.value)

const tabs = computed(() => [
  { name: 'Info', to: infoRoute.value, icon: Info },
  { name: props.resultsTabLabel, to: resultsRoute.value, icon: Trophy },
])
const activeTab = computed(() => {
  const name = String(route.name ?? '')
  return tabs.value.find((t) => t.to === name)?.to
})

const params = computed(() => ({ [props.idParam]: props.id }))

const avatarVtName = computed(() => `${props.scope}-avatar`)
const nameVtName = computed(() => `${props.scope}-name`)
</script>

<template>
  <div class="flex flex-1 flex-col pb-[calc(var(--chrome-bottom)+1rem)]">
    <!-- Top nav: back / pill / actions -->
    <nav class="pointer-events-none fixed inset-x-0 top-0 z-30 px-4 pt-(--nav-top)">
      <div class="mx-auto flex max-w-3xl items-center gap-2">
        <RouterLink
          v-if="externalBack.show.value && externalBack.to.value"
          v-slot="{ href, navigate }"
          :to="externalBack.to.value"
          custom
        >
          <a
            :href="href"
            class="floating-nav pointer-events-auto flex size-12 shrink-0 items-center justify-center rounded-full [view-transition-name:nav-back] hover:opacity-90"
            title="Back"
            aria-label="Back"
            @click="preferBackClick(router, $event, navigate)"
          >
            <ChevronLeft class="size-5" />
          </a>
        </RouterLink>

        <RouterLink
          v-if="!isInfo"
          :to="{ name: infoRoute, params }"
          class="floating-nav pointer-events-auto flex min-w-0 flex-1 items-center gap-2 rounded-full p-1 pr-4 [view-transition-class:fixed-height] [view-transition-name:nav-pill] hover:opacity-90"
          :title="displayName"
        >
          <div
            :class="[
              'flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-lg font-medium [view-transition-class:nav-avatar]',
              isFavorite ? 'bg-secondary text-secondary-foreground' : 'bg-card-foreground/15',
            ]"
            :style="{ viewTransitionName: avatarVtName }"
          >
            <img
              v-if="image"
              :src="image"
              :alt="displayName"
              class="size-full object-cover"
            />
            <component
              :is="fallbackIcon"
              v-else-if="fallbackIcon"
              class="size-5"
            />
            <template v-else>{{ initials || '?' }}</template>
          </div>
          <div class="min-w-0 flex-1">
            <div
              class="truncate text-lg leading-none font-medium tracking-tight [view-transition-class:fit_nav-title]"
              :style="{ viewTransitionName: nameVtName }"
            >
              {{ displayName || (loading ? 'Loading…' : '') }}
            </div>
            <div
              v-if="subtitle"
              class="mt-1 truncate text-xs leading-none opacity-70"
            >
              {{ subtitle }}
            </div>
          </div>
        </RouterLink>

        <div v-else class="min-w-0 flex-1" />

        <div
          class="floating-nav pointer-events-auto flex h-12 shrink-0 items-center gap-0.5 rounded-full px-1.5 [view-transition-class:fixed-height] [view-transition-name:nav-actions]"
        >
          <slot name="actions" />
          <ShareButton
            :title="displayName || undefined"
            class="hover:bg-card-foreground/10! flex! size-9! items-center justify-center rounded-full! p-0! [view-transition-name:match-element]"
          />
        </div>
      </div>
    </nav>

    <main class="mx-auto w-full max-w-3xl flex-1 px-4 pt-[calc(var(--chrome-top)+1rem)] pb-4">
      <EmptyState
        v-if="!loading && notFound"
        :icon="section.icon"
        :title="emptyTitle"
        :description="emptyDescription"
      />
      <RouterView v-else />
    </main>

    <!-- Bottom nav: section back + tabs -->
    <nav class="pointer-events-none fixed inset-x-0 bottom-(--nav-bottom) z-30 px-3">
      <div class="mx-auto flex max-w-3xl items-center justify-between">
        <RouterLink v-slot="{ href, route: r, navigate }" :to="section.to" custom>
          <a
            :href="href"
            class="floating-nav pointer-events-auto flex size-16 items-center justify-center rounded-full [view-transition-class:clip] [view-transition-name:nav-left] hover:opacity-90"
            :title="`Back to ${section.label}`"
            :aria-label="`Back to ${section.label}`"
            @click="smartBackClick(router, $event, r.fullPath, navigate)"
          >
            <span class="[view-transition-name:match-element]">
              <component :is="section.icon" class="size-5" />
            </span>
          </a>
        </RouterLink>
        <div
          class="floating-nav pointer-events-auto flex items-center rounded-full p-1 [view-transition-class:clip] [view-transition-name:nav-right]"
        >
          <RouterLink
            v-for="tab in tabs"
            :key="tab.to"
            :to="{ name: tab.to, params }"
            :class="[
              'relative isolate flex h-14 min-w-16 shrink-0 flex-col items-center justify-center gap-1 rounded-full px-3 font-sans font-medium transition-colors [view-transition-name:match-element]',
              activeTab === tab.to
                ? `before:bg-card-foreground/10 before:absolute before:inset-0 before:-z-10 before:rounded-full before:[view-transition-class:fixed-height] before:[view-transition-name:nav-right-active]`
                : 'opacity-70 hover:opacity-100',
            ]"
          >
            <component :is="tab.icon" class="size-5" />
            <span class="text-xs leading-none">{{ tab.name }}</span>
          </RouterLink>
        </div>
      </div>
    </nav>
  </div>
</template>
