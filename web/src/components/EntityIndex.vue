<script setup lang="ts">
import { computed, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronRight } from '@lucide/vue'
import AccountAvatarButton from '@/components/AccountAvatarButton.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import Skeleton from '@/components/Skeleton.vue'
import { sectionMeta } from '@/lib/sectionMeta'
import { focusVt, useVtScope } from '@/lib/viewTransitionFocus'
import {
  useEntityAggregates,
  type AggregateRow,
} from '@/composables/useEntityAggregates'
import { useFavoritesStore, type FavoriteType } from '@/stores/favorites'

// Generic alphabetical list of /{namespace} aggregates. Each entity's index
// page is a tiny wrapper around this — passes the namespace, route prefix,
// VT scope, and a `subtitleOf` mapper for whatever line lives under the name.

const props = defineProps<{
  /** RTDB namespace, e.g. 'judges'. Doubles as the section route name — page
   *  title + avatar icon are pulled from its title/icon meta. */
  namespace: string
  /** VT scope name used by the corresponding {Entity}Layout. */
  vtScope: string
  /** Route name prefix — `${routePrefix}.info` is the navigation target. */
  routePrefix: string
  /** Route param name passed to `params`, e.g. 'judgeId'. */
  idParam: string
  /** Returns the subtitle text for an aggregate row. */
  subtitleOf: (agg: AggregateRow) => string
  emptyMessage?: string
}>()

const router = useRouter()
const vt = useVtScope(props.vtScope)
const section = computed(() => sectionMeta(props.namespace))

const entry = useEntityAggregates(props.namespace)
const aggregates = entry.data
const loading = entry.loading
const error = entry.error

const favorites = useFavoritesStore()

const sorted = computed(() =>
  [...aggregates.value].sort((a, b) => (a.agg.name ?? '').localeCompare(b.agg.name ?? '')),
)

// Favourites: cross-reference the slim cache for subtitle data; fall back to
// the denormed name stored alongside the favourite when the entity isn't in
// the cache yet (e.g. recently favourited but list still loading).
const favoriteRows = computed(() => {
  const map = favorites.byType(props.namespace as FavoriteType)
  const cache = new Map(aggregates.value.map((r) => [r.id, r.agg]))
  return Object.entries(map)
    .filter(([, v]) => Boolean(v))
    .map(([id, v]) => ({
      id,
      agg: cache.get(id) ?? ({ name: typeof v === 'string' ? v : '' } as AggregateRow),
    }))
    .sort((a, b) => (a.agg.name ?? '').localeCompare(b.agg.name ?? ''))
})

async function open(id: string) {
  focusVt(props.vtScope, id)
  await nextTick()
  router.push({ name: `${props.routePrefix}.info`, params: { [props.idParam]: id } })
}
</script>

<template>
  <div class="flex flex-1 flex-col pt-2 pb-[calc(var(--chrome-bottom)+1rem)]">
    <nav class="pointer-events-none fixed inset-x-0 top-0 z-30 px-4 pt-(--nav-top)">
      <div class="pointer-events-auto mx-auto flex max-w-3xl justify-end">
        <AccountAvatarButton />
      </div>
    </nav>

    <main class="mx-auto w-full max-w-3xl flex-1 space-y-6 p-4">
      <h1 class="pr-14 font-serif text-3xl font-medium tracking-tight">
        {{ section.label }}
      </h1>

      <div v-if="error" class="text-destructive text-lg">{{ error.message }}</div>

      <template v-else>
        <section v-if="loading" class="space-y-2" aria-busy="true">
          <Skeleton class="h-4 w-32" />
          <div v-for="i in 6" :key="i" class="flex items-center gap-3 py-3">
            <Skeleton class="size-9 shrink-0 rounded-full!" />
            <div class="flex-1 space-y-2">
              <Skeleton class="h-5 w-2/3" />
              <Skeleton class="h-4 w-1/3" />
            </div>
          </div>
        </section>

        <div
          v-else-if="!sorted.length"
          class="text-muted-foreground text-lg italic"
        >
          {{ emptyMessage || `No ${section.label.toLowerCase()} yet.` }}
        </div>

        <section v-if="favoriteRows.length" class="space-y-2">
          <SectionHeader label="Favourites" :count="favoriteRows.length" />
          <ul>
            <li v-for="row in favoriteRows" :key="row.id">
              <button
                type="button"
                class="flex w-full items-center gap-3 px-1 py-3 text-left"
                @click="open(row.id)"
              >
                <span
                  class="bg-secondary text-secondary-foreground flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full font-medium [view-transition-class:nav-avatar]"
                  :style="{ viewTransitionName: vt.name(row.id, 'avatar') }"
                >
                  <component :is="section.icon" v-if="section.icon" class="size-4" />
                </span>
                <div class="min-w-0 flex-1">
                  <div
                    class="text-item-title truncate [view-transition-class:fit_nav-title]"
                    :style="{ viewTransitionName: vt.name(row.id, 'name') }"
                  >
                    {{ row.agg.name || '?' }}
                  </div>
                  <div
                    v-if="subtitleOf(row.agg)"
                    class="text-item-subtitle text-muted-foreground truncate"
                  >
                    {{ subtitleOf(row.agg) }}
                  </div>
                </div>
                <ChevronRight class="text-muted-foreground size-4 shrink-0" />
              </button>
            </li>
          </ul>
        </section>

        <section v-if="sorted.length" class="space-y-2">
          <SectionHeader label="All" :count="sorted.length" />
          <ul>
            <li v-for="row in sorted" :key="row.id">
              <button
                type="button"
                class="flex w-full items-center gap-3 px-1 py-3 text-left"
                @click="open(row.id)"
              >
                <span
                  class="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full font-medium [view-transition-class:nav-avatar]"
                  :style="{ viewTransitionName: vt.name(row.id, 'avatar') }"
                >
                  <component :is="section.icon" v-if="section.icon" class="size-4" />
                </span>
                <div class="min-w-0 flex-1">
                  <div
                    class="text-item-title truncate [view-transition-class:fit_nav-title]"
                    :style="{ viewTransitionName: vt.name(row.id, 'name') }"
                  >
                    {{ row.agg.name || '?' }}
                  </div>
                  <div
                    v-if="subtitleOf(row.agg)"
                    class="text-item-subtitle text-muted-foreground truncate"
                  >
                    {{ subtitleOf(row.agg) }}
                  </div>
                </div>
                <ChevronRight class="text-muted-foreground size-4 shrink-0" />
              </button>
            </li>
          </ul>
        </section>
      </template>
    </main>
  </div>
</template>
