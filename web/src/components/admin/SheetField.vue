<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { Camera, LoaderCircle, Plus, X } from '@lucide/vue'
import HelpTip from '@/components/admin/HelpTip.vue'
import SheetViewer from '@/components/SheetViewer.vue'
import Button from '@/components/ui/Button.vue'
import { useManagedCompetition } from '@/composables/admin/useManagedCompetition'
import { confirm, toast } from '@/lib/admin/feedback'
import { preparePage } from '@/lib/admin/sheetImage'
import { canEdit, friendlyError, newKey } from '@/lib/admin/write'
import { MAX_SHEET_PAGES, sheetPages } from '@/lib/sheets'
import type { SheetPage } from '@/types/competition'

// One dance's judges' sheet, under its results in Manage › Results: a photo
// of the sheet (camera or library) or the scrutineer's PDF, a page at a
// time. Each page is made small on this device first (lib/admin/sheetImage);
// a PDF's pages become pictures too (lib/admin/pdfPages, loaded only then).
// Deleting a page deletes its file as well (functions/src/sheets.ts), so it
// asks first rather than offering Undo.

const props = defineProps<{ groupId: string; danceId: string; title: string; subtitle?: string }>()

const m = useManagedCompetition()
const uid = useId()
const pages = computed(() => sheetPages(m.sheets.value, props.groupId, props.danceId))

// Pages on their way: what each is doing, in the order they'll land.
interface Pending {
  key: number
  label: string
}
const pending = ref<Pending[]>([])
let nextPending = 0
const hold = (label: string) => {
  const p = { key: nextPending++, label }
  pending.value.push(p)
  return p
}
const say = (p: Pending, label: string) => {
  const found = pending.value.find((x) => x.key === p.key)
  if (found) found.label = label
}
const release = (p: Pending) => (pending.value = pending.value.filter((x) => x.key !== p.key))

const room = () => MAX_SHEET_PAGES - pages.value.length - pending.value.length
const full = computed(() => pages.value.length + pending.value.length >= MAX_SHEET_PAGES)
const busy = computed(() => pending.value.length > 0)

const input = ref<HTMLInputElement | null>(null)
const pick = () => input.value?.click()

// One pick at a time, so pages land in the order they were chosen.
let queue = Promise.resolve()
function onPick(e: Event) {
  const el = e.target as HTMLInputElement
  const files = [...(el.files ?? [])]
  el.value = ''
  if (files.length) queue = queue.then(() => addFiles(files))
}

const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name)

async function addFiles(files: File[]) {
  for (const file of files) {
    if (room() <= 0) {
      toast(`A judges’ sheet has room for ${MAX_SHEET_PAGES} pages.`)
      return
    }
    if (isPdf(file)) {
      const space = room()
      const opening = hold('Opening…')
      try {
        const { pdfPages } = await import('@/lib/admin/pdfPages')
        const { pages: rendered, total } = await pdfPages(file, space)
        release(opening)
        if (total > rendered.length) toast(`Only the first ${rendered.length} of its ${total} pages fit.`)
        let blank = 0
        for (const canvas of rendered) if (!(await addPage(canvas))) blank += 1
        // A blank page (an export's last one, or a scan this device can't read) isn't added.
        if (blank === rendered.length) toast('That PDF’s pages came out blank. If it’s a scan, add a photo of the sheet instead.', { tone: 'error' })
        else if (blank) toast(`Left out ${blank === 1 ? 'a blank page' : `${blank} blank pages`}.`)
      } catch (err) {
        release(opening)
        toast((err as Error).message, { tone: 'error' })
      }
    } else if (file.type.startsWith('image/') || !file.type) {
      if (!(await addPage(file))) toast('That photo came out blank. Try another.', { tone: 'error' })
    } else {
      toast('Choose a photo or a PDF.', { tone: 'error' })
    }
  }
}

/** Prepare, upload and save one page. False when it was blank (and so left out). */
async function addPage(source: File | HTMLCanvasElement): Promise<boolean> {
  const slot = hold('Preparing…')
  try {
    const page = await preparePage(source)
    if (!page) return false
    say(slot, 'Uploading…')
    // Storage loads when something's uploaded, not with the results screen.
    const { uploadSheetPage } = await import('@/lib/admin/upload')
    const { url, path } = await uploadSheetPage(page.blob, m.competitionId.value)
    const order = Math.max(0, ...pages.value.map((p, i) => p._order ?? i)) + 1
    try {
      // Kept out of Undo: undoing a delete couldn't bring the file back.
      await m.writeData(
        { [`sheets/${props.groupId}/${props.danceId}/${newKey()}`]: { url, path, width: page.width, height: page.height, _order: order } },
        null,
      )
    } catch (err) {
      toast(friendlyError(err), { tone: 'error' })
    }
  } catch (err) {
    const code = (err as { code?: string }).code
    toast(code === 'storage/unauthorized' ? 'You don’t have permission to change this.' : (err as Error).message, { tone: 'error' })
  } finally {
    release(slot)
  }
  return true
}

async function remove(page: SheetPage, i: number) {
  const only = pages.value.length === 1
  const ok = await confirm({
    title: only ? 'Delete the judges’ sheet?' : `Delete page ${i + 1}?`,
    message: 'It comes off the results for everyone. You can add it again any time.',
    confirmLabel: 'Delete',
    destructive: true,
  })
  if (!ok) return
  try {
    await m.writeData({ [`sheets/${props.groupId}/${props.danceId}/${page.id}`]: null }, null)
    toast(only ? 'Deleted the judges’ sheet' : `Deleted page ${i + 1}`)
  } catch (err) {
    toast(friendlyError(err), { tone: 'error' })
  }
}

// Who sees it, in a line. (Hidden results say so above this already.)
const reach = computed(() => {
  if (m.competition.value?.published !== true) return 'Everyone sees it under this dance’s results once the competition is published.'
  return 'Everyone sees it under this dance’s results.'
})

const viewerOpen = ref(false)
const startAt = ref(0)
function view(i: number) {
  startAt.value = i
  viewerOpen.value = true
}
</script>

<template>
  <section :aria-labelledby="`${uid}-title`" class="border-t px-4 pt-2 pb-4">
    <div class="flex min-h-12 items-center gap-2">
      <h3 :id="`${uid}-title`" class="font-medium">Judges’ sheet</h3>
      <HelpTip label="About judges’ sheets">
        A photo of the sheet that shows how each judge placed the dancers, or the scrutineer’s PDF. Each page is made small and clear before it uploads.
      </HelpTip>
    </div>

    <template v-if="!pages.length && !pending.length">
      <p class="text-muted-foreground pb-3 text-sm">A photo of how each judge placed the dancers, or its PDF.</p>
      <Button variant="tonal" :disabled="!canEdit" @click="pick">
        <Camera /> Add a photo or PDF
      </Button>
    </template>

    <template v-else>
      <ul class="flex flex-wrap gap-3 pt-1" :aria-label="`${title}: judges’ sheet pages`">
        <li v-for="(p, i) in pages" :key="p.id" class="relative">
          <button
            type="button"
            :aria-label="pages.length > 1 ? `View page ${i + 1}` : 'View the judges’ sheet'"
            class="press block overflow-hidden rounded-md bg-white shadow-sm ring-1 ring-black/10"
            @click="view(i)"
          >
            <img :src="p.url" alt="" :width="p.width" :height="p.height" loading="lazy" decoding="async" class="h-22 w-17 object-contain" />
          </button>
          <button
            type="button"
            :aria-label="pages.length > 1 ? `Delete page ${i + 1}` : 'Delete the judges’ sheet'"
            :disabled="!canEdit"
            class="press bg-foreground text-background absolute -top-2 -right-2 flex size-7 items-center justify-center rounded-full shadow-sm after:absolute after:-inset-2 disabled:opacity-(--disabled-opacity)"
            @click="remove(p, i)"
          >
            <X class="size-3.5" stroke-width="3" />
          </button>
        </li>
        <li v-for="p in pending" :key="`pending-${p.key}`" class="surface flex h-22 w-17 flex-col items-center justify-center gap-1.5 rounded-md">
          <LoaderCircle class="text-primary size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          <span class="text-muted-foreground text-xs font-medium">{{ p.label }}</span>
        </li>
        <li v-if="!full">
          <button
            type="button"
            :disabled="!canEdit"
            class="press text-primary flex h-22 w-20 flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-current/30 text-xs font-semibold disabled:opacity-(--disabled-opacity)"
            @click="pick"
          >
            <Plus class="size-5" />
            Add a page
          </button>
        </li>
      </ul>
      <p class="text-muted-foreground pt-3 text-sm" role="status">
        {{ busy ? 'Stay on this screen until it’s uploaded.' : reach }}
      </p>
    </template>

    <!-- Opened by the buttons above, so screen readers don't meet it on its own. -->
    <input ref="input" type="file" accept="image/*,application/pdf" multiple class="sr-only" tabindex="-1" aria-hidden="true" @change="onPick" />
    <SheetViewer :open="viewerOpen" :title="title" :subtitle="subtitle" :pages="pages" :start-at="startAt" @close="viewerOpen = false" />
  </section>
</template>
