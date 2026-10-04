<script setup lang="ts">
import { computed, onScopeDispose, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { get, onValue } from 'firebase/database'
import { ChevronRight, Plus, ShieldCheck, UserCog } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import Dialog from '@/components/Dialog.vue'
import EmptyState from '@/components/EmptyState.vue'
import Skeleton from '@/components/Skeleton.vue'
import MasterDetail from '@/components/admin/MasterDetail.vue'
import MovingList from '@/components/admin/MovingList.vue'
import SearchField from '@/components/admin/SearchField.vue'
import SectionHeader from '@/components/admin/SectionHeader.vue'
import TextField from '@/components/admin/TextField.vue'
import SwitchField from '@/components/admin/SwitchField.vue'
import VisibilityChip from '@/components/VisibilityChip.vue'
import { useSplit } from '@/composables/admin/useWide'
import { useCompetitions } from '@/composables/useCompetitions'
import { useHiddenAs } from '@/composables/useHiddenAs'
import { dataRef } from '@/firebase'
import { confirm, toast } from '@/lib/admin/feedback'
import { friendlyError, write } from '@/lib/admin/write'
import { formatLongDate } from '@/lib/format'
import { useMorph } from '@/lib/morph'
import { useAuthStore } from '@/stores/auth'

// Accounts, and who can manage what. Granting access here writes the same
// two records an accepted invite does.

interface UserRecord {
  id: string
  email?: string
  displayName?: string
  roles?: Record<string, boolean>
}
interface Perms {
  admin?: boolean
  competitions?: Record<string, boolean>
}

const route = useRoute()
const split = useSplit()
const auth = useAuthStore()

const users = ref<UserRecord[]>([])
const loaded = ref(false)
const loadError = ref(false)
get(dataRef('users'))
  .then((snap) => {
    const val = (snap.val() ?? {}) as Record<string, Omit<UserRecord, 'id'>>
    users.value = Object.entries(val)
      .map(([id, u]) => ({ ...u, id }))
      .sort((a, b) => (a.email ?? '~').localeCompare(b.email ?? '~'))
  })
  .catch(() => (loadError.value = true))
  .finally(() => (loaded.value = true))

const perms = ref<Record<string, Perms>>({})
const off = onValue(dataRef('users:permissions'), (snap) => (perms.value = (snap.val() ?? {}) as Record<string, Perms>))
onScopeDispose(off)

const { competitions } = useCompetitions(ref(true))
const competitionName = (id: string) => competitions.value.find((c) => c.id === id)?.name ?? 'A deleted competition'
const hiddenAs = useHiddenAs()

const query = ref('')
const shown = computed(() => {
  const q = query.value.trim().toLowerCase()
  const list = q ? users.value.filter((u) => `${u.email ?? ''} ${u.displayName ?? ''}`.toLowerCase().includes(q)) : users.value
  return list.slice(0, 200)
})

const uid = computed(() => (route.params.userId ? String(route.params.userId) : null))
const current = computed(() => users.value.find((u) => u.id === uid.value) ?? null)
const currentPerms = computed<Perms>(() => (uid.value ? (perms.value[uid.value] ?? {}) : {}))
const managed = computed(() => Object.entries(currentPerms.value.competitions ?? {}).filter(([, on]) => on).map(([id]) => id))

// The list is read once, so keep it in step with a rename here.
const saveName = (id: string) => async (v: string | null) => {
  await write({ [`users/${id}/displayName`]: v })
  users.value = users.value.map((u) => (u.id === id ? { ...u, displayName: v || undefined } : u))
}

const ROLE_NAMES: Record<string, string> = { parent: 'Parent', dancer: 'Dancer', teacher: 'Teacher', organizer: 'Organiser', judge: 'Judge', piper: 'Piper' }

async function setAdmin(on: boolean) {
  const id = uid.value
  if (!id) return
  if (!on && id === auth.uid) {
    const ok = await confirm({ title: 'Remove your own system admin access?', message: 'You won’t be able to get back here without someone else adding it.', confirmLabel: 'Remove', destructive: true })
    if (!ok) return
  }
  await write({ [`users:permissions/${id}/admin`]: on || null })
}

// Taking access away is one tap, so it can be undone from the toast. (For
// the same account: the undo may come after moving on to someone else.)
async function setCompetition(competitionId: string, on: boolean, id = uid.value) {
  if (!id) return
  try {
    await write({
      [`users:permissions/${id}/competitions/${competitionId}`]: on || null,
      [`competitions:permissions/${competitionId}/users/${id}`]: on || null,
    })
    if (on) toast(`Can now manage ${competitionName(competitionId)}`)
    else
      toast(`No longer manages ${competitionName(competitionId)}`, {
        action: { label: 'Undo', run: () => setCompetition(competitionId, true, id) },
      })
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  }
}

const picking = useMorph()
const pickQuery = ref('')
const pickChoices = computed(() => {
  const q = pickQuery.value.trim().toLowerCase()
  return competitions.value
    .filter((c) => !managed.value.includes(c.id) && (!q || (c.name ?? '').toLowerCase().includes(q)))
    .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')))
    .slice(0, 50)
})
function pick(id: string) {
  void picking.hide()
  pickQuery.value = ''
  void setCompetition(id, true)
}
</script>

<template>
  <MasterDetail :show-detail="!!uid">
    <template #list>
      <div class="bg-background sticky top-(--chrome-top) z-10 border-b p-4 md:top-0">
        <SectionHeader title="Users" :count="users.length || null">
          <SearchField v-model="query" label="Search users" placeholder="Search by email or name" />
        </SectionHeader>
      </div>
      <div v-if="!loaded" class="space-y-2 p-4"><Skeleton v-for="i in 6" :key="i" class="h-14 w-full rounded-xl!" /></div>
      <p v-else-if="loadError" class="text-destructive p-4 font-medium">Users couldn’t be loaded. Check your connection and reload.</p>
      <ul v-else class="divide-y">
        <li v-for="u in shown" :key="u.id">
          <RouterLink
            :to="{ name: 'admin.users', params: { userId: u.id } }"
            :replace="split"
            :aria-current="uid === u.id ? 'true' : undefined"
            :class="['press-row focus-inset flex min-h-14 items-center gap-3 px-4 py-2', uid === u.id && 'bg-blue-paper']"
          >
            <span class="min-w-0 flex-1">
              <span class="block truncate text-base font-medium">{{ u.displayName || u.email || 'No name' }}</span>
              <span v-if="u.displayName && u.email" class="text-muted-foreground block truncate text-sm">{{ u.email }}</span>
            </span>
            <ShieldCheck v-if="perms[u.id]?.admin" class="text-primary size-5 shrink-0" aria-label="System admin" />
            <span v-else-if="Object.keys(perms[u.id]?.competitions ?? {}).length" class="text-muted-foreground text-sm tabular-nums">{{ Object.keys(perms[u.id]?.competitions ?? {}).length }}</span>
            <ChevronRight class="text-muted-foreground size-5 shrink-0 md:hidden" />
          </RouterLink>
        </li>
        <li v-if="users.length > shown.length && !query" class="text-muted-foreground p-4 text-sm">Showing the first 200. Search to find someone.</li>
      </ul>
    </template>
    <template #empty>
      <div class="hidden h-full items-center justify-center md:flex">
        <EmptyState :icon="UserCog" title="Choose a user" description="See and change what they can manage here." />
      </div>
    </template>
    <template #detail>
      <div v-if="current" :key="current.id" class="mx-auto max-w-2xl space-y-8 p-4 pb-[calc(3rem+var(--safe-bottom))] md:p-8">
        <header class="space-y-1">
          <h2 class="text-display break-words">{{ current.displayName || current.email || 'No name' }}</h2>
          <p v-if="current.displayName && current.email" class="text-muted-foreground text-base">{{ current.email }}</p>
          <p v-if="current.roles" class="text-muted-foreground text-sm">
            {{ Object.keys(current.roles).filter((r) => current!.roles![r]).map((r) => ROLE_NAMES[r] ?? r).join(', ') }}
          </p>
        </header>
        <TextField :model-value="current.displayName" label="Name" :save="saveName(current.id)" />

        <section class="space-y-3">
          <h3 class="text-heading">Access</h3>
          <div class="surface rounded-2xl px-4 py-1.5">
            <SwitchField :model-value="!!currentPerms.admin" label="System admin" description="Can manage every competition and use these admin pages." :save="setAdmin" />
          </div>
          <div class="space-y-2">
            <p class="text-callout font-medium">Competitions they manage</p>
            <MovingList v-if="managed.length" class="surface divide-y overflow-hidden rounded-2xl">
              <li v-for="cid in managed" :key="cid" class="flex min-h-13 items-center gap-2 py-1 pr-2 pl-4">
                <RouterLink :to="{ name: 'manage', params: { competitionId: cid } }" class="text-primary flex min-h-11 min-w-0 flex-1 items-center gap-2 font-medium">
                  <span class="truncate">{{ competitionName(cid) }}</span>
                  <VisibilityChip :visibility="hiddenAs(cid)" />
                </RouterLink>
                <Button variant="plain" class="text-destructive!" @click="setCompetition(cid, false)">Remove</Button>
              </li>
            </MovingList>
            <p v-else class="text-muted-foreground text-sm">None.</p>
            <Button variant="tonal" @click="picking.show($event)">
              <Plus /> Add a competition
            </Button>
          </div>
        </section>
      </div>
      <EmptyState v-else-if="loaded" :icon="UserCog" title="This account isn’t here" />
    </template>
  </MasterDetail>

  <Dialog :open="picking.open" :morph="picking" variant="sheet" size="md" @close="picking.hide()">
    <template #header>
      <h2 class="text-title">Let them manage…</h2>
    </template>
    <div class="p-4">
      <SearchField v-model="pickQuery" label="Find a competition" />
    </div>
    <ul class="divide-y pb-[var(--safe-bottom)]">
      <li v-for="c in pickChoices" :key="c.id">
        <button type="button" class="press-row focus-inset flex min-h-14 w-full flex-col justify-center px-4 py-2 text-left" @click="pick(c.id)">
          <span class="text-base font-medium">{{ c.name || 'Untitled' }}</span>
          <span class="text-muted-foreground flex items-center gap-2 text-sm">
            {{ c.date ? formatLongDate(c.date) : '' }}
            <VisibilityChip :visibility="hiddenAs(c.id, c)" />
          </span>
        </button>
      </li>
    </ul>
  </Dialog>
</template>
