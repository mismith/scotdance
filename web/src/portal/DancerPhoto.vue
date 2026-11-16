<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useId } from 'vue'
import { Camera, Trash2, LoaderCircle } from '@lucide/vue'
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
const emit = defineEmits<{ editing: [value: boolean] }>()
const input = ref<HTMLInputElement>()
const id = useId()
const source = ref('')
const image = ref<HTMLImageElement>()
const busy = ref(false)
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
  if (source.value) URL.revokeObjectURL(source.value)
  source.value = ''
  image.value = undefined
  busy.value = false
  emit('editing', false)
}
async function choose(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  ;(event.target as HTMLInputElement).value = ''
  if (!file) return
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
let drag: { px: number; py: number; x: number; y: number; width: number } | undefined
function start(event: PointerEvent) {
  if (event.button !== 0) return
  const target = event.currentTarget as HTMLElement
  target.setPointerCapture(event.pointerId)
  drag = {
    px: event.clientX,
    py: event.clientY,
    x: x.value,
    y: y.value,
    width: target.querySelector<HTMLElement>('[data-photo-crop]')!.clientWidth,
  }
}
function move(event: PointerEvent) {
  if (!drag) return
  const ratio = PHOTO_WIDTH / drag.width
  const f = frame.value
  if (f.width > PHOTO_WIDTH)
    x.value = Math.max(
      -1,
      Math.min(
        1,
        drag.x - ((event.clientX - drag.px) * ratio * 2) / (f.width - PHOTO_WIDTH),
      ),
    )
  if (f.height > PHOTO_HEIGHT)
    y.value = Math.max(
      -1,
      Math.min(
        1,
        drag.y - ((event.clientY - drag.py) * ratio * 2) / (f.height - PHOTO_HEIGHT),
      ),
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
    <div class="field mt-1.5 flex h-12 min-w-0 items-center gap-1 rounded-xl px-2">
      <button
        type="button"
        class="text-primary flex h-full min-w-0 flex-1 items-center gap-2 text-left"
        :aria-label="photo ? 'Replace dancer photo' : 'Add dancer photo'"
        :disabled="busy"
        @click="input?.click()"
      >
        <img
          v-if="photo"
          :src="photo"
          alt="Dancer portrait"
          class="h-10 w-8 shrink-0 rounded object-cover"
        />
        <LoaderCircle
          v-else-if="busy"
          class="ml-1 size-4 shrink-0 animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
        <Camera v-else class="ml-1 size-4 shrink-0" aria-hidden="true" />
        <span class="truncate text-base">{{
          photo ? 'Replace photo' : 'Add photo'
        }}</span>
      </button>
      <button
        v-if="photo"
        type="button"
        class="press-row text-muted-foreground hover:text-destructive -mr-1 flex size-11 shrink-0 items-center justify-center rounded-full"
        aria-label="Remove dancer photo"
        @click="removePhoto"
      >
        <Trash2 class="size-4" aria-hidden="true" />
      </button>
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
      variant="center"
      aria-label="Crop photo"
      size="sm"
      @close="reset"
    >
      <div class="space-y-4">
        <h2 class="text-heading pr-10 font-semibold">Crop photo</h2>
        <p class="text-muted-foreground text-sm">
          Front-facing headshot, plain background, no filters. Drag to position.
        </p>
        <div
          class="focus-visible:outline-primary relative mx-auto aspect-square w-full max-w-80 touch-none overflow-hidden rounded-lg bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-2"
          tabindex="0"
          role="group"
          aria-label="Photo position"
          :aria-describedby="`${id}-position-help`"
          @keydown="positionWithKeys"
          @pointerdown="start"
          @pointermove="move"
          @pointerup="drag = undefined"
          @pointercancel="drag = undefined"
          @lostpointercapture="drag = undefined"
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
          >Drag the photo or use the arrow keys to reposition it.</span
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
        <div class="flex justify-end">
          <Button variant="primary" @click="apply">Use photo</Button>
        </div>
      </div>
    </Dialog>
    <p v-if="error && !source" role="alert" class="text-destructive mt-2 text-sm">
      {{ error }}
    </p>
  </section>
</template>
