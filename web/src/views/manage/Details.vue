<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ExternalLink, FileUp, Plus, Trash2 } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import MovingList from '@/components/admin/MovingList.vue'
import SectionHeader from '@/components/admin/SectionHeader.vue'
import TextField from '@/components/admin/TextField.vue'
import ImageField from '@/components/admin/ImageField.vue'
import SwitchField from '@/components/admin/SwitchField.vue'
import VenueField from '@/components/admin/VenueField.vue'
import DetailsPreview from '@/components/admin/DetailsPreview.vue'
import MapPreview from '@/components/MapPreview.vue'
import { useManagedCompetition } from '@/composables/admin/useManagedCompetition'
import { compareKeys, forgetCompetition } from '@/lib/competitionData'
import { forgetCompetitionMeta } from '@/lib/competitionMeta'
import { forgetCompetitionsList } from '@/composables/useCompetitions'
import { confirm, toast } from '@/lib/admin/feedback'
import { canEdit, friendlyError, write } from '@/lib/admin/write'
import { LINK_PROBLEM, looksLikeLink } from '@/lib/admin/collection'
import { uploadLinkFile } from '@/lib/admin/upload'
import { grow, shrink } from '@/lib/admin/motion'
import { formatExternalURL, parseDate } from '@/lib/format'
import { placesAvailable, type VenueFields } from '@/lib/maps'

const m = useManagedCompetition()
const router = useRouter()
const c = computed(() => m.competition.value ?? {})

const pad = (n: number) => String(n).padStart(2, '0')
function dateInput(value: unknown) {
  if (value == null || value === '') return ''
  const d = parseDate(value as string)
  return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function dateTimeInput(value: unknown) {
  if (value == null || value === '') return ''
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return value
  const d = parseDate(value as string)
  return Number.isNaN(d.getTime()) ? '' : `${dateInput(value)}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const FIELD_NAMES: Record<string, string> = {
  name: 'Name',
  date: 'Date',
  sobhd: 'Registration number',
  description: 'Description',
  image: 'Image',
  venue: 'Venue',
  address: 'Address',
  location: 'Town or city',
  registrationURL: 'Registration link',
  registrationStart: 'Registration opens',
  registrationEnd: 'Registration closes',
}
const save = (key: string) => (v: string | null) => m.writeInfo({ [key]: v }, FIELD_NAMES[key] ?? key)

async function pickVenue(fields: VenueFields) {
  const message = `Venue set to ${fields.venue ?? fields.address ?? fields.location ?? 'the place you picked'}`
  try {
    const change = await m.writeInfo({ ...fields }, message)
    toast(message, { action: { label: 'Undo', run: () => m.undoChange(change) } })
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  }
}

// --- Registration, and links and files: one "Add" button each until used,
// so a new competition's page isn't a wall of empty fields.
const showRegistration = ref(false)
const registrationShown = computed(
  () => showRegistration.value || !!(c.value.registrationURL || c.value.registrationStart || c.value.registrationEnd),
)
const registrationEl = ref<HTMLElement | null>(null)
async function openRegistration() {
  showRegistration.value = true
  await nextTick()
  registrationEl.value?.querySelector('input')?.focus()
}

// --- Links and files
interface LinkRow {
  id: string
  name?: string
  url?: string
  _order?: number
}
const links = computed<LinkRow[]>(() => {
  const raw = (c.value as { links?: Record<string, Omit<LinkRow, 'id'>> }).links
  if (!raw || typeof raw !== 'object') return []
  return Object.entries(raw)
    .filter(([, v]) => v && typeof v === 'object')
    .map(([id, v]) => ({ ...v, id }))
    .sort((a, b) => (a._order ?? Infinity) - (b._order ?? Infinity) || compareKeys(a.id, b.id))
})
const newName = ref('')
const newUrl = ref('')
const uploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const addingLink = ref(false)
const linkFormEl = ref<HTMLFormElement | null>(null)
async function openLinkForm() {
  addingLink.value = true
  await nextTick()
  linkFormEl.value?.querySelector('input')?.focus()
}

async function addLink(url?: string, name?: string) {
  const u = (url ?? newUrl.value).trim()
  if (!u) return
  const id = m.newKey()
  const order = links.value.reduce((max, l) => Math.max(max, l._order ?? -1), -1) + 1
  try {
    await m.writeInfo({ [`links/${id}`]: { name: (name ?? newName.value).trim() || null, url: u, _order: order } }, 'Added a link')
    newName.value = ''
    newUrl.value = ''
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  }
}
// The add form: one link per tap, and only something that looks like a link.
const linkError = ref<string | null>(null)
let submittingLink = false
async function submitLink() {
  const u = newUrl.value.trim()
  if (!u || submittingLink) return
  linkError.value = looksLikeLink(u) ? null : LINK_PROBLEM
  if (linkError.value) return
  submittingLink = true
  try {
    await addLink()
  } finally {
    submittingLink = false
  }
}
async function onFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (!file) return
  uploading.value = true
  try {
    const url = await uploadLinkFile(file, m.competitionId.value)
    await addLink(url, newName.value.trim() || file.name.replace(/\.[^.]+$/, ''))
  } catch (err) {
    toast(err instanceof Error && !/permission/i.test(err.message) ? err.message : friendlyError(err), { tone: 'error' })
  } finally {
    uploading.value = false
  }
}
async function removeLink(link: LinkRow) {
  const message = `Removed ${link.name || 'the link'}`
  try {
    const change = await m.writeInfo({ [`links/${link.id}`]: null }, message)
    toast(message, { action: { label: 'Undo', run: () => m.undoChange(change) } })
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  }
}

// --- Delete the competition
async function deleteCompetition() {
  const name = c.value.name || 'this competition'
  const ok = await confirm({
    title: `Delete ${name}?`,
    message: 'Its dancers, schedule and results are deleted too, for everyone. This can’t be undone.',
    confirmLabel: 'Delete competition',
    destructive: true,
  })
  if (!ok) return
  const id = m.competitionId.value
  try {
    await write({ [`competitions/${id}`]: null, [`competitions:data/${id}`]: null })
    // Lists read earlier in this visit mustn't keep showing it.
    forgetCompetition(id)
    forgetCompetitionMeta(id)
    forgetCompetitionsList()
    toast(`Deleted ${name}`)
    await router.replace({ name: 'manage.competitions' })
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  }
}

</script>

<template>
  <!-- Top left like the other Manage tabs; wide screens show the preview beside it. -->
  <div class="xl:grid xl:h-full xl:grid-cols-[minmax(0,42rem)_minmax(0,1fr)]">
    <div class="max-w-2xl min-w-0 space-y-10 p-4 pb-[calc(3rem+var(--safe-bottom))] xl:max-w-none xl:overflow-y-auto">
      <SectionHeader title="Details" />

      <section class="space-y-4">
        <h2 class="text-heading">Basics</h2>
        <TextField :model-value="c.name" label="Name" required placeholder="e.g. Canadian Championship 2026" :save="save('name')" />
        <div class="grid gap-4 sm:grid-cols-2">
          <TextField :model-value="dateInput(c.date)" label="Date" type="date" required hint="The first day, if it runs over several." :save="save('date')" />
          <TextField
            :model-value="c.sobhd"
            label="Registration number"
            placeholder="e.g. C-AB-CO-26-1234"
            hint="If it’s registered with an association, like the RSOBHD."
            :save="save('sobhd')"
          />
        </div>
        <TextField
          :model-value="c.description"
          label="Description"
          multiline
          hint="Anything else people should know. Shown on the competition page."
          :save="save('description')"
        />
        <ImageField
          :model-value="c.image"
          label="Logo or photo"
          folder="info"
          :competition-id="m.competitionId.value"
          :save="save('image')"
        />
      </section>

      <section class="space-y-4">
        <h2 class="text-heading">Where</h2>
        <VenueField v-if="placesAvailable" :model-value="c.venue" :save="save('venue')" @pick="pickVenue" />
        <TextField v-else :model-value="c.venue" label="Venue name" placeholder="e.g. Telus Convention Centre" :save="save('venue')" />
        <TextField :model-value="c.address" label="Address" placeholder="e.g. 120 9th Ave SE" :save="save('address')" />
        <TextField
          :model-value="c.location"
          label="Town or city"
          placeholder="e.g. Calgary, AB"
          hint="Used for “near you” and the map. Include the province or state."
          :save="save('location')"
        />
        <MapPreview
          v-if="Number.isFinite(c.lat) && Number.isFinite(c.lng)"
          :lat="c.lat!"
          :lng="c.lng!"
          class="h-40 rounded-xl"
        />
        <p v-else-if="placesAvailable" class="text-muted-foreground text-sm">Choose the venue from the suggestions to put it on the map.</p>
      </section>

      <Transition :css="false" @enter="grow" @leave="shrink">
        <section v-if="registrationShown" ref="registrationEl" class="space-y-4">
          <h2 class="text-heading">Registration</h2>
          <TextField
            :model-value="c.registrationURL"
            label="Registration link"
            type="url"
            placeholder="e.g. example.com/register"
            hint="Where dancers sign up. Shown as a button on the competition page."
            :save="save('registrationURL')"
          />
          <div class="grid gap-4 sm:grid-cols-2">
            <TextField :model-value="dateTimeInput(c.registrationStart)" label="Opens" type="datetime-local" :save="save('registrationStart')" />
            <TextField :model-value="dateTimeInput(c.registrationEnd)" label="Closes" type="datetime-local" :save="save('registrationEnd')" />
          </div>
        </section>
      </Transition>

      <Transition :css="false" @enter="grow" @leave="shrink">
        <section v-if="links.length || addingLink" class="space-y-4">
          <div>
            <h2 class="text-heading">Links and files</h2>
            <p class="text-muted-foreground text-sm">Programs, entry forms, maps. Each shows as a button on the competition page.</p>
          </div>
          <MovingList v-if="links.length" class="surface divide-y rounded-2xl">
            <li v-for="link in links" :key="link.id" class="space-y-3 p-4">
              <div class="grid gap-3 sm:grid-cols-2">
                <TextField :model-value="link.name" label="Label" placeholder="e.g. Program" :save="(v) => m.writeInfo({ [`links/${link.id}/name`]: v }, 'Link label')" />
                <TextField :model-value="link.url" label="Link" type="url" required :save="(v) => m.writeInfo({ [`links/${link.id}/url`]: v }, 'Link')" />
              </div>
              <div class="flex items-center justify-between gap-2">
                <Button v-if="link.url" variant="plain" class="-ml-4" :href="formatExternalURL(link.url)" target="_blank" rel="noopener">
                  Open <ExternalLink />
                </Button>
                <Button variant="plain" class="text-destructive! -mr-4 ml-auto" :disabled="!canEdit" @click="removeLink(link)">
                  <Trash2 /> Remove
                </Button>
              </div>
            </li>
          </MovingList>
          <Transition :css="false" @enter="grow" @leave="shrink">
            <form v-if="addingLink" ref="linkFormEl" class="surface space-y-3 rounded-2xl p-4" novalidate @submit.prevent="submitLink">
              <div class="grid gap-3 sm:grid-cols-2">
                <label class="space-y-1.5">
                  <span class="text-callout block font-medium">Label</span>
                  <input v-model="newName" :disabled="!canEdit" type="text" placeholder="e.g. Program" class="field h-12 w-full rounded-xl px-3 text-base" />
                </label>
                <label class="space-y-1.5">
                  <span class="text-callout block font-medium">Link</span>
                  <input
                    v-model="newUrl"
                    :disabled="!canEdit"
                    type="url"
                    placeholder="https://"
                    :aria-invalid="!!linkError || undefined"
                    class="field h-12 w-full rounded-xl px-3 text-base"
                    @input="linkError = null"
                  />
                  <span v-if="linkError" class="text-destructive block text-sm font-medium" role="alert">{{ linkError }}</span>
                </label>
              </div>
              <div class="flex flex-wrap gap-2">
                <Button type="submit" variant="tonal" :disabled="!canEdit || !newUrl.trim()">
                  <Plus /> Add link
                </Button>
                <Button :disabled="!canEdit" :busy="uploading" @click="fileInput?.click()">
                  <FileUp v-if="!uploading" />
                  {{ uploading ? 'Uploading…' : 'Upload a PDF or image' }}
                </Button>
                <input ref="fileInput" type="file" accept="application/pdf,image/*" class="sr-only" tabindex="-1" @change="onFile" />
              </div>
            </form>
          </Transition>
        </section>
      </Transition>

      <Transition :css="false" @enter="grow" @leave="shrink">
        <div v-if="!registrationShown || !addingLink" class="flex flex-wrap gap-2">
          <Button v-if="!registrationShown" :disabled="!canEdit" @click="openRegistration">
            <Plus /> Add registration details
          </Button>
          <Button v-if="!addingLink" :disabled="!canEdit" @click="openLinkForm">
            <Plus /> Add a link or file
          </Button>
        </div>
      </Transition>

      <section class="space-y-3">
        <h2 class="text-heading">Who can see it</h2>
        <div class="surface rounded-2xl px-4 py-1.5">
          <SwitchField
            :model-value="!!c.listed"
            label="Listed"
            description="Shows in the competitions list with its date, venue and judges."
            :save="(on) => m.writeInfo(on ? { listed: true } : { listed: false, published: false }, on ? 'Listed' : 'Unlisted')"
          />
          <div class="border-t" />
          <SwitchField
            :model-value="!!c.published"
            label="Published"
            description="Also shows dancers, the schedule and results."
            :save="(on) => m.writeInfo(on ? { published: true, listed: true } : { published: false }, on ? 'Published' : 'Unpublished')"
          />
        </div>
      </section>

      <section class="space-y-3 border-t pt-8">
        <h2 class="text-heading">Delete this competition</h2>
        <p class="text-muted-foreground text-sm">Removes it and everything in it for everyone. There’s no undo.</p>
        <Button class="text-destructive!" :disabled="!canEdit" @click="deleteCompetition">
          <Trash2 /> Delete competition
        </Button>
      </section>
    </div>

    <aside class="hidden min-w-0 border-l xl:block xl:overflow-y-auto" aria-label="How it looks">
      <div class="space-y-4 p-8">
        <h2 class="text-heading">How it looks</h2>
        <DetailsPreview :competition="c" :competition-id="m.competitionId.value" />
      </div>
    </aside>
  </div>
</template>
