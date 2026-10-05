<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { getCurrentUser } from 'vuefire'
import { get } from 'firebase/database'
import { ExternalLink, Eye, FileUp, Landmark, Lock, LogIn, Plus, Trash2 } from '@lucide/vue'
import AppBar from '@/components/nav/AppBar.vue'
import Button from '@/components/ui/Button.vue'
import DateTile from '@/components/DateTile.vue'
import Dialog from '@/components/Dialog.vue'
import EmptyState from '@/components/EmptyState.vue'
import Skeleton from '@/components/Skeleton.vue'
import VisibilityChip from '@/components/VisibilityChip.vue'
import AdminsPanel from '@/components/admin/AdminsPanel.vue'
import ImageField from '@/components/admin/ImageField.vue'
import MovingList from '@/components/admin/MovingList.vue'
import SearchField from '@/components/admin/SearchField.vue'
import SectionHeader from '@/components/admin/SectionHeader.vue'
import TextField from '@/components/admin/TextField.vue'
import { useManagedOrganisation } from '@/composables/admin/useManagedOrganisation'
import { provideSectionTitle } from '@/composables/admin/useSectionTitle'
import { useCompetitions } from '@/composables/useCompetitions'
import { useHiddenAs } from '@/composables/useHiddenAs'
import { usePageTitle } from '@/composables/usePageTitle'
import { dataRef } from '@/firebase'
import { LINK_PROBLEM, looksLikeLink } from '@/lib/admin/collection'
import { confirm, toast } from '@/lib/admin/feedback'
import { grow, shrink } from '@/lib/admin/motion'
import { uploadLinkFile } from '@/lib/admin/upload'
import { canEdit, friendlyError, write } from '@/lib/admin/write'
import { compareKeys } from '@/lib/competitionData'
import { competitionPhase } from '@/lib/dancerDay'
import { formatExternalURL } from '@/lib/format'
import { useMorph } from '@/lib/morph'
import { useAuthStore } from '@/stores/auth'
import { useMeStore } from '@/stores/me'

// One organisation, for its admins: its page (logo, names, where it's based,
// website, description, links), the competitions it's run by or part of,
// and who else can change it. Everything saves as you go, as in Manage.

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const me = useMeStore()
const id = computed(() => String(route.params.organisationId ?? ''))
const m = useManagedOrganisation(id)
const org = computed(() => m.organisation.value ?? {})
usePageTitle(() => ['Manage', m.organisation.value?.name])
const sectionTitle = provideSectionTitle()

const authReady = ref(false)
void getCurrentUser().then(() => (authReady.value = true))
type Access = 'checking' | 'signed-out' | 'denied' | 'missing' | 'ok'
const access = computed<Access>(() => {
  if (!authReady.value) return 'checking'
  if (!auth.isSignedIn) return 'signed-out'
  if (!me.permissionsLoaded) return 'checking'
  if (!me.hasOrganisationPerm(id.value)) return 'denied'
  if (!m.loaded.value) return 'checking'
  if (!m.organisation.value) return 'missing'
  return 'ok'
})
const exit = computed(() => ({ to: { name: 'organisation.info', params: { organisationId: id.value } }, label: m.organisation.value?.shortName || m.organisation.value?.name || 'Organisation' }))

const save = (key: string) => (v: string | null) => m.writeInfo({ [key]: v })

// --- Links and files, as a competition has them
interface LinkRow { id: string; name?: string; url?: string; _order?: number }
const links = computed<LinkRow[]>(() =>
  Object.entries(org.value.links ?? {})
    .filter(([, v]) => v && typeof v === 'object')
    .map(([lid, v]) => ({ ...v, id: lid }))
    .sort((a, b) => (a._order ?? Infinity) - (b._order ?? Infinity) || compareKeys(a.id, b.id)),
)
const addingLink = ref(false)
const newLinkName = ref('')
const newLinkUrl = ref('')
const linkError = ref<string | null>(null)
const uploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const linkFormEl = ref<HTMLFormElement | null>(null)
async function openLinkForm() {
  addingLink.value = true
  await nextTick()
  linkFormEl.value?.querySelector('input')?.focus()
}
async function addLink(url?: string, name?: string) {
  const u = (url ?? newLinkUrl.value).trim()
  if (!u) return
  const order = links.value.reduce((max, l) => Math.max(max, l._order ?? -1), -1) + 1
  try {
    await m.writeInfo({ [`links/${m.newKey()}`]: { name: (name ?? newLinkName.value).trim() || null, url: u, _order: order } })
    newLinkName.value = ''
    newLinkUrl.value = ''
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  }
}
async function submitLink() {
  const u = newLinkUrl.value.trim()
  if (!u) return
  linkError.value = looksLikeLink(u) ? null : LINK_PROBLEM
  if (!linkError.value) await addLink()
}
async function onFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (!file) return
  uploading.value = true
  try {
    const url = await uploadLinkFile(file, id.value, 'organisations')
    await addLink(url, newLinkName.value.trim() || file.name.replace(/\.[^.]+$/, ''))
  } catch (err) {
    toast(err instanceof Error && !/permission/i.test(err.message) ? err.message : friendlyError(err), { tone: 'error' })
  } finally {
    uploading.value = false
  }
}
async function removeLink(link: LinkRow) {
  try {
    await m.writeInfo({ [`links/${link.id}`]: null })
    toast(`Removed ${link.name || 'the link'}`, { action: { label: 'Undo', run: () => m.writeInfo({ [`links/${link.id}`]: { name: link.name ?? null, url: link.url ?? null, _order: link._order ?? null } }) } })
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  }
}

// --- Its competitions
// Read once like every list, so read again after each change here.
const { competitions, reload } = useCompetitions(ref(true))
async function setCompetition(cid: string, on: boolean) {
  await m.setCompetition(cid, on)
  await reload()
}
const hiddenAs = useHiddenAs()
const theirs = computed(() =>
  competitions.value
    .filter((c) => c.organisations?.[id.value] === true)
    .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? ''))),
)
const upcoming = computed(() => theirs.value.filter((c) => competitionPhase(c.date) !== 'after').reverse())
const past = computed(() => theirs.value.filter((c) => competitionPhase(c.date) === 'after'))
async function removeCompetition(cid: string, name?: string) {
  try {
    await setCompetition(cid, false)
    toast(`Took ${name || 'it'} off`, { action: { label: 'Undo', run: () => setCompetition(cid, true) } })
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  }
}

// Adding one: those you manage first, then any other (a series takes in
// competitions it doesn't run; their own admins can take it off again).
const picking = useMorph()
const pickQuery = ref('')
const pickChoices = computed(() => {
  const q = pickQuery.value.trim().toLowerCase()
  const open = competitions.value.filter((c) => c.organisations?.[id.value] !== true && (!q || [c.name, c.location, c.venue].join(' ').toLowerCase().includes(q)))
  const mine = open.filter((c) => me.organises(c.id))
  const rest = q ? open.filter((c) => !me.organises(c.id)).sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? ''))) : []
  return [...mine.sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? ''))), ...rest].slice(0, 40)
})
async function addCompetition(cid: string, name?: string) {
  void picking.hide()
  pickQuery.value = ''
  try {
    await setCompetition(cid, true)
    toast(`Added ${name || 'the competition'}`, { action: { label: 'Undo', run: () => setCompetition(cid, false) } })
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  }
}

// --- Admins
const known = reactive<Record<string, string>>({})
watch(
  [() => m.holders.value, () => me.isAdmin],
  async ([uids, isAdmin]) => {
    if (!isAdmin) return
    for (const uid of uids.filter((u) => !(u in known))) {
      known[uid] = (await get(dataRef(`users/${uid}/email`)).catch(() => null))?.val() ?? ''
    }
  },
  { immediate: true },
)
const holders = computed(() =>
  m.holders.value.map((uid) => ({
    uid,
    email: uid === auth.uid ? me.email : known[uid] || null,
    detail: uid === org.value.createdBy ? 'Started it' : 'Admin',
  })),
)
const panel = ref<{ count: number } | null>(null)

// --- Deleting it: system admins only (a duplicate, say)
async function deleteOrganisation() {
  const name = org.value.name || 'this organisation'
  const ok = await confirm({
    title: `Delete ${name}?`,
    message: 'Its page goes, and it comes off every competition. The competitions themselves stay. This can’t be undone.',
    confirmLabel: 'Delete organisation',
    destructive: true,
  })
  if (!ok) return
  try {
    await write({ [`organisations/${id.value}`]: null })
    toast(`Deleted ${name}`)
    await router.replace({ name: 'manage.competitions' })
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  }
}
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <AppBar title="Manage" :subtitle="org.name" :show-title="sectionTitle.showInBar()" :exit="exit">
      <template v-if="access === 'ok'" #actions>
        <RouterLink :to="exit.to" class="press flex size-9 items-center justify-center rounded-full" aria-label="View" title="View its page as everyone sees it">
          <Eye class="size-5" />
        </RouterLink>
      </template>
    </AppBar>

    <main class="mx-auto w-full max-w-2xl flex-1 px-4 pt-[calc(var(--chrome-top)+1rem)] pb-[calc(var(--chrome-bottom)+3rem)]">
      <div v-if="access === 'checking'" class="space-y-4" aria-busy="true">
        <span class="sr-only">Loading…</span>
        <Skeleton class="h-8 w-1/2" />
        <Skeleton class="h-40 w-full rounded-2xl!" />
      </div>
      <template v-else-if="access === 'signed-out'">
        <EmptyState :icon="LogIn" title="Sign in to manage this organisation" description="Its admins can change its page and competitions after signing in." />
        <div class="flex justify-center"><Button variant="primary" size="lg" @click="auth.openLogin()">Sign in</Button></div>
      </template>
      <template v-else-if="access === 'denied'">
        <EmptyState :icon="Lock" title="You can’t manage this organisation" description="Ask one of its admins to invite you." />
        <div class="flex justify-center"><Button size="lg" :to="exit.to">Back to its page</Button></div>
      </template>
      <EmptyState v-else-if="access === 'missing'" :icon="Landmark" title="Organisation not found" description="It may have been deleted, or the link is wrong." />

      <div v-else class="space-y-10">
        <SectionHeader :title="org.name || 'Organisation'" kicker="Organisation" />

        <section class="space-y-4">
          <h2 class="text-heading">Its page</h2>
          <ImageField :model-value="org.image" label="Logo" folder="info" owner="organisations" :competition-id="id" shape="square" :save="save('image')" />
          <TextField :model-value="org.name" label="Name" required placeholder="e.g. Foothills Highland Dancing Association" :save="save('name')" />
          <div class="grid gap-4 sm:grid-cols-2">
            <TextField :model-value="org.shortName" label="Short name" placeholder="e.g. FHDA" hint="What people call it. Shown where space is short." :save="save('shortName')" />
            <TextField :model-value="org.location" label="Based in" placeholder="e.g. Calgary, AB" :save="save('location')" />
          </div>
          <TextField :model-value="org.website" label="Website" type="url" placeholder="e.g. example.com" :save="save('website')" />
          <TextField :model-value="org.description" label="Description" multiline hint="Who they are and what they do. Shown on its page." :save="save('description')" />
        </section>

        <Transition :css="false" @enter="grow" @leave="shrink">
          <section v-if="links.length || addingLink" class="space-y-4">
            <div>
              <h2 class="text-heading">Links and files</h2>
              <p class="text-muted-foreground text-sm">Rules, forms, newsletters. Each shows as a button on its page.</p>
            </div>
            <MovingList v-if="links.length" class="surface divide-y rounded-2xl">
              <li v-for="link in links" :key="link.id" class="space-y-3 p-4">
                <div class="grid gap-3 sm:grid-cols-2">
                  <TextField :model-value="link.name" label="Label" placeholder="e.g. Rules" :save="(v) => m.writeInfo({ [`links/${link.id}/name`]: v })" />
                  <TextField :model-value="link.url" label="Link" type="url" required :save="(v) => m.writeInfo({ [`links/${link.id}/url`]: v })" />
                </div>
                <div class="flex items-center justify-between gap-2">
                  <Button v-if="link.url" variant="plain" class="-ml-4" :href="formatExternalURL(link.url)" target="_blank" rel="noopener">Open <ExternalLink /></Button>
                  <Button variant="plain" class="text-destructive! -mr-4 ml-auto" :disabled="!canEdit" @click="removeLink(link)"><Trash2 /> Remove</Button>
                </div>
              </li>
            </MovingList>
            <form v-if="addingLink" ref="linkFormEl" class="surface space-y-3 rounded-2xl p-4" novalidate @submit.prevent="submitLink">
              <div class="grid gap-3 sm:grid-cols-2">
                <label class="space-y-1.5">
                  <span class="text-callout block font-medium">Label</span>
                  <input v-model="newLinkName" :disabled="!canEdit" type="text" placeholder="e.g. Rules" class="field h-12 w-full rounded-xl px-3 text-base" />
                </label>
                <label class="space-y-1.5">
                  <span class="text-callout block font-medium">Link</span>
                  <input v-model="newLinkUrl" :disabled="!canEdit" type="url" placeholder="https://" :aria-invalid="!!linkError || undefined" class="field h-12 w-full rounded-xl px-3 text-base" @input="linkError = null" />
                  <span v-if="linkError" class="text-destructive block text-sm font-medium" role="alert">{{ linkError }}</span>
                </label>
              </div>
              <div class="flex flex-wrap gap-2">
                <Button type="submit" variant="tonal" :disabled="!canEdit || !newLinkUrl.trim()"><Plus /> Add link</Button>
                <Button :disabled="!canEdit" :busy="uploading" @click="fileInput?.click()">
                  <FileUp v-if="!uploading" /> {{ uploading ? 'Uploading…' : 'Upload a PDF or image' }}
                </Button>
                <input ref="fileInput" type="file" accept="application/pdf,image/*" class="sr-only" tabindex="-1" @change="onFile" />
              </div>
            </form>
          </section>
        </Transition>
        <Button v-if="!addingLink" class="-mt-4" :disabled="!canEdit" @click="openLinkForm"><Plus /> Add a link or file</Button>

        <section class="space-y-3">
          <div class="flex items-end justify-between gap-3">
            <div>
              <h2 class="text-heading">
                Competitions <span v-if="theirs.length" class="text-muted-foreground text-sm font-medium tabular-nums">{{ theirs.length }}</span>
              </h2>
              <p class="text-muted-foreground text-sm">The ones it runs or is part of. Each lists it on its page.</p>
            </div>
          </div>
          <template v-for="[title, list] in ([['Coming up', upcoming], ['Past', past]] as const)" :key="title">
            <div v-if="list.length" class="space-y-2">
              <h3 class="text-muted-foreground text-footnote font-semibold">{{ title }}</h3>
              <MovingList class="surface divide-y overflow-hidden rounded-2xl">
                <li v-for="c in list" :key="c.id" class="flex items-center gap-1 pr-2">
                  <RouterLink :to="{ name: 'competition.info', params: { competitionId: c.id } }" class="press-row focus-inset flex min-h-16 min-w-0 flex-1 items-center gap-3 py-2 pl-4">
                    <DateTile :date="c.date" :managed="me.organises(c.id)" />
                    <span class="min-w-0 flex-1">
                      <span class="line-clamp-2 block text-base font-semibold">{{ c.name || 'Untitled competition' }}</span>
                      <span v-if="c.venue || c.location" class="text-muted-foreground block truncate text-sm">{{ c.venue || c.location }}</span>
                      <span v-if="hiddenAs(c.id, c)" class="mt-0.5 flex"><VisibilityChip :visibility="hiddenAs(c.id, c)" /></span>
                    </span>
                  </RouterLink>
                  <Button variant="plain" class="text-destructive!" :disabled="!canEdit" @click="removeCompetition(c.id, c.name)">Take off</Button>
                </li>
              </MovingList>
            </div>
          </template>
          <EmptyState v-if="!theirs.length" size="inline" :icon="Landmark" title="No competitions yet" description="Add the ones it runs or is part of." />
          <Button variant="tonal" :disabled="!canEdit" @click="picking.show($event)"><Plus /> Add a competition</Button>
        </section>

        <section class="space-y-3">
          <div>
            <h2 class="text-heading">
              Admins <span v-if="panel?.count" class="text-muted-foreground text-sm font-medium tabular-nums">{{ panel.count }}</span>
            </h2>
            <p class="text-muted-foreground text-sm">People who can change its page and add its competitions. They don’t get to manage those competitions unless their own admins invite them.</p>
          </div>
          <AdminsPanel
            ref="panel"
            :invites="m.invites.value"
            :holders="holders"
            :write-invites="m.writeData"
            :new-key="m.newKey"
            :link-for="(inviteId) => `/organisations/${id}/invites/${inviteId}`"
            what="this organisation"
          >
            <template #note>
              <p v-if="me.isAdmin" class="text-muted-foreground text-sm">System admins can always change every organisation.</p>
            </template>
          </AdminsPanel>
        </section>

        <section v-if="me.isAdmin" class="space-y-3 border-t pt-8">
          <h2 class="text-heading">Delete this organisation</h2>
          <p class="text-muted-foreground text-sm">Removes its page and takes it off every competition. The competitions stay.</p>
          <Button class="text-destructive!" :disabled="!canEdit" @click="deleteOrganisation"><Trash2 /> Delete organisation</Button>
        </section>
      </div>
    </main>

    <Dialog :open="picking.open" :morph="picking" variant="sheet" size="md" @close="picking.hide()">
      <template #header>
        <h2 class="text-title">Add a competition</h2>
        <p class="text-muted-foreground text-sm">Yours first. Type to find any other.</p>
      </template>
      <div class="p-4 pt-1">
        <SearchField v-model="pickQuery" label="Find a competition" />
      </div>
      <ul class="divide-y pb-[var(--safe-bottom)]">
        <li v-for="c in pickChoices" :key="c.id">
          <button type="button" class="press-row focus-inset flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left" @click="addCompetition(c.id, c.name)">
            <DateTile :date="c.date" below="year" :managed="me.organises(c.id)" />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-base font-semibold">{{ c.name || 'Untitled' }}</span>
              <span v-if="c.venue || c.location" class="text-muted-foreground block truncate text-sm">{{ c.venue || c.location }}</span>
            </span>
            <Plus class="text-primary size-5 shrink-0" aria-hidden="true" />
          </button>
        </li>
        <li v-if="!pickChoices.length" class="text-muted-foreground px-4 py-3 text-sm">
          {{ pickQuery.trim() ? `Nothing matches “${pickQuery.trim()}”.` : 'Type a name to find a competition.' }}
        </li>
      </ul>
    </Dialog>
  </div>
</template>
