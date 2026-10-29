<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, useTemplateRef, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useElementSize, useEventListener, useLocalStorage, useStyleTag } from '@vueuse/core'
import { Check, ChevronRight, Download, Printer, Settings } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import Segmented from '@/components/ui/Segmented.vue'
import SectionHeader from '@/components/admin/SectionHeader.vue'
import SectionMenu from '@/components/admin/SectionMenu.vue'
import PrintPage from '@/components/print/PrintPage.vue'
import PrintUnit from '@/components/print/PrintUnit.vue'
import { useManagedCompetition } from '@/composables/admin/useManagedCompetition'
import { toast } from '@/lib/admin/feedback'
import { isNative } from '@/lib/native'
import { printChecks } from '@/lib/print/checks'
import { DOCUMENTS, docDef, documentUnits } from '@/lib/print/documents'
import { PAPER, PRINT_FONT, contentBox, type DocId, type Paper } from '@/lib/print/model'
import { measured, paginate, type Layout } from '@/lib/print/paginate'
import { PLACES_RULES, type PlacesRule } from '@/lib/print/places'
import { printSource, type RawSections } from '@/lib/print/source'

// Manage › Print: the program and the day's sheets, laid
// out from what's in Manage. The pages are
// measured and packed here, so the preview is exactly what prints (or saves
// as a PDF). Each also downloads as a Word file, to edit, cut up or splice
// into the organiser's own.

const m = useManagedCompetition()
const route = useRoute()
const router = useRouter()

const docId = computed<DocId>(() => {
  const d = String(route.params.doc ?? '')
  return DOCUMENTS.some((x) => x.id === d) ? (d as DocId) : 'program'
})
const doc = computed(() => docDef(docId.value))
const pickDoc = (d: DocId) => router.replace({ name: 'manage.print', params: { competitionId: m.competitionId.value, doc: d === 'program' ? undefined : d } })

// Choices are remembered on this device, per competition.
interface Prefs {
  paper?: Paper
  places?: PlacesRule
}
const stored = useLocalStorage<Record<string, Prefs>>('print:prefs', {})
const prefs = computed<Prefs>(() => stored.value[m.competitionId.value] ?? {})
const setPref = (p: Prefs) => (stored.value = { ...stored.value, [m.competitionId.value]: { ...prefs.value, ...p } })

// Letter in North America (and where Letter is the norm), A4 elsewhere.
const LETTER = new Set(['CA', 'US', 'MX', 'PH', 'CL', 'CO', 'VE', 'GT', 'CR', 'PA'])
const paper = computed<Paper>(() => prefs.value.paper ?? (LETTER.has((m.competition.value?.country ?? 'CA').toUpperCase()) ? 'letter' : 'a4'))
const places = computed<PlacesRule>(() => prefs.value.places ?? 'six')

const source = computed(() => printSource(m.competitionId.value, m.competition.value, m.raw.value as RawSections))
const parts = computed(() => doc.value.parts.map((p) => p.id))
const units = computed(() => documentUnits(source.value, docId.value, parts.value, { places: places.value }))
const checks = computed(() => printChecks(source.value, docId.value))
const title = computed(() => m.competition.value?.name?.trim() || 'Competition')

// --- Measuring and packing

const size = computed(() => PAPER[paper.value])
const upright = computed(() => contentBox(paper.value))
const sideways = computed(() => contentBox(paper.value, true))
const toMeasure = computed(() => measured(units.value))
// Upright units at the page's width, sideways ones at its height.
const measureEl = useTemplateRef<HTMLElement>('measure')
const measureSidewaysEl = useTemplateRef<HTMLElement>('measureSideways')
const layout = shallowRef<Layout>({ pages: [], overflow: [] })
const measuring = ref(true)

let run = 0
async function measure() {
  const mine = ++run
  measuring.value = true
  await nextTick()
  await document.fonts?.ready
  if (mine !== run || !measureEl.value || !measureSidewaysEl.value) return
  const heights = new Map<string, number>()
  const els = [...measureEl.value.children, ...measureSidewaysEl.value.children] as HTMLElement[]
  for (const el of els) heights.set(el.dataset.key ?? '', el.getBoundingClientRect().height)
  layout.value = paginate(units.value, heights, { upright: upright.value.height, sideways: sideways.value.height })
  measuring.value = false
}
watch([toMeasure, paper], measure, { immediate: true, flush: 'post' })

const pages = computed(() => layout.value.pages)
const tooTall = computed(() => layout.value.overflow.length)


// The preview: real pages, zoomed to the column.
const previewEl = useTemplateRef<HTMLElement>('preview')
const { width: previewWidth } = useElementSize(previewEl)
const zoom = computed(() => Math.min(1, (previewWidth.value || size.value.width) / size.value.width))

// --- Printing: a copy of the previewed pages at full size, straight in
// <body> (style.css leaves everything else off the paper), at the paper's
// size. It's made when printing starts, from the button or the browser's own
// Print (⌘P), and removed after.

useStyleTag(computed(() => `@page { size: ${size.value.css}; margin: 0; }`), { id: 'print-page-size' })
let staged: HTMLElement | null = null
let titleBefore: string | null = null
function stage() {
  if (staged || !previewEl.value) return staged
  const root = document.createElement('div')
  root.dataset.printRoot = ''
  root.className = 'hidden print:block'
  for (const page of previewEl.value.querySelectorAll('[data-print-page]')) root.append(page.cloneNode(true))
  document.body.append(root)
  staged = root
  // Save as PDF suggests the document's title as its file name.
  titleBefore = document.title
  document.title = `${title.value} ${doc.value.label}`
  return root
}
function unstage() {
  staged?.remove()
  staged = null
  if (titleBefore != null) document.title = titleBefore
  titleBefore = null
}
async function print() {
  const root = stage()
  if (!root) return
  await document.fonts?.ready
  // The cover's logo, if it has one, before the pages go to paper.
  const loading = Array.from(root.querySelectorAll('img')).filter((img) => !img.complete)
  await Promise.all(
    loading.map(
      (img) =>
        new Promise((done) => {
          img.addEventListener('load', done, { once: true })
          img.addEventListener('error', done, { once: true })
        }),
    ),
  )
  window.print()
}
useEventListener(window, 'beforeprint', () => void stage())
useEventListener(window, 'afterprint', unstage)
onBeforeUnmount(unstage)

// --- Download: the document as a Word file, which Google Docs and Pages
// open too.

const downloading = ref(false)
async function download() {
  downloading.value = true
  try {
    const { documentDocx } = await import('@/lib/print/docx')
    const blob = await documentDocx(units.value, { doc: docId.value, paper: paper.value, title: title.value, numbered: true })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title.value.replace(/[^\w-]+/g, ' ').trim()} ${doc.value.label.toLowerCase()}.docx`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch {
    toast('Couldn’t make the Word file. Try again.', { tone: 'error' })
  } finally {
    downloading.value = false
  }
}

const empty = computed(() => {
  if (docId.value === 'day') return 'Platform sheets need a schedule with age groups on its platforms.'
  return 'Add dancers and a schedule, and their pages show here.'
})
const to = (name: string, itemId?: string) => ({ name, params: { competitionId: m.competitionId.value, ...(itemId ? { itemId } : {}) } })
</script>

<template>
  <div class="mx-auto max-w-6xl p-4 pb-[calc(3rem+var(--safe-bottom))] lg:grid lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start lg:gap-8">
    <!-- Beside the preview, the controls scroll on their own, so Print is always in reach. -->
    <div class="space-y-6 lg:sticky lg:top-0 lg:-mx-2 lg:-mt-4 lg:max-h-[calc(100dvh-var(--chrome-top))] lg:overflow-y-auto lg:px-2 lg:pt-4 lg:pb-6">
      <SectionHeader title="Print" description="A program and platform sheets, laid out from what’s in Manage.">
        <!-- Settings rarely changed: the paper follows the competition's
             country, and up to six places suits most. -->
        <template #actions>
          <SectionMenu v-slot="{ row, close }" label="Print options" :icon="Settings">
            <p class="text-muted-foreground px-3 pt-1 pb-1 text-sm font-semibold">Paper size</p>
            <button v-for="p in (['letter', 'a4'] as const)" :key="p" type="button" :class="row" :aria-pressed="paper === p" @click="close(); setPref({ paper: p })">
              <span class="flex-1">{{ PAPER[p].label }}</span><Check v-if="paper === p" class="text-primary!" />
            </button>
            <template v-if="docId === 'program'">
              <div role="separator" class="bg-border mx-4 my-1 h-px" />
              <p class="text-muted-foreground px-3 pt-1 pb-1 text-sm font-semibold">Places on each grid</p>
              <button v-for="r in PLACES_RULES" :key="r.value" type="button" :class="row" :aria-pressed="places === r.value" @click="close(); setPref({ places: r.value })">
                <span class="flex-1">{{ r.label }}</span><Check v-if="places === r.value" class="text-primary!" />
              </button>
            </template>
          </SectionMenu>
        </template>
      </SectionHeader>

      <Segmented :model-value="docId" :options="DOCUMENTS.map((d) => ({ value: d.id, label: d.label }))" label="Document" @update:model-value="(d) => pickDoc(d as DocId)" />

      <section v-if="checks.length || tooTall" class="space-y-2" aria-labelledby="print-checks">
        <h2 id="print-checks" class="text-heading">Before you print</h2>
        <ul class="rows-engraved -mx-4 [--inset:2.125rem] [--inset-end:1rem]">
          <li v-for="c in checks" :key="c.id">
            <RouterLink :to="to(c.route, c.itemId)" class="press-row focus-inset flex min-h-14 items-center gap-3 py-2 pr-3 pl-4">
              <span aria-hidden="true" class="h-8 w-1.5 shrink-0 rounded-full bg-[repeating-linear-gradient(135deg,var(--next-foreground)_0_3px,var(--next)_3px_6px)]" />
              <span class="min-w-0 flex-1 text-base font-medium">{{ c.text }}</span>
              <span class="text-primary text-sm font-semibold">Fix</span>
              <ChevronRight class="text-muted-foreground size-5 shrink-0" />
            </RouterLink>
          </li>
          <li v-if="tooTall" class="flex min-h-14 items-center gap-3 py-2 pr-3 pl-4">
            <span aria-hidden="true" class="h-8 w-1.5 shrink-0 rounded-full bg-[repeating-linear-gradient(135deg,var(--next-foreground)_0_3px,var(--next)_3px_6px)]" />
            <span class="min-w-0 flex-1 text-base font-medium">{{ tooTall === 1 ? 'One block is' : `${tooTall} blocks are` }} too long for a page, so the end is cut off</span>
          </li>
        </ul>
      </section>

      <div v-if="!isNative" class="space-y-2">
        <Button variant="primary" size="lg" block :disabled="!pages.length || downloading" @click="download">
          <Download aria-hidden="true" />
          <template v-if="downloading">Downloading…</template>
          <template v-else>Download <span class="font-normal opacity-80">for Word, Docs or Pages</span></template>
        </Button>
        <Button size="lg" block :disabled="!pages.length || measuring" @click="print"><Printer aria-hidden="true" />Print</Button>
      </div>
      <p v-else class="text-muted-foreground text-sm">To download or print, open scotdance.app in a browser on a computer.</p>
    </div>

    <section class="mt-8 min-w-0 space-y-3 lg:mt-0" aria-label="Preview">
      <p class="text-muted-foreground text-sm font-medium tabular-nums" aria-live="polite">
        <template v-if="pages.length">{{ pages.length }} {{ pages.length === 1 ? 'page' : 'pages' }} · {{ size.label }}</template>
        <template v-else-if="!measuring">Nothing to print yet</template>
      </p>
      <div ref="preview" class="w-full" :style="{ maxWidth: `${size.width}px` }">
        <p v-if="!pages.length && !measuring" class="text-muted-foreground text-base">{{ empty }}</p>
        <div
          v-for="(page, i) in pages"
          :key="i"
          class="mb-4 overflow-hidden rounded-sm shadow-[0_0_0_0.5px_rgb(0_0_0/0.15),0_4px_16px_-6px_rgb(0_0_0/0.25)] [content-visibility:auto]"
          :style="{ zoom, containIntrinsicSize: `auto ${size.height}px` }"
        >
          <PrintPage :units="page" :paper="paper" :number="i + 1" numbered />
        </div>
      </div>
    </section>

    <!-- Every unit at the width it's printed, out of sight, to measure. -->
    <div ref="measure" aria-hidden="true" inert class="pointer-events-none invisible fixed top-0 -left-[20000px] text-[10pt] leading-[1.3]" :style="{ width: `${upright.width}px`, fontFamily: PRINT_FONT }">
      <div v-for="u in toMeasure.filter((x) => !x.rotate)" :key="u.key" :data-key="u.key" class="flow-root">
        <PrintUnit :unit="u" />
      </div>
    </div>
    <div ref="measureSideways" aria-hidden="true" inert class="pointer-events-none invisible fixed top-0 -left-[20000px] text-[10pt] leading-[1.3]" :style="{ width: `${sideways.width}px`, fontFamily: PRINT_FONT }">
      <div v-for="u in toMeasure.filter((x) => x.rotate)" :key="u.key" :data-key="u.key" class="flow-root">
        <PrintUnit :unit="u" />
      </div>
    </div>

  </div>
</template>
