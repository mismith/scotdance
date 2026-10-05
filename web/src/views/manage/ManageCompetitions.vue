<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { getCurrentUser } from 'vuefire'
import { ChevronRight, Landmark, LogIn, Plus, ShieldCheck } from '@lucide/vue'
import AppBar from '@/components/nav/AppBar.vue'
import Button from '@/components/ui/Button.vue'
import Dialog from '@/components/Dialog.vue'
import EmptyState from '@/components/EmptyState.vue'
import Skeleton from '@/components/Skeleton.vue'
import CompetitionName from '@/components/CompetitionName.vue'
import DateTile from '@/components/DateTile.vue'
import VisibilityChip from '@/components/VisibilityChip.vue'
import FormInput from '@/components/admin/FormInput.vue'
import OrganisationMark from '@/components/OrganisationMark.vue'
import OrganisationPicker from '@/components/OrganisationPicker.vue'
import { useOrganisationCompetitions, useOrganisations } from '@/composables/useOrganisations'
import { createOrganisation } from '@/lib/admin/organisations'
import SearchField from '@/components/admin/SearchField.vue'
import { useCompetitions, type CompetitionListItem } from '@/composables/useCompetitions'
import { useCompetitionSpans } from '@/composables/useCompetitionSpans'
import { useHiddenAs } from '@/composables/useHiddenAs'
import { usePageTitle } from '@/composables/usePageTitle'
import { useScrolledPast } from '@/composables/useScrolledPast'
import { toast } from '@/lib/admin/feedback'
import { canEdit, friendlyError, newKey, write } from '@/lib/admin/write'
import { competitionPhase } from '@/lib/dancerDay'
import { useMorph } from '@/lib/morph'
import { useAuthStore } from '@/stores/auth'
import { useMeStore } from '@/stores/me'

// Every competition you can manage. System admins see all of them and can
// create one directly; organisers submit theirs for approval.

usePageTitle(['Manage'])
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
// Through the schedule's last day, so day 2 of a two-day competition is
// still on (and still a tap from results entry).
const { phase } = useCompetitionSpans(mine)
const upcoming = computed(() => shown.value.filter((c) => phase(c) !== 'after').reverse())
const past = computed(() => shown.value.filter((c) => phase(c) === 'after'))

// The date is on its tile, where it is under the name, and how it's hidden
// (until it's published) on a chip, as in every other list.
const hiddenAs = useHiddenAs()
// System admins see every competition here: the shield picks out their own.
const shielded = (c: CompetitionListItem) => me.isAdmin && me.organises(c.id)
// On the day, results entry is a tap away.
const isToday = (c: CompetitionListItem) => phase(c) === 'today'

// The page's own title hands over to the bar once it scrolls away.
const titleEl = ref<HTMLElement | null>(null)
const scrolledPast = useScrolledPast(titleEl)

// --- Your organisations: their pages, and starting one
const orgs = useOrganisations()
const { byOrganisation } = useOrganisationCompetitions()
const myOrgs = computed(() => me.managedOrganisationIds.flatMap((id) => orgs.byId.value.get(id) ?? []))
const comingUp = (id: string) => (byOrganisation.value.get(id) ?? []).filter((c) => competitionPhase(c.date) !== 'after').length
const startingOrg = useMorph()
async function startOrg({ name, shortName }: { name: string; shortName: string }) {
  try {
    const id = await createOrganisation({ name, shortName })
    toast(`Started ${name}. Add its logo and competitions.`)
    await router.push({ name: 'organisation.manage', params: { organisationId: id } })
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  }
}

// --- Create (system admins)
const creating = useMorph()
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
    creating.dismiss()
    newName.value = ''
    newDate.value = ''
    toast('Competition created. Only admins see it until you list or publish it.')
    await router.push({ name: 'manage.details', params: { competitionId: id } })
  } catch (e) {
    createError.value = friendlyError(e)
  }
}
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <AppBar title="Manage" :show-title="scrolledPast" :fallback="{ to: { name: 'settings' }, label: 'Settings' }" />
    <main class="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 pt-[calc(var(--chrome-top)+1rem)] pb-[calc(var(--chrome-bottom)+1.5rem)]">
      <h1 ref="titleEl" class="text-display">Manage</h1>

      <div v-if="!authReady || (auth.isSignedIn && !me.permissionsLoaded)" class="space-y-3">
        <Skeleton v-for="i in 3" :key="i" class="h-16 w-full rounded-2xl!" />
      </div>

      <template v-else-if="!auth.isSignedIn">
        <EmptyState :icon="LogIn" title="Sign in to manage your competitions" description="Organisers and their admins sign in to change competitions." />
        <div class="flex justify-center">
          <Button variant="primary" size="lg" @click="auth.openLogin()">Sign in</Button>
        </div>
      </template>

      <template v-else>
        <div class="flex flex-wrap gap-2">
          <Button v-if="me.isAdmin" variant="tonal" :disabled="!canEdit" @click="creating.show($event)">
            <Plus /> New competition
          </Button>
          <Button v-else variant="tonal" :to="{ name: 'competitions.submit' }">
            <Plus /> Submit a competition
          </Button>
          <Button v-if="!me.isAdmin && mine.length && !myOrgs.length" :disabled="!canEdit" @click="startingOrg.show($event)">
            <Landmark /> Start an organisation
          </Button>
        </div>

        <SearchField v-if="mine.length > 6" v-model="query" label="Search competitions" />

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
          <ul class="surface divide-y overflow-hidden rounded-2xl">
            <li v-for="c in list" :key="c.id" class="sm:flex sm:items-center">
              <RouterLink :to="{ name: 'manage', params: { competitionId: c.id } }" class="press-row focus-inset flex min-h-16 min-w-0 flex-1 items-center gap-3 py-2 pr-3 pl-4">
                <DateTile :date="c.date" :today="isToday(c)" :managed="shielded(c)" />
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-base font-semibold"><CompetitionName :competition="c" fallback="Untitled competition" /></span>
                  <span v-if="c.venue || c.location" class="text-muted-foreground block truncate text-sm">{{ c.venue || c.location }}</span>
                  <span v-if="hiddenAs(c.id, c)" class="mt-0.5 flex"><VisibilityChip :visibility="hiddenAs(c.id, c)" /></span>
                </span>
                <ChevronRight :class="['text-muted-foreground size-5 shrink-0', isToday(c) && 'sm:hidden']" />
              </RouterLink>
              <!-- Under the name on a phone, beside it where there's room. -->
              <div v-if="isToday(c)" class="px-4 pb-3 sm:p-0 sm:pr-3">
                <Button variant="tonal" class="max-sm:w-full" :to="{ name: 'manage.results', params: { competitionId: c.id } }">
                  Enter results
                </Button>
              </div>
            </li>
          </ul>
        </section>

        <!-- Your organisations, last. -->
        <section v-if="myOrgs.length" class="space-y-2">
          <h2 class="text-heading">Your organisations</h2>
          <ul class="surface divide-y overflow-hidden rounded-2xl">
            <li v-for="org in myOrgs" :key="org.id">
              <RouterLink :to="{ name: 'organisation.manage', params: { organisationId: org.id } }" class="press-row focus-inset flex min-h-16 items-center gap-3 py-2 pr-3 pl-4">
                <OrganisationMark :organisation="org" />
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-base font-semibold">{{ org.name }}</span>
                  <span class="text-muted-foreground block truncate text-sm">{{ comingUp(org.id) ? `${comingUp(org.id)} coming up` : 'Nothing coming up' }}</span>
                </span>
                <ChevronRight class="text-muted-foreground size-5 shrink-0" />
              </RouterLink>
            </li>
          </ul>
        </section>
      </template>
    </main>

    <OrganisationPicker :morph="startingOrg" title="Start an organisation" :mine="[]" any @pick="(org) => router.push({ name: 'organisation.info', params: { organisationId: org.id } })" @create="startOrg" />

    <Dialog :open="creating.open" :morph="creating" variant="sheet" @close="creating.hide()">
      <template #header>
        <h2 class="text-title">New competition</h2>
        <p class="text-muted-foreground text-sm">Only admins see it until you list or publish it.</p>
      </template>
      <form class="space-y-4 p-4 pb-[calc(1rem+var(--safe-bottom))]" novalidate @submit.prevent="create">
        <FormInput v-model="newName" label="Name" required placeholder="e.g. Canadian Championship 2027" />
        <FormInput v-model="newDate" label="Date" kind="date" required />
        <p v-if="createError" class="text-destructive text-sm font-medium" role="alert">{{ createError }}</p>
        <Button type="submit" variant="primary" size="lg" block :disabled="!canEdit">Create</Button>
      </form>
    </Dialog>
  </div>
</template>
