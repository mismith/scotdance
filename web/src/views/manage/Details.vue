<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { FileUp, LoaderCircle, Plus, Trash2 } from '@lucide/vue'
import TextField from '@/components/admin/TextField.vue'
import ImageField from '@/components/admin/ImageField.vue'
import SwitchField from '@/components/admin/SwitchField.vue'
import VenueSearch from '@/components/admin/VenueSearch.vue'
import MapPreview from '@/components/MapPreview.vue'
import { useManagedCompetition } from '@/composables/admin/useManagedCompetition'
import { compareKeys } from '@/lib/competitionData'
import { confirm, toast } from '@/lib/admin/feedback'
import { canEdit, friendlyError, write } from '@/lib/admin/write'
import { uploadLinkFile } from '@/lib/admin/upload'
import { snapshot } from '@/lib/admin/collection'
import { parseDate } from '@/lib/format'
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

const save = (key: string) => (v: string | null) => m.writeInfo({ [key]: v })

async function pickVenue(fields: VenueFields) {
  const updates = { ...fields }
  const before = snapshot(m.competition.value ?? {}, updates)
  try {
    await m.writeInfo(updates)
    toast(`Venue set to ${fields.venue ?? fields.address ?? fields.location ?? 'the place you picked'}`, {
      action: { label: 'Undo', run: () => m.writeInfo(before) },
    })
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  }
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

async function addLink(url?: string, name?: string) {
  const u = (url ?? newUrl.value).trim()
  if (!u) return
  const id = m.newKey()
  const order = links.value.reduce((max, l) => Math.max(max, l._order ?? -1), -1) + 1
  try {
    await m.writeInfo({ [`links/${id}`]: { name: (name ?? newName.value).trim() || null, url: u, _order: order } })
    newName.value = ''
    newUrl.value = ''
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
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
  const updates = { [`links/${link.id}`]: null }
  const before = snapshot(m.competition.value ?? {}, updates)
  try {
    await m.writeInfo(updates)
    toast(`Removed ${link.name || 'the link'}`, { action: { label: 'Undo', run: () => m.writeInfo(before) } })
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
    toast(`Deleted ${name}`)
    await router.replace({ name: 'manage.competitions' })
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  }
}

</script>

<template>
  <div class="mx-auto max-w-2xl space-y-10 p-4 pb-[calc(3rem+var(--safe-bottom))] md:p-8">
    <h1 class="text-display">Details and publishing</h1>

    <section class="space-y-4">
      <h2 class="text-heading">Basics</h2>
      <TextField :model-value="c.name" label="Name" required placeholder="e.g. Canadian Championship 2026" :save="save('name')" />
      <div class="grid gap-4 sm:grid-cols-2">
        <TextField :model-value="dateInput(c.date)" label="Date" type="date" required hint="The first day, if it runs over several." :save="save('date')" />
        <TextField
          :model-value="c.sobhd"
          label="RSOBHD number"
          placeholder="e.g. C-AB-CO-26-1234"
          hint="The registration number, if it has one."
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
      <VenueSearch v-if="placesAvailable && canEdit" @pick="pickVenue" />
      <TextField :model-value="c.venue" label="Venue" placeholder="e.g. Telus Convention Centre" :save="save('venue')" />
      <TextField :model-value="c.address" label="Address" placeholder="e.g. 120 9th Ave SE" :save="save('address')" />
      <TextField
        :model-value="c.location"
        label="Town or city"
        placeholder="e.g. Calgary, Alberta, Canada"
        hint="Used for “near you” and the map. Include the province or state and country."
        :save="save('location')"
      />
      <MapPreview
        v-if="Number.isFinite(c.lat) && Number.isFinite(c.lng)"
        :lat="c.lat!"
        :lng="c.lng!"
        class="h-40 rounded-xl"
      />
      <p v-else-if="placesAvailable" class="text-muted-foreground text-sm">Pick the venue from the search to put it on the map.</p>
    </section>

    <section class="space-y-4">
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

    <section class="space-y-4">
      <div>
        <h2 class="text-heading">Links and files</h2>
        <p class="text-muted-foreground text-sm">Programs, entry forms, maps. Each shows as a button on the competition page.</p>
      </div>
      <ul v-if="links.length" class="bg-card divide-y rounded-2xl border shadow-sm">
        <li v-for="link in links" :key="link.id" class="space-y-3 p-4">
          <div class="grid gap-3 sm:grid-cols-2">
            <TextField :model-value="link.name" label="Label" placeholder="e.g. Program" :save="(v) => m.writeInfo({ [`links/${link.id}/name`]: v })" />
            <TextField :model-value="link.url" label="Link" type="url" required :save="(v) => m.writeInfo({ [`links/${link.id}/url`]: v })" />
          </div>
          <div class="flex items-center justify-between gap-2">
            <a v-if="link.url" :href="link.url" target="_blank" rel="noopener" class="text-primary truncate text-sm font-bold">Open</a>
            <button
              type="button"
              :disabled="!canEdit"
              class="text-destructive hover:bg-destructive/10 ml-auto flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-bold disabled:opacity-50"
              @click="removeLink(link)"
            >
              <Trash2 class="size-4" /> Remove
            </button>
          </div>
        </li>
      </ul>
      <form class="bg-card space-y-3 rounded-2xl border border-dashed p-4" @submit.prevent="addLink()">
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="space-y-1.5">
            <span class="text-[0.9375rem] font-bold">Label</span>
            <input v-model="newName" :disabled="!canEdit" type="text" placeholder="e.g. Program" class="bg-card border-strong focus:border-primary h-12 w-full rounded-xl border-2 px-3 text-base outline-none" />
          </label>
          <label class="space-y-1.5">
            <span class="text-[0.9375rem] font-bold">Link</span>
            <input v-model="newUrl" :disabled="!canEdit" type="url" placeholder="https://" class="bg-card border-strong focus:border-primary h-12 w-full rounded-xl border-2 px-3 text-base outline-none" />
          </label>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="submit" :disabled="!canEdit || !newUrl.trim()" class="bg-primary text-primary-foreground flex h-11 items-center gap-1.5 rounded-xl px-4 text-[0.9375rem] font-bold disabled:opacity-50">
            <Plus class="size-4" /> Add link
          </button>
          <button
            type="button"
            :disabled="!canEdit || uploading"
            class="bg-card border-strong hover:bg-accent flex h-11 items-center gap-1.5 rounded-xl border px-4 text-[0.9375rem] font-bold disabled:opacity-50"
            @click="fileInput?.click()"
          >
            <LoaderCircle v-if="uploading" class="size-4 animate-spin" />
            <FileUp v-else class="size-4" />
            {{ uploading ? 'Uploading…' : 'Upload a PDF or image' }}
          </button>
          <input ref="fileInput" type="file" accept="application/pdf,image/*" class="sr-only" tabindex="-1" @change="onFile" />
        </div>
      </form>
    </section>

    <section class="space-y-3">
      <h2 class="text-heading">Who can see it</h2>
      <div class="bg-card space-y-1 rounded-2xl border px-4 py-2 shadow-sm">
        <SwitchField
          :model-value="!!c.listed"
          label="Listed"
          description="Shows in the competitions list with its date, venue and judges."
          :save="(on) => m.writeInfo(on ? { listed: true } : { listed: false, published: false })"
        />
        <div class="border-t" />
        <SwitchField
          :model-value="!!c.published"
          label="Published"
          description="Also shows dancers, the schedule and results."
          :save="(on) => m.writeInfo(on ? { published: true, listed: true } : { published: false })"
        />
      </div>
    </section>

    <section class="border-destructive/30 space-y-3 rounded-2xl border p-4">
      <h2 class="text-heading">Delete this competition</h2>
      <p class="text-muted-foreground text-sm">Removes it and everything in it for everyone. There’s no undo.</p>
      <button
        type="button"
        :disabled="!canEdit"
        class="text-destructive border-destructive/40 hover:bg-destructive/10 flex h-11 items-center gap-1.5 rounded-xl border px-4 text-[0.9375rem] font-bold disabled:opacity-50"
        @click="deleteCompetition"
      >
        <Trash2 class="size-4" /> Delete competition
      </button>
    </section>
  </div>
</template>
