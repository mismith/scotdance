<script setup lang="ts">
import { computed, type Component } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import ShareButton from '@/components/ShareButton.vue'
import TopBackButton from '@/components/nav/TopBackButton.vue'
import EmptyState from '@/components/EmptyState.vue'
import { Calendars, Info } from '@lucide/vue'
import { smartBackClick } from '@/lib/back'
import { sectionMeta } from '@/lib/sectionMeta'
import { usePageTitle } from '@/composables/usePageTitle'
import { provideInfoHeader } from '@/composables/useScrolledPast'

// Shared shell for entity profile pages (judge / piper / venue / dancer).
// Per-entity wrappers just pass props + drive the data composable; everything
// else (header, empty state, RouterView, tabs, share button) lives here.

type Tab = { name: string; to: string; icon: Component }

const props = withDefaults(
  defineProps<{
    /** VT scope name. Used for view-transition-name elements (`{scope}-avatar`, etc). */
    scope: 'judge' | 'piper' | 'venue' | 'dancer'
    /** Aggregate id (route param value). */
    id: string
    /** Route param key — e.g. 'judgeId', 'dancerId'. */
    idParam: string
    /** Route name prefix. Drives default tabs (`{prefix}.info`, `{prefix}.competitions`). */
    routePrefix: string
    /** Route name of the section index this profile belongs to (e.g. 'judges').
     *  Drives the bottom-left back pill's icon, label, and target — all read
     *  from the route's icon/title meta. */
    sectionRouteName: string
    displayName: string
    image?: string | null
    /** Icon shown in the avatar when no image. Falls back to initials. */
    fallbackIcon?: Component
    /** Initials shown in the avatar when no image and no fallback icon. */
    initials?: string
    loading: boolean
    notFound: boolean
    emptyTitle: string
    emptyDescription: string
    /** Bottom-right nav tabs. First tab is treated as the "home" tab (top-nav
     *  name pill hides when active). Defaults to Info + Competitions. */
    tabs?: Tab[]
    /** Apply favorite color treatment to the avatar (dancer pattern). */
    isFavorite?: boolean
  }>(),
  {
    image: null,
    initials: '',
    isFavorite: false,
  },
)

const TYPE_LABEL: Record<typeof props.scope, string> = {
  judge: 'Judge',
  piper: 'Piper',
  venue: 'Venue',
  dancer: 'Dancer',
}
const typeLabel = computed(() => TYPE_LABEL[props.scope])

const route = useRoute()
const router = useRouter()

const section = computed(() => sectionMeta(props.sectionRouteName))

const resolvedTabs = computed<Tab[]>(
  () =>
    props.tabs ?? [
      { name: 'Info', to: `${props.routePrefix}.info`, icon: Info },
      { name: 'Competitions', to: `${props.routePrefix}.competitions`, icon: Calendars },
    ],
)
const isInfo = computed(() => String(route.name ?? '') === resolvedTabs.value[0]?.to)
const activeTab = computed(() => {
  const name = String(route.name ?? '')
  return resolvedTabs.value.find((t) => t.to === name)?.to
})
const activeTabLabel = computed(
  () => resolvedTabs.value.find((t) => t.to === activeTab.value)?.name,
)

usePageTitle(() => [
  activeTabLabel.value,
  props.notFound ? 'Not found' : props.displayName,
  section.value.label,
])

const params = computed(() => ({ [props.idParam]: props.id }))

// Per-scope literals so Tailwind can detect them at build time. Maps to one
// arbitrary class per scope — kept here rather than templated into a single
// `[view-transition-name:${scope}-avatar]` because Tailwind only generates
// rules for class strings it can see statically.
const SCOPE_AVATAR_VT_CLASS: Record<typeof props.scope, string> = {
  judge: '[view-transition-name:judge-avatar]',
  piper: '[view-transition-name:piper-avatar]',
  venue: '[view-transition-name:venue-avatar]',
  dancer: '[view-transition-name:dancer-avatar]',
}
const SCOPE_NAME_VT_CLASS: Record<typeof props.scope, string> = {
  judge: '[view-transition-name:judge-name]',
  piper: '[view-transition-name:piper-name]',
  venue: '[view-transition-name:venue-name]',
  dancer: '[view-transition-name:dancer-name]',
}
const avatarVtClass = computed(() => SCOPE_AVATAR_VT_CLASS[props.scope])
const nameVtClass = computed(() => SCOPE_NAME_VT_CLASS[props.scope])

// Child Info component registers its <header> ref via this provide; once the
// header scrolls past the fixed nav, the small-title name pill fades in.
// The child reads `scrolledPast` to drop its own VT name classes while the
// pill is the visible representation, so only one element ever owns a given
// view-transition-name at VT capture time.
const { scrolledPast: scrolledPastInfoHeader } = provideInfoHeader()
const showNamePill = computed(() => !isInfo.value || scrolledPastInfoHeader.value)
</script>

<template>
  <div class="flex flex-1 flex-col pb-[calc(var(--chrome-bottom)+1rem)]">
    <!-- Top nav: back / pill / actions -->
    <nav class="pointer-events-none fixed inset-x-0 top-0 z-30 px-4 pt-(--nav-top)">
      <div class="mx-auto flex max-w-3xl items-center gap-2">
        <TopBackButton />

        <div class="min-w-0 flex-1">
          <RouterLink
            v-if="resolvedTabs[0]"
            :to="{ name: resolvedTabs[0].to, params }"
            :class="[
              'floating-nav ease-rubber-band flex w-full items-center gap-2 rounded-full p-1 pr-4 transition [view-transition-class:fixed-height]',
              showNamePill
                ? 'pointer-events-auto translate-y-0 opacity-100 [view-transition-name:nav-pill] hover:opacity-90'
                : 'pointer-events-none -translate-y-full opacity-0',
            ]"
            :title="displayName"
          >
            <div
              :class="[
                'flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-lg font-medium [view-transition-class:nav-avatar]',
                isFavorite
                  ? 'bg-secondary text-secondary-foreground'
                  : 'bg-card-foreground/15',
                showNamePill && avatarVtClass,
              ]"
            >
              <img
                v-if="image"
                :src="image"
                :alt="displayName"
                class="size-full object-cover"
              />
              <component :is="fallbackIcon" v-else-if="fallbackIcon" class="size-5" />
              <template v-else>{{ initials || '?' }}</template>
            </div>
            <div class="min-w-0 flex-1">
              <div
                :class="[
                  'truncate text-lg leading-none font-medium tracking-tight [view-transition-class:fit_nav-title]',
                  showNamePill && nameVtClass,
                ]"
              >
                {{ displayName || (loading ? 'Loading…' : '') }}
              </div>
              <div
                :class="[
                  'mt-1 truncate text-xs leading-none opacity-70',
                  showNamePill &&
                    '[view-transition-class:fit] [view-transition-name:nav-subtitle]',
                ]"
              >
                {{ typeLabel }}
              </div>
            </div>
          </RouterLink>
        </div>

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

    <main
      class="mx-auto w-full max-w-3xl flex-1 px-4 pt-[calc(var(--chrome-top)+1rem)] pb-4"
    >
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
            v-for="tab in resolvedTabs"
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
