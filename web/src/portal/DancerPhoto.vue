<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue'
import { Camera, Pencil, X, ExternalLink, LoaderCircle } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import Dialog from '@/components/Dialog.vue'
import {
  PHOTO_WIDTH,
  PHOTO_HEIGHT,
  MAX_PHOTO_ZOOM,
  photoFileProblem,
  portraitFrame,
  decodePhoto,
} from './photo'
const photo = defineModel<string | null>({ default: null })
const photoPreview = ref('')
watch(
  photo,
  (value, _, cleanup) => {
    photoPreview.value = ''
    if (!value) return
    // Browsers block top-level data URLs; a local image Blob opens safely in a tab.
    const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(value)
    if (!match) return
    const bytes = Uint8Array.from(atob(match[2]!), (char) => char.charCodeAt(0))
    const url = URL.createObjectURL(new Blob([bytes], { type: match[1] }))
    photoPreview.value = url
    cleanup(() => URL.revokeObjectURL(url))
  },
  { immediate: true },
)
const emit = defineEmits<{ editing: [value: boolean] }>()
const input = ref<HTMLInputElement>()
const id = useId()
const source = ref('')
const image = ref<HTMLImageElement>()
const busy = ref(false)
const dragging = ref(false)
const error = ref('')
const zoom = ref(1),
  x = ref(0),
  y = ref(0)
let generation = 0
const frame = computed(() =>
  portraitFrame(
    image.value?.naturalWidth || 480,
    image.value?.naturalHeight || 600,
    zoom.value,
    x.value,
    y.value,
  ),
)
const imageStyle = computed(() => ({
  width: `${(frame.value.width / PHOTO_WIDTH) * 100}%`,
  height: `${(frame.value.height / PHOTO_HEIGHT) * 100}%`,
  left: `${(frame.value.left / PHOTO_WIDTH) * 100}%`,
  top: `${(frame.value.top / PHOTO_HEIGHT) * 100}%`,
}))
function reset() {
  generation++
  pointers.clear()
  if (source.value) URL.revokeObjectURL(source.value)
  source.value = ''
  image.value = undefined
  busy.value = false
  emit('editing', false)
}
async function choose(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  ;(event.target as HTMLInputElement).value = ''
  if (file) await loadFile(file)
}
function dragOver(event: DragEvent) {
  if (!event.dataTransfer?.types.includes('Files')) return
  event.preventDefault()
  event.stopPropagation()
  event.dataTransfer.dropEffect = busy.value ? 'none' : 'copy'
  dragging.value = !busy.value
}
function dragLeave(event: DragEvent) {
  if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null))
    dragging.value = false
}
async function drop(event: DragEvent) {
  dragging.value = false
  const file = event.dataTransfer?.files[0]
  if (file && !busy.value) await loadFile(file)
}
async function loadFile(file: File) {
  reset()
  error.value = photoFileProblem(file)
  if (error.value) return
  const request = generation
  busy.value = true
  emit('editing', true)
  let url = ''
  try {
    const decoded = await decodePhoto(file)
    url = decoded.url
    const img = decoded.image
    if (request !== generation) {
      URL.revokeObjectURL(url)
      return
    }
    if (img.naturalWidth < 400 || img.naturalHeight < 500)
      throw new Error('Choose a larger photo, at least 400 × 500 pixels.')
    if (img.naturalWidth * img.naturalHeight > 50_000_000)
      throw new Error('Choose a smaller photo, up to 50 megapixels.')
    image.value = img
    source.value = url
    zoom.value = 1
    x.value = 0
    y.value = 0
  } catch (e) {
    URL.revokeObjectURL(url)
    if (request === generation) {
      error.value =
        e instanceof Error && !e.message.includes('decode')
          ? e.message
          : 'This photo could not be opened. Try another JPG or PNG.'
      reset()
    }
  } finally {
    if (request === generation) busy.value = false
  }
}
function removePhoto() {
  photo.value = null
  reset()
}
function apply() {
  if (!image.value) return
  if (frame.value.width / image.value.naturalWidth > 2) {
    error.value = 'Zoom out a little or choose a larger photo to keep it clear.'
    return
  }
  try {
    const canvas = document.createElement('canvas')
    const ratio = Math.min(1, image.value.naturalWidth / frame.value.width)
    canvas.width = Math.round(PHOTO_WIDTH * ratio)
    canvas.height = Math.round(PHOTO_HEIGHT * ratio)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Photo editing is unavailable in this browser.')
    ctx.scale(ratio, ratio)
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, PHOTO_WIDTH, PHOTO_HEIGHT)
    const f = frame.value
    ctx.drawImage(image.value, f.left, f.top, f.width, f.height)
    // Re-encoding keeps only the cropped pixels, removing original EXIF/location metadata.
    photo.value = canvas.toDataURL('image/jpeg', 0.88)
    reset()
    error.value = ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Could not prepare this photo.'
  }
}
const pointers = new Map<number, { x: number; y: number }>()
function gesture() {
  const [first, second] = [...pointers.values()]
  if (!first) return
  return second
    ? {
        x: (first.x + second.x) / 2,
        y: (first.y + second.y) / 2,
        distance: Math.hypot(first.x - second.x, first.y - second.y),
      }
    : { ...first, distance: 0 }
}
function transform(
  target: HTMLElement,
  before: { x: number; y: number },
  after: { x: number; y: number },
  factor = 1,
) {
  const rect = target
    .querySelector<HTMLElement>('[data-photo-crop]')!
    .getBoundingClientRect()
  if (!rect.width) return
  const scale = PHOTO_WIDTH / rect.width
  const previous = frame.value
  // Anchor the same image point under the fingers or wheel cursor.
  const anchorX = ((before.x - rect.left) * scale - previous.left) / previous.width
  const anchorY = ((before.y - rect.top) * scale - previous.top) / previous.height
  zoom.value = Math.max(1, Math.min(MAX_PHOTO_ZOOM, zoom.value * factor))
  const next = frame.value
  const left = (after.x - rect.left) * scale - anchorX * next.width
  const top = (after.y - rect.top) * scale - anchorY * next.height
  x.value =
    next.width > PHOTO_WIDTH
      ? Math.max(-1, Math.min(1, (-2 * left) / (next.width - PHOTO_WIDTH) - 1))
      : 0
  y.value =
    next.height > PHOTO_HEIGHT
      ? Math.max(-1, Math.min(1, (-2 * top) / (next.height - PHOTO_HEIGHT) - 1))
      : 0
}
function start(event: PointerEvent) {
  if (event.button !== 0 || pointers.size >= 2) return
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}
function move(event: PointerEvent) {
  if (!pointers.has(event.pointerId)) return
  const before = gesture()!
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  const after = gesture()!
  transform(
    event.currentTarget as HTMLElement,
    before,
    after,
    before.distance > 0 && after.distance > 0 ? after.distance / before.distance : 1,
  )
}
function end(event: PointerEvent) {
  pointers.delete(event.pointerId)
}
function wheel(event: WheelEvent) {
  if (pointers.size) return
  const target = event.currentTarget as HTMLElement
  const unit =
    event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? target.clientHeight : 1
  const point = { x: event.clientX, y: event.clientY }
  transform(
    target,
    point,
    point,
    Math.exp(-Math.max(-300, Math.min(300, event.deltaY * unit)) * 0.002),
  )
}
function positionWithKeys(event: KeyboardEvent) {
  const step = event.shiftKey ? 0.1 : 0.03
  const directions: Record<string, [number, number]> = {
    ArrowLeft: [step, 0],
    ArrowRight: [-step, 0],
    ArrowUp: [0, step],
    ArrowDown: [0, -step],
  }
  const direction = directions[event.key]
  if (!direction) return
  event.preventDefault()
  x.value = Math.max(-1, Math.min(1, x.value + direction[0]))
  y.value = Math.max(-1, Math.min(1, y.value + direction[1]))
}
onBeforeUnmount(reset)
</script>
<template>
  <section aria-label="Dancer photo" class="min-w-0">
    <h4 class="text-callout font-medium">
      Dancer photo
      <span class="text-muted-foreground text-sm font-normal">(optional)</span>
    </h4>
    <div
      class="field mt-1.5 flex h-12 min-w-0 items-center gap-1 rounded-xl px-2"
      :class="{ 'ring-primary ring-2': dragging }"
      @dragenter="dragOver"
      @dragover="dragOver"
      @dragleave="dragLeave"
      @drop.prevent.stop="drop"
    >
      <a
        v-if="photo"
        :href="photoPreview || undefined"
        target="_blank"
        rel="noopener noreferrer"
        class="text-primary flex min-h-11 min-w-0 flex-1 items-center gap-2"
        aria-label="View dancer photo in a new tab"
      >
        <img
          :src="photo"
          alt="Dancer portrait"
          class="h-10 w-8 shrink-0 rounded object-cover"
        /><span>View</span><ExternalLink class="size-4 shrink-0" aria-hidden="true" />
      </a>
      <button
        v-else
        type="button"
        class="text-primary flex h-full min-w-0 flex-1 items-center gap-2 text-left"
        aria-label="Add dancer photo"
        :disabled="busy"
        @click="input?.click()"
      >
        <LoaderCircle
          v-if="busy"
          class="ml-1 size-4 shrink-0 animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
        <Camera v-else class="ml-1 size-4 shrink-0" aria-hidden="true" />
        <span class="truncate text-base">Add photo</span>
      </button>
      <template v-if="photo">
        <button
          type="button"
          class="press-row text-muted-foreground hover:text-destructive flex size-11 shrink-0 items-center justify-center rounded-full"
          aria-label="Remove dancer photo"
          :disabled="busy"
          @click="removePhoto"
        >
          <X class="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="press-row text-primary -mr-1 flex size-11 shrink-0 items-center justify-center rounded-full"
          aria-label="Edit dancer photo"
          :disabled="busy"
          @click="input?.click()"
        >
          <Pencil class="size-4" aria-hidden="true" />
        </button>
      </template>
    </div>
    <input
      ref="input"
      type="file"
      accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
      class="hidden"
      aria-label="Choose dancer photo"
      @change="choose"
    />
    <Dialog
      v-if="source && image"
      :open="true"
      :morph="false"
      variant="sheet"
      aria-label="Crop photo"
      size="sm"
      @close="reset"
    >
      <template #header><h2 class="text-heading font-semibold">Crop photo</h2></template>
      <template #header-actions
        ><Button variant="primary" @click="apply">Use photo</Button></template
      >
      <div class="space-y-4 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <p class="text-muted-foreground text-sm">
          A clear, front-facing photo of just your dancer, cropped to show their head and
          shoulders. Drag to position. Pinch or scroll to zoom.
        </p>
        <div
          class="focus-visible:outline-primary relative mx-auto aspect-square w-[min(100%,20rem,max(8rem,calc(100svh-18rem)))] touch-none overflow-hidden rounded-lg bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-2"
          tabindex="0"
          role="group"
          aria-label="Photo position"
          :aria-describedby="`${id}-position-help`"
          @keydown="positionWithKeys"
          @pointerdown="start"
          @pointermove="move"
          @pointerup="end"
          @pointercancel="end"
          @lostpointercapture="end"
          @wheel.prevent="wheel"
        >
          <div data-photo-crop class="absolute top-[6.25%] left-[15%] h-[87.5%] w-[70%]">
            <img
              :src="source"
              alt="Portrait crop preview"
              draggable="false"
              class="pointer-events-none absolute max-w-none select-none"
              :style="imageStyle"
            />
            <div
              aria-hidden="true"
              class="pointer-events-none absolute inset-0 shadow-[0_0_0_100vmax_rgb(0_0_0/0.6)] ring-1 ring-white/90"
            />
          </div>
        </div>
        <span :id="`${id}-position-help`" class="sr-only"
          >Drag the photo or use the arrow keys to reposition it. Pinch, scroll, or use
          the slider to zoom.</span
        >
        <label :for="`${id}-zoom`" class="block text-sm"
          >Zoom<input
            :id="`${id}-zoom`"
            v-model.number="zoom"
            class="accent-primary mt-2 block w-full"
            type="range"
            min="1"
            :max="MAX_PHOTO_ZOOM"
            step="0.01"
        /></label>
        <p v-if="error" role="alert" class="text-destructive text-sm">{{ error }}</p>
      </div>
    </Dialog>
    <p v-if="error && !source" role="alert" class="text-destructive mt-2 text-sm">
      {{ error }}
    </p>
  </section>
</template>
