<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter, type RouteLocationRaw } from 'vue-router'
import { ArrowDownToLine, ClipboardList, Gavel, Info, LifeBuoy, Music, School, ServerCog, SquarePlus, Users } from '@lucide/vue'
import AdminMark from '@/components/AdminMark.vue'
import Dialog from '@/components/Dialog.vue'
import { useCrisp } from '@/composables/useCrisp'
import { useUpdate } from '@/composables/useUpdate'
import { useMeStore } from '@/stores/me'
import { useRoles } from '@/composables/useRoles'
import type { Morph } from '@/lib/morph'

// The More tab's menu: grows out of the tab, one tap to the people lists,
// submitting a competition, About, and (for organisers) Manage. Your account
// and Settings are in the account menu at the top right of every page.
const props = defineProps<{ menu: Morph }>()

const router = useRouter()
const me = useMeStore()
const roles = useRoles()
// Organisers (and anyone who said they run competitions) and system admins
// find their tools at the bottom, here and in the account menu.
const canManage = computed(() => me.canManageAny || roles.has('organizer'))
const crisp = useCrisp()
const update = useUpdate()

const browse = [
  { label: 'Dancers', icon: Users, to: { name: 'dancers' } },
  { label: 'Judges', icon: Gavel, to: { name: 'judges' } },
  { label: 'Pipers', icon: Music, to: { name: 'pipers' } },
  { label: 'Venues', icon: School, to: { name: 'venues' } },
]

// The page you're on (or under) is marked, so going to another moves the way
// the list runs: lower down, in from the right (lib/navMotion).
const route = useRoute()
function here(to: RouteLocationRaw) {
  const path = router.resolve(to).path
  return route.path === path || route.path.startsWith(`${path}/`) ? '' : undefined
}

function go(to: RouteLocationRaw) {
  props.menu.dismiss()
  router.push(to)
}
function run(action: () => void) {
  props.menu.dismiss()
  action()
}

// One menu anatomy: inset rounded rows, medium labels, muted icons.
const row =
  'press-row focus-inset flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-base font-medium [&>svg]:text-muted-foreground [&>svg]:size-5 [&>svg]:shrink-0'
</script>

<template>
  <Dialog :open="menu.open" :morph="menu" variant="dropdown" aria-label="More" @close="menu.hide()">
    <nav aria-label="More" data-nav="more" class="[&>div+div]:mt-1.5 [&>div+div]:border-t [&>div+div]:pt-1.5">
      <div>
        <button v-for="b in browse" :key="b.label" type="button" :class="row" :data-current="here(b.to)" @click="go(b.to)">
          <component :is="b.icon" class="size-5" /> {{ b.label }}
        </button>
      </div>
      <div>
        <button v-if="update.updateAvailable" type="button" :class="row" @click="run(() => update.openDialog())">
          <ArrowDownToLine class="text-primary! size-5" /> Update available
        </button>
        <button type="button" :class="row" :data-current="here({ name: 'about' })" @click="go({ name: 'about' })">
          <Info class="size-5" /> About ScotDance.app
        </button>
        <button v-if="crisp.available" type="button" :class="row" @click="run(() => crisp.open())">
          <LifeBuoy class="size-5" />
          <span class="flex-1">Help</span>
          <span v-if="crisp.unread > 0" class="bg-secondary text-secondary-foreground rounded-full px-2 text-sm">{{ crisp.unread }}</span>
        </button>
      </div>
      <!-- For organisers: submitting, managing, and (admins) the whole system. -->
      <div>
        <button type="button" :class="row" :data-current="here({ name: 'competitions.submit' })" @click="go({ name: 'competitions.submit' })">
          <SquarePlus class="size-5" /> Submit a competition
        </button>
        <button v-if="canManage" type="button" :class="row" :data-current="here({ name: 'manage.competitions' })" @click="go({ name: 'manage.competitions' })">
          <span class="relative flex text-muted-foreground"><ClipboardList class="size-5" /><AdminMark ring="raised" /></span> Manage competitions
        </button>
        <button v-if="me.isAdmin" type="button" :class="row" :data-current="here({ name: 'admin' })" @click="go({ name: 'admin' })">
          <span class="relative flex text-muted-foreground"><ServerCog class="size-5" /><AdminMark ring="raised" /></span> System admin
        </button>
      </div>
    </nav>
  </Dialog>
</template>
