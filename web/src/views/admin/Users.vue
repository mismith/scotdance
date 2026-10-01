<script setup lang="ts">
import { computed, onScopeDispose, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { get, onValue } from 'firebase/database'
import { ChevronRight, Plus, Search, ShieldCheck, UserCog, X } from '@lucide/vue'
import Dialog from '@/components/Dialog.vue'
import EmptyState from '@/components/EmptyState.vue'
import Skeleton from '@/components/Skeleton.vue'
import MasterDetail from '@/components/admin/MasterDetail.vue'
import TextField from '@/components/admin/TextField.vue'
import SwitchField from '@/components/admin/SwitchField.vue'
import { useSplit } from '@/composables/admin/useWide'
import { useCompetitions } from '@/composables/useCompetitions'
import { dataRef } from '@/firebase'
import { confirm, toast } from '@/lib/admin/feedback'
import { friendlyError, write } from '@/lib/admin/write'
import { formatLongDate } from '@/lib/format'
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

async function setCompetition(competitionId: string, on: boolean) {
  const id = uid.value
  if (!id) return
  try {
    await write({
      [`users:permissions/${id}/competitions/${competitionId}`]: on || null,
      [`competitions:permissions/${competitionId}/users/${id}`]: on || null,
    })
    toast(on ? `Can now manage ${competitionName(competitionId)}` : `No longer manages ${competitionName(competitionId)}`)
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  }
}

const picking = ref(false)
const pickQuery = ref('')
const pickChoices = computed(() => {
  const q = pickQuery.value.trim().toLowerCase()
  return competitions.value
    .filter((c) => !managed.value.includes(c.id) && (!q || (c.name ?? '').toLowerCase().includes(q)))
    .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')))
    .slice(0, 50)
})
function pick(id: string) {
  picking.value = false
  pickQuery.value = ''
  void setCompetition(id, true)
}
</script>

<template>
  <MasterDetail :show-detail="!!uid">
    <template #list>
      <div class="bg-background sticky top-(--chrome-top) z-10 space-y-3 border-b p-4 md:top-0">
        <h1 class="text-title">Users <span class="text-muted-foreground text-base font-semibold tabular-nums">{{ users.length || '' }}</span></h1>
        <label class="bg-card border-strong focus-within:border-primary flex h-11 items-center gap-2 rounded-xl border-2 px-3">
          <Search class="text-muted-foreground size-4 shrink-0" />
          <span class="sr-only">Search people</span>
          <input v-model="query" type="search" placeholder="Search by email or name" class="min-w-0 flex-1 bg-transparent text-base outline-none" />
          <button v-if="query" type="button" aria-label="Clear search" class="text-muted-foreground -mr-1 flex size-7 items-center justify-center rounded-full" @click="query = ''"><X class="size-4" /></button>
        </label>
      </div>
      <div v-if="!loaded" class="space-y-2 p-4"><Skeleton v-for="i in 6" :key="i" class="h-14 w-full rounded-xl!" /></div>
      <p v-else-if="loadError" class="text-destructive p-4 font-semibold">Users couldn’t be loaded. Check your connection and reload.</p>
      <ul v-else class="divide-y">
        <li v-for="u in shown" :key="u.id">
          <RouterLink
            :to="{ name: 'admin.users', params: { userId: u.id } }"
            :replace="split"
            :class="['flex min-h-14 items-center gap-3 px-4 py-2', uid === u.id ? 'bg-blue-paper' : 'hover:bg-accent']"
          >
            <span class="min-w-0 flex-1">
              <span class="block truncate text-base font-semibold">{{ u.displayName || u.email || 'No name' }}</span>
              <span v-if="u.displayName && u.email" class="text-muted-foreground block truncate text-sm">{{ u.email }}</span>
            </span>
            <ShieldCheck v-if="perms[u.id]?.admin" class="text-primary size-5 shrink-0" aria-label="System admin" />
            <span v-else-if="Object.keys(perms[u.id]?.competitions ?? {}).length" class="text-muted-foreground text-sm font-semibold tabular-nums">{{ Object.keys(perms[u.id]?.competitions ?? {}).length }}</span>
            <ChevronRight class="text-muted-foreground size-5 shrink-0 md:hidden" />
          </RouterLink>
        </li>
        <li v-if="users.length > shown.length && !query" class="text-muted-foreground p-4 text-sm">Showing the first 200. Search to find someone.</li>
      </ul>
    </template>
    <template #empty>
      <div class="hidden h-full items-center justify-center p-8 md:flex"><p class="text-muted-foreground text-base">Choose someone to see their access.</p></div>
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
          <div class="bg-card rounded-2xl border px-4 py-2">
            <SwitchField :model-value="!!currentPerms.admin" label="System admin" description="Can manage every competition and use these admin pages." :save="setAdmin" />
          </div>
          <div class="space-y-2">
            <p class="text-base font-bold">Competitions they manage</p>
            <ul v-if="managed.length" class="bg-card divide-y rounded-2xl border shadow-sm">
              <li v-for="cid in managed" :key="cid" class="flex min-h-13 items-center gap-2 px-4 py-2">
                <RouterLink :to="{ name: 'manage', params: { competitionId: cid } }" class="text-primary min-w-0 flex-1 truncate font-semibold">{{ competitionName(cid) }}</RouterLink>
                <button type="button" class="text-destructive hover:bg-destructive/10 h-10 rounded-xl px-3 text-sm font-bold" @click="setCompetition(cid, false)">Remove</button>
              </li>
            </ul>
            <p v-else class="text-muted-foreground text-sm">None.</p>
            <button type="button" class="bg-card border-strong hover:bg-accent flex h-11 items-center gap-1.5 rounded-xl border px-4 text-[0.9375rem] font-bold" @click="picking = true">
              <Plus class="size-4" /> Add a competition
            </button>
          </div>
        </section>
      </div>
      <EmptyState v-else-if="loaded" :icon="UserCog" title="This account isn’t here" />
    </template>
  </MasterDetail>

  <Dialog :open="picking" variant="sheet" size="md" @close="picking = false">
    <template #header>
      <h2 class="text-title">Let them manage…</h2>
    </template>
    <div class="p-4">
      <label class="bg-card border-strong focus-within:border-primary flex h-11 items-center gap-2 rounded-xl border-2 px-3">
        <Search class="text-muted-foreground size-4 shrink-0" />
        <span class="sr-only">Find a competition</span>
        <input v-model="pickQuery" type="search" placeholder="Find a competition" class="min-w-0 flex-1 bg-transparent text-base outline-none" />
        <button v-if="pickQuery" type="button" aria-label="Clear search" class="text-muted-foreground -mr-1 flex size-7 items-center justify-center rounded-full" @click="pickQuery = ''"><X class="size-4" /></button>
      </label>
    </div>
    <ul class="divide-y pb-[var(--safe-bottom)]">
      <li v-for="c in pickChoices" :key="c.id">
        <button type="button" class="hover:bg-accent flex min-h-14 w-full flex-col justify-center px-4 py-2 text-left" @click="pick(c.id)">
          <span class="text-base font-semibold">{{ c.name || 'Untitled' }}</span>
          <span class="text-muted-foreground text-sm">{{ c.date ? formatLongDate(c.date) : '' }}</span>
        </button>
      </li>
    </ul>
  </Dialog>
</template>
