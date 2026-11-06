<script setup lang="ts">
import { computed, toRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EntityLayout from '@/components/EntityLayout.vue'
import DancerHideButton from '@/components/admin/DancerHideButton.vue'
import DancerBottomNav from '@/components/nav/DancerBottomNav.vue'
import GlobalBottomNav from '@/components/nav/GlobalBottomNav.vue'
import SidebarBranch from '@/components/nav/SidebarBranch.vue'
import { provideDancerProfile } from '@/composables/useDancerProfile'
import { provideDancerRecord } from '@/composables/useDancerRecord'

// A dancer across every competition. Signed in (and not hidden by a family's
// request) it has its own tabs, Overview · Results; otherwise it's
// the basic profile, one page, with the app's usual bottom nav. The route
// says `ownsBottomNav` for both, so App skips its own bar and this layout
// brings whichever one fits (the bar can't depend on who's signed in or on
// whether this dancer is hidden: route meta is static).
const route = useRoute()
const router = useRouter()
const dancerId = computed(() => String(route.params.dancerId ?? ''))

const profile = provideDancerProfile(toRef(dancerId))
const { displayName, loading, notFound } = profile
const { rich, pending } = provideDancerRecord(dancerId, profile)

// The tabs only exist for the full profile: a link to one (or signing out
// on it) lands on the one page.
watch(
  [() => route.name, pending, rich],
  ([name, wait, full]) => {
    if (wait || full || name !== 'dancer.results') return
    void router.replace({ name: 'dancer.info', params: { dancerId: dancerId.value } })
  },
  { immediate: true },
)
</script>

<template>
  <EntityLayout
    scope="dancer"
    section-route-name="dancers"
    :display-name="displayName"
    :loading="loading"
    :not-found="notFound"
    :title-always="route.name !== 'dancer.info'"
    empty-title="Dancer not found"
    empty-description="This dancer isn’t listed at any competition on ScotDance.app. The link may be out of date; try searching by name."
  >
    <template #actions>
      <DancerHideButton :dancer-id="dancerId" :name="displayName" />
    </template>
    <template #nav>
      <DancerBottomNav v-if="rich" :name="displayName" />
      <template v-else>
        <GlobalBottomNav v-if="!pending" />
        <SidebarBranch v-if="displayName" under="dancers" :label="displayName" :to="route.path" current />
      </template>
    </template>
  </EntityLayout>
</template>
