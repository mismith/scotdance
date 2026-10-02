<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import SidebarLink from '@/components/nav/SidebarLink.vue'

// A page's place in the sidebar (wide screens): nested under its parent's
// row in nav/AppSidebar (the `sidebar-<under>` slot), on one guide line from
// that row's icon, so the hierarchy reads at a glance. `label` names this
// level (a competition, a profile): a link when it has `to`, else a heading
// over its children (which start with its own overview).
// The branch is named for page changes, so it unfolds as it opens and folds
// away as it closes while the rows below make room (style.css, .sidebar).
const props = defineProps<{
  under: string
  label?: string | null
  to?: RouteLocationRaw
  current?: boolean
}>()
</script>

<template>
  <Teleport defer :to="`#sidebar-${props.under}`">
    <!-- The guide line sits under the middle of the parent row's icon. -->
    <div class="mt-0.5 ml-[1.3125rem] space-y-0.5 border-l-2 pl-2" :style="{ viewTransitionName: `sidebar-branch-${props.under}`, viewTransitionClass: 'sidebar sidebar-branch' }">
      <template v-if="props.label">
        <SidebarLink v-if="props.to" :to="props.to" :label="props.label" :state="props.current ? 'current' : 'open'" />
        <p v-else class="text-callout text-foreground px-3 py-1.5 leading-snug font-semibold" :title="props.label">
          <span class="line-clamp-2">{{ props.label }}</span>
        </p>
      </template>
      <slot />
    </div>
  </Teleport>
</template>
