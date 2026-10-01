<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { getCurrentUser } from 'vuefire'
import { ChevronRight, LogIn, Plus, Search, ShieldCheck, X } from '@lucide/vue'
import AppBar from '@/components/nav/AppBar.vue'
import Dialog from '@/components/Dialog.vue'
import EmptyState from '@/components/EmptyState.vue'
import Skeleton from '@/components/Skeleton.vue'
import DateTile from '@/components/DateTile.vue'
import FormInput from '@/components/admin/FormInput.vue'
import { useCompetitions, type CompetitionListItem } from '@/composables/useCompetitions'
import { usePageTitle } from '@/composables/usePageTitle'
import { toast } from '@/lib/admin/feedback'
import { canEdit, friendlyError, newKey, write } from '@/lib/admin/write'
import { competitionPhase } from '@/lib/dancerDay'
import { formatLongDate } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import { useMeStore } from '@/stores/me'

// Every competition you can manage. System admins see all of them and can
// create one directly; organisers submit theirs for approval.

usePageTitle(['Manage competitions'])
const auth = useAuthStore()
const me = useMeStore()
const router = useRouter()

const authReady = ref(false)
onMounted(async () => {
  await getCurrentUser()
  authReady.value = true
})

// Read afresh each visit: a competition just created, approved or deleted
// must show (or not) here straight away.
const { competitions, loading, reload } = useCompetitions(ref(true))
void reload()

const mine = computed<CompetitionListItem[]>(() =>
  competitions.value.filter((c) => me.hasCompetitionPerm(c.id)).sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? ''))),
)
const query = ref('')
const shown = computed(() => {
  const q = query.value.trim().toLowerCase()
  return q ? mine.value.filter((c) => [c.name, c.location, c.venue].join(' ').toLowerCase().includes(q)) : mine.value
})
const upcoming = computed(() => shown.value.filter((c) => competitionPhase(c.date) !== 'after').reverse())
const past = computed(() => shown.value.filter((c) => competitionPhase(c.date) === 'after'))

const visibility = (c: CompetitionListItem) => (c.published ? 'Published' : c.listed ? 'Listed' : 'Private')

// --- Create (system admins)
const creating = ref(false)
const newName = ref('')
const newDate = ref('')
const createError = ref<string | null>(null)
async function create() {
  createError.value = null
  if (!newName.value.trim() || !newDate.value) {
    createError.value = 'Add a name and a date.'
    return
  }
  const id = newKey()
  try {
    await write({ [`competitions/${id}`]: { name: newName.value.trim(), date: newDate.value, listed: false, published: false } })
    creating.value = false
    newName.value = ''
    newDate.value = ''
    toast('Competition created. It’s private until you list or publish it.')
    await router.push({ name: 'manage.details', params: { competitionId: id } })
  } catch (e) {
    createError.value = friendlyError(e)
  }
}
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <AppBar title="Manage competitions" show-title :fallback="{ to: { name: 'settings' }, label: 'Settings' }" />
    <main class="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 pt-[calc(var(--chrome-top)+1rem)] pb-[calc(var(--chrome-bottom)+1.5rem)]">
      <h1 class="text-display">Manage competitions</h1>

      <div v-if="!authReady || (auth.isSignedIn && !me.permissionsLoaded)" class="space-y-3">
        <Skeleton v-for="i in 3" :key="i" class="h-16 w-full rounded-2xl!" />
      </div>

      <template v-else-if="!auth.isSignedIn">
        <EmptyState :icon="LogIn" title="Sign in to manage your competitions" description="Organisers and their admins sign in to change competitions." />
        <div class="flex justify-center">
          <button type="button" class="bg-primary text-primary-foreground h-12 rounded-xl px-6 text-base font-bold" @click="auth.openLogin()">Sign in</button>
        </div>
      </template>

      <template v-else>
        <div class="flex flex-wrap gap-2">
          <button
            v-if="me.isAdmin"
            type="button"
            :disabled="!canEdit"
            class="bg-primary text-primary-foreground flex h-11 items-center gap-1.5 rounded-xl px-4 text-[0.9375rem] font-bold disabled:opacity-50"
            @click="creating = true"
          >
            <Plus class="size-4" /> New competition
          </button>
          <RouterLink v-else :to="{ name: 'competitions.submit' }" class="bg-primary text-primary-foreground flex h-11 items-center gap-1.5 rounded-xl px-4 text-[0.9375rem] font-bold">
            <Plus class="size-4" /> Submit a competition
          </RouterLink>
        </div>

        <label v-if="mine.length > 6" class="bg-card border-strong focus-within:border-primary flex h-11 items-center gap-2 rounded-xl border-2 px-3">
          <Search class="text-muted-foreground size-4 shrink-0" />
          <span class="sr-only">Search competitions</span>
          <input v-model="query" type="search" placeholder="Search competitions" class="min-w-0 flex-1 bg-transparent text-base outline-none" />
          <button v-if="query" type="button" aria-label="Clear search" class="text-muted-foreground flex size-7 items-center justify-center rounded-full" @click="query = ''"><X class="size-4" /></button>
        </label>

        <div v-if="loading && !mine.length" class="space-y-3">
          <Skeleton v-for="i in 3" :key="i" class="h-16 w-full rounded-2xl!" />
        </div>
        <EmptyState
          v-else-if="!mine.length"
          :icon="ShieldCheck"
          title="No competitions to manage yet"
          description="Submit your competition, or ask its organiser to invite you as an admin."
        />

        <section v-for="[title, list] in ([['Coming up', upcoming], ['Past', past]] as const)" v-show="list.length" :key="title" class="space-y-2">
          <h2 class="text-heading">{{ title }}</h2>
          <ul class="bg-card divide-y overflow-hidden rounded-2xl border shadow-sm">
            <li v-for="c in list" :key="c.id">
              <RouterLink :to="{ name: 'manage', params: { competitionId: c.id } }" class="hover:bg-accent flex min-h-16 items-center gap-3 px-4 py-2">
                <DateTile :date="c.date" class="h-12 shrink-0" />
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-base font-bold">{{ c.name || 'Untitled competition' }}</span>
                  <span class="text-muted-foreground block truncate text-sm">{{ [c.date ? formatLongDate(c.date) : null, visibility(c)].filter(Boolean).join(' · ') }}</span>
                </span>
                <ChevronRight class="text-muted-foreground size-5 shrink-0" />
              </RouterLink>
            </li>
          </ul>
        </section>
      </template>
    </main>

    <Dialog :open="creating" variant="sheet" @close="creating = false">
      <template #header>
        <h2 class="text-title">New competition</h2>
        <p class="text-muted-foreground text-sm">It stays private until you list or publish it.</p>
      </template>
      <form class="space-y-4 p-4 pb-[calc(1rem+var(--safe-bottom))]" novalidate @submit.prevent="create">
        <FormInput v-model="newName" label="Name" required placeholder="e.g. Canadian Championship 2027" />
        <FormInput v-model="newDate" label="Date" kind="date" required />
        <p v-if="createError" class="text-destructive text-sm font-semibold" role="alert">{{ createError }}</p>
        <button type="submit" :disabled="!canEdit" class="bg-primary text-primary-foreground h-12 w-full rounded-xl text-base font-bold disabled:opacity-50">Create</button>
      </form>
    </Dialog>
  </div>
</template>
