<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { ArrowDownToLine, CalendarDays, ClipboardList, Gavel, House, Info, Landmark, LifeBuoy, Music, School, Search, ServerCog, Settings, SquarePlus, Users } from '@lucide/vue'
import LogoMark from '@/components/LogoMark.vue'
import AccountButton from '@/components/nav/AccountButton.vue'
import SidebarLink from '@/components/nav/SidebarLink.vue'
import { useCrisp } from '@/composables/useCrisp'
import { useRoles } from '@/composables/useRoles'
import { useUpdate } from '@/composables/useUpdate'
import { useMeStore } from '@/stores/me'

// Wide screens (lg up): the whole app's navigation in one sidebar, on every
// page, in place of the tab bars and the More menu. Where you are nests
// under where it belongs, on a guide line: a competition
// and its tabs under Competitions, a profile under its list, a competition
// you manage and its sections under Manage. The pages add their
// own branch (nav/SidebarBranch, into the `sidebar-*` slots below). Your
// account sits at the foot. A card on the page's ground, so no edge line;
// the groups need no headings or rules: space sets them apart. Through page changes the sidebar stays put: each row is named, so
// rows glide to where they now sit and branches unfold or fold away
// (style.css, .sidebar).
const route = useRoute()
const me = useMeStore()
const roles = useRoles()
const crisp = useCrisp()
const update = useUpdate()
const canManage = computed(() => me.canManageAny || roles.has('organizer'))

const name = computed(() => String(route.name ?? ''))
// Inside a competition's pages, or one you manage (both have their own layout).
const inCompetition = computed(() => route.matched.some((r) => r.meta.ownsBottomNav && !r.meta.admin))
const inManage = computed(() => route.matched.some((r) => r.meta.admin) && !!route.params.competitionId)
const inAdmin = computed(() => route.matched.some((r) => r.name === 'admin'))

const state = (current: boolean, open = false) => (current ? 'current' : open ? 'open' : null)

const browse = [
  { label: 'Dancers', icon: Users, route: 'dancers', profile: 'dancer.' },
  { label: 'Judges', icon: Gavel, route: 'judges', profile: 'judge.' },
  { label: 'Pipers', icon: Music, route: 'pipers', profile: 'piper.' },
  { label: 'Venues', icon: School, route: 'venues', profile: 'venue.' },
  { label: 'Organisations', icon: Landmark, route: 'organisations', profile: 'organisation.' },
]
const vt = (name: string) => ({ viewTransitionName: `sidebar-${name}`, viewTransitionClass: 'sidebar' })
</script>

<template>
  <aside
    data-nav-axis="y"
    class="bg-card fixed inset-y-0 left-0 z-30 hidden w-(--chrome-left) flex-col pt-(--safe-top) pl-(--safe-left) [view-transition-name:sidebar] lg:flex"
  >
    <RouterLink
      :to="{ name: 'home' }"
      class="focus-inset mx-3 flex h-14 shrink-0 items-center gap-2.5 rounded-xl px-3"
      aria-label="ScotDance.app, Home"
      :style="vt('brand')"
    >
      <LogoMark class="text-primary size-6" />
      <span class="text-heading">ScotDance.app</span>
    </RouterLink>

    <!-- Rows scroll out under soft edges (in the padding, so nothing's faded at
         rest). Its rows' transition groups nest in its own, so they stay
         inside it as they glide (style.css, .sidebar). -->
    <nav
      aria-label="ScotDance.app"
      class="flex flex-1 flex-col gap-5 overflow-y-auto px-3 pt-2 pb-4 mask-t-from-[calc(100%-0.5rem)] mask-b-from-[calc(100%-1rem)] [view-transition-group:contain] [view-transition-name:sidebar-nav]"
    >
      <ul class="space-y-0.5">
        <li><SidebarLink :to="{ name: 'home' }" :icon="House" label="Home" :state="state(name === 'home')" vt="sidebar-home" /></li>
        <li>
          <SidebarLink :to="{ name: 'competitions' }" :icon="CalendarDays" label="Competitions" :state="state(name === 'competitions', inCompetition)" vt="sidebar-competitions" />
          <div id="sidebar-competitions" />
        </li>
        <li><SidebarLink :to="{ name: 'search' }" :icon="Search" label="Search" :state="state(name === 'search')" vt="sidebar-search" /></li>
      </ul>

      <!-- Inside a competition's Manage its sections lead: the browsing lists
           fold away so Results and Admins stay above the fold on a laptop. -->
      <ul v-if="!inManage" class="space-y-0.5">
        <li v-for="b in browse" :key="b.route">
          <SidebarLink :to="{ name: b.route }" :icon="b.icon" :label="b.label" :state="state(name === b.route, name.startsWith(b.profile))" :vt="`sidebar-${b.route}`" />
          <div :id="`sidebar-${b.route}`" />
        </li>
      </ul>

      <ul class="space-y-0.5">
        <li v-if="!inManage">
          <SidebarLink :to="{ name: 'competitions.submit' }" :icon="SquarePlus" label="Submit a competition" :state="state(name === 'competitions.submit')" vt="sidebar-submit" />
        </li>
        <li v-if="canManage">
          <SidebarLink
            :to="{ name: 'manage.competitions' }"
            :icon="ClipboardList"
            label="Manage"
            :state="state(name === 'manage.competitions', inManage)"
            admin
            vt="sidebar-manage"
          />
          <div id="sidebar-manage" />
        </li>
        <li v-if="me.isAdmin">
          <SidebarLink :to="{ name: 'admin' }" :icon="ServerCog" label="System admin" :state="state(name === 'admin', inAdmin)" admin vt="sidebar-admin" />
          <div id="sidebar-admin" />
        </li>
      </ul>

      <!-- About, Settings and help sink to the bottom, above you. -->
      <ul class="mt-auto space-y-0.5">
        <li v-if="!inManage"><SidebarLink :to="{ name: 'about' }" :icon="Info" label="About ScotDance.app" :state="state(name === 'about')" vt="sidebar-about" /></li>
        <li><SidebarLink :to="{ name: 'settings' }" :icon="Settings" label="Settings" :state="state(name === 'settings')" vt="sidebar-settings" /></li>
        <li v-if="crisp.available">
          <button
            type="button"
            class="press-row focus-inset text-callout flex min-h-10 w-full items-center gap-3 rounded-xl px-3 py-1.5 text-left font-medium"
            :style="vt('help')"
            @click="crisp.open()"
          >
            <LifeBuoy class="text-muted-foreground size-5 shrink-0" aria-hidden="true" />
            <span class="flex-1">Help</span>
            <span v-if="crisp.unread > 0" class="bg-secondary text-secondary-foreground rounded-full px-2 text-sm">{{ crisp.unread }}</span>
          </button>
        </li>
        <li v-if="update.updateAvailable">
          <button
            type="button"
            class="press-row focus-inset text-callout flex min-h-10 w-full items-center gap-3 rounded-xl px-3 py-1.5 text-left font-medium"
            :style="vt('update')"
            @click="update.openDialog()"
          >
            <ArrowDownToLine class="text-primary size-5 shrink-0" aria-hidden="true" />
            Update available
          </button>
        </li>
      </ul>
    </nav>

    <!-- You, at the foot: your Account page (or Sign in). -->
    <div class="shrink-0 px-3 pb-[max(0.75rem,var(--safe-bottom))]" :style="vt('account')">
      <AccountButton variant="row" />
    </div>
  </aside>
</template>
