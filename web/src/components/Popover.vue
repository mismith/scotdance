<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import {
  autoUpdate,
  flip,
  offset,
  shift,
  size,
  useFloating,
  type Middleware,
  type Placement,
} from '@floating-ui/vue'
import { onKeyStroke } from '@vueuse/core'
import { X } from '@lucide/vue'

const props = withDefaults(
  defineProps<{
    // Optional v-model:open. If omitted, Popover manages its own open state.
    open?: boolean
    // Override the anchor (defaults to the trigger element).
    anchor?: HTMLElement | null
    // Element whose center seeds the scale morph's transform-origin
    // (defaults to the anchor). Can sit outside the popover — the origin
    // is just a coordinate, it doesn't need to be inside the element.
    morphFrom?: HTMLElement | null
    placement?: Placement
    offsetPx?: number
    // Place the popover on top of the anchor instead of next to it.
    overlap?: boolean
    matchAnchorWidth?: boolean
    widthOffsetPx?: number
    // Render an X button covering the anchor's top-end (e.g. for triggers
    // that fade out when the popover opens, like an avatar).
    closable?: boolean
  }>(),
  {
    open: undefined,
    anchor: undefined,
    morphFrom: undefined,
    placement: 'bottom-start',
    offsetPx: 0,
    overlap: false,
    matchAnchorWidth: false,
    widthOffsetPx: 0,
    closable: false,
  },
)

const emit = defineEmits<{ 'update:open': [boolean] }>()

const internalOpen = ref(false)
const isOpen = computed<boolean>({
  get: () => props.open ?? internalOpen.value,
  set: (v) => {
    internalOpen.value = v
    emit('update:open', v)
  },
})

function setOpen() { isOpen.value = true }
function setClose() { isOpen.value = false }
function toggle() { isOpen.value = !isOpen.value }

onKeyStroke('Escape', () => {
  if (isOpen.value) setClose()
})

// Consumers attach `triggerRef` to their trigger element via the slot
// scope; we avoid a wrapper element so layout stays untouched (and so we
// don't hit the display:contents → empty getBoundingClientRect gotcha).
const triggerEl = ref<HTMLElement | null>(null)
function setTriggerRef(el: unknown) {
  triggerEl.value = (el as HTMLElement | null) ?? null
}
const anchorEl = computed<HTMLElement | null>(() => props.anchor ?? triggerEl.value)
const morphEl = computed<HTMLElement | null>(() => props.morphFrom ?? anchorEl.value)

const floatingRef = useTemplateRef<HTMLElement>('floating')

const middleware = computed<Middleware[]>(() => {
  const m: Middleware[] = []
  if (props.overlap) {
    m.push(
      offset(({ rects, placement }) => {
        const vertical = placement.startsWith('top') || placement.startsWith('bottom')
        const back = vertical ? rects.reference.height : rects.reference.width
        return -back + props.offsetPx
      }),
    )
  } else {
    m.push(offset(props.offsetPx))
  }
  m.push(flip())
  m.push(shift({ padding: 8 }))
  if (props.matchAnchorWidth) {
    m.push(
      size({
        apply({ rects, elements }) {
          const w = Math.max(0, rects.reference.width - props.widthOffsetPx)
          Object.assign(elements.floating.style, { width: `${w}px` })
        },
      }),
    )
  }
  return m
})

// transform: false → floatingStyles uses top/left, matching our sync preset.
const { floatingStyles } = useFloating(anchorEl, floatingRef, {
  placement: computed(() => props.placement),
  middleware,
  whileElementsMounted: autoUpdate,
  transform: false,
})

const closeBtnRef = useTemplateRef<HTMLElement>('closeBtn')
const { floatingStyles: closeBtnStyles } = useFloating(anchorEl, closeBtnRef, {
  placement: 'top-end',
  middleware: [offset(({ rects }) => -rects.reference.height)],
  whileElementsMounted: autoUpdate,
  transform: false,
})

function presetCloseBtn(el: Element) {
  const anchor = anchorEl.value
  if (!anchor) return
  const target = el as HTMLElement
  const aRect = anchor.getBoundingClientRect()
  // offsetWidth/Height ignore the enter-from `scale-50` transform that's
  // already applied; getBoundingClientRect would return the halved rect
  // and the close button would translate when floating-ui later corrects it.
  const w = target.offsetWidth
  const h = target.offsetHeight
  target.style.position = 'absolute'
  target.style.top = `${aRect.top + aRect.height - h}px`
  target.style.left = `${aRect.right - w}px`
}

// floating-ui's first compute is async (microtask), but Vue's enter
// transition starts synchronously. Without this, the popover would animate
// from (0, 0) and snap into place mid-transition.
function presetPosition(el: HTMLElement) {
  const anchor = anchorEl.value
  if (!anchor) return
  const aRect = anchor.getBoundingClientRect()

  if (props.matchAnchorWidth) {
    el.style.width = `${Math.max(0, aRect.width - props.widthOffsetPx)}px`
  }
  el.style.position = 'absolute'

  if (props.overlap) {
    el.style.top = `${aRect.top + props.offsetPx}px`
    el.style.left = `${aRect.left}px`
    return
  }

  // offsetWidth/Height are transform-immune; getBoundingClientRect would
  // return 0/0 here because the enter-from `scale-0` is already applied.
  const tW = el.offsetWidth
  const tH = el.offsetHeight
  const p = props.placement
  const gap = props.offsetPx
  let top = aRect.bottom + gap
  let left = aRect.left

  if (p.startsWith('top')) top = aRect.top - tH - gap
  else if (p.startsWith('left')) {
    top = aRect.top
    left = aRect.left - tW - gap
  } else if (p.startsWith('right')) {
    top = aRect.top
    left = aRect.right + gap
  }

  if (p.endsWith('-end')) {
    if (p.startsWith('top') || p.startsWith('bottom')) left = aRect.right - tW
    else top = aRect.bottom - tH
  } else if (!p.includes('-')) {
    if (p.startsWith('top') || p.startsWith('bottom')) {
      left = aRect.left + (aRect.width - tW) / 2
    } else {
      top = aRect.top + (aRect.height - tH) / 2
    }
  }

  el.style.top = `${top}px`
  el.style.left = `${left}px`
}

// Sets transform-origin to the trigger's center in popover-local coords.
// Reads el.style.left/top (set by presetPosition) rather than
// getBoundingClientRect, because on enter `scale-0` collapses the rect.
function applyMorphOrigin(el: HTMLElement) {
  const morph = morphEl.value
  if (!morph) return
  const mRect = morph.getBoundingClientRect()
  const naturalLeft = parseFloat(el.style.left) || 0
  const naturalTop = parseFloat(el.style.top) || 0
  const ox = mRect.left + mRect.width / 2 - naturalLeft
  const oy = mRect.top + mRect.height / 2 - naturalTop
  el.style.setProperty('--morph-x', `${ox}px`)
  el.style.setProperty('--morph-y', `${oy}px`)
}

function onEnter(el: Element) {
  const target = el as HTMLElement
  presetPosition(target)
  applyMorphOrigin(target)
}

function onBeforeLeave(el: Element) {
  applyMorphOrigin(el as HTMLElement)
}
</script>

<template>
  <slot
    name="trigger"
    :trigger-ref="setTriggerRef"
    :is-open="isOpen"
    :toggle="toggle"
    :open="setOpen"
    :close="setClose"
  />

  <Teleport to="body">
    <Transition
      enter-active-class="transition ease-rubber-band"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition ease-out"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isOpen"
        class="fixed inset-0 z-40"
        aria-hidden="true"
        @click="setClose"
      />
    </Transition>

    <Transition
      enter-active-class="transition-[scale,opacity] ease-rubber-band"
      enter-from-class="scale-0 opacity-0"
      enter-to-class="scale-100 opacity-100"
      leave-active-class="transition-[scale,opacity] ease-out"
      leave-from-class="scale-100 opacity-100"
      leave-to-class="scale-0 opacity-0"
      @enter="onEnter"
      @before-leave="onBeforeLeave"
    >
      <div
        v-if="isOpen"
        ref="floating"
        :style="floatingStyles"
        class="floating-nav will-change-[backdrop-filter] z-50 origin-[var(--morph-x,50%)_var(--morph-y,50%)] overflow-hidden rounded-3xl"
      >
        <slot :close="setClose" />
      </div>
    </Transition>

    <Transition
      enter-active-class="transition-[scale,opacity] delay-75 ease-rubber-band"
      enter-from-class="scale-50 opacity-0"
      leave-active-class="transition-[scale,opacity] ease-out"
      leave-to-class="scale-50 opacity-0"
      @enter="presetCloseBtn"
    >
      <button
        v-if="isOpen && closable"
        ref="closeBtn"
        v-tap-feedback
        type="button"
        :style="closeBtnStyles"
        class="floating-nav pointer-events-auto z-60 flex size-12 items-center justify-center rounded-full hover:opacity-90"
        aria-label="Close"
        @click="setClose"
      >
        <X class="size-5" />
      </button>
    </Transition>
  </Teleport>
</template>
