<script setup lang="ts">
import type { Component as PageComponent } from 'vue'
import { RouterView, type RouteLocationNormalizedLoaded } from 'vue-router'
import { beginSwap, endSwapOf, takeMotion } from '@/lib/pageTransition'
import { crossfadeBars, slide } from '@/lib/pageMotion'

// A RouterView whose pages slide (lib/pageTransition). The app's pages use
// it, and so do layouts whose pages change under a bar that stays (a
// competition's tabs, and the pages under them). The app's pages fill a
// column; a layout's sit in its <main> as blocks (`block`).
defineProps<{ block?: boolean }>()

// Each page is its own frame: another page (or the same page for someone
// else, say another competition) is a new frame; a query alone isn't.
function frameKey(route: RouteLocationNormalizedLoaded, component: PageComponent) {
  const record = route.matched.find((r) => r.components?.default === component)
  if (!record) return route.path
  return record.path.replace(/:(\w+)(\([^)]*\))?[?*+]?/g, (_, name: string) =>
    String(route.params[name] ?? ''),
  )
}

let leaving: { el: HTMLElement; done: () => void; docTop: number } | null = null
let motion: ReturnType<typeof takeMotion> = null

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve))

function onLeave(el: Element, done: () => void) {
  // Leaving while it's still moving in: land it first.
  endSwapOf(el)
  motion = takeMotion()
  if (!motion) return done()
  const frame = el as HTMLElement
  const box = frame.getBoundingClientRect()
  const docTop = box.top + scrollY
  leaving = { el: frame, done, docTop }
  pin(frame, box, box.top, scrollY)
}

async function onEnter(el: Element, done: () => void) {
  const old = leaving
  const m = motion
  leaving = null
  motion = null
  const frame = el as HTMLElement
  // What the page already had (say, a list shown before) comes with it; only
  // what loads after it's up settles in (lib/settle).
  for (const a of frame.getAnimations({ subtree: true }))
    if ((a as CSSAnimation).animationName === 'rise-in') a.finish()
  if (!old || !m) return done()
  // Where the page lands: where the old one was, at the scroll it arrives at.
  const box = frame.getBoundingClientRect()
  pin(frame, box, old.docTop, 0)
  let top: number | null = null
  const animations: Animation[] = []
  const swap = beginSwap(m, [old.el, frame], () => {
    for (const a of animations) a.cancel()
    release(frame)
    if (top != null) scrollTo({ top, behavior: 'instant' })
    old.done()
    done()
  })
  animations.push(...crossfadeBars())
  top = await swap.top
  // A newer change cut in while the router answered: it's already landed.
  if (swap.ended) return
  pin(frame, box, old.docTop - (top ?? 0), top ?? 0)
  // Each page waits where it starts (the new one off to the side) until the
  // new one's drawn: started while the phone is still drawing it, the
  // slide's first frames would be skipped.
  const moves = slide(m, old.el, frame)
  for (const a of moves) a.pause()
  animations.push(...moves)
  await nextFrame()
  await nextFrame()
  if (swap.ended) return
  for (const a of moves) a.play()
  await Promise.all(animations.map((a) => a.finished.catch(() => {})))
  swap.end()
}

/**
 * Hold a page still over the whole window, as if the window were scrolled to
 * `scroll`: drawn where `box` had it across, from `top` down, its paper lined
 * up with the page's. The frame spans the window, not just the page's column,
 * so what reaches past the column (a dancer's wash, a full-width band) isn't
 * cut off while it moves.
 */
function pin(frame: HTMLElement, box: DOMRect, top: number, scroll: number) {
  const page = frame.firstElementChild as HTMLElement | null
  // The body's paper (style.css): its light a screen tall at the top.
  Object.assign(frame.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    right: '0',
    height: '100lvh',
    overflow: 'clip',
    pointerEvents: 'none',
    background: `var(--paper-grain) 0 ${-scroll}px / 220px, var(--page-light) 0 ${-scroll}px / 100% 100vh no-repeat var(--page-end)`,
  })
  if (page)
    Object.assign(page.style, {
      position: 'relative',
      top: `${top}px`,
      left: `${box.left}px`,
      width: `${box.width}px`,
      minHeight: `${box.height}px`,
    })
}

function release(frame: HTMLElement) {
  frame.removeAttribute('style')
  ;(frame.firstElementChild as HTMLElement | null)?.removeAttribute('style')
  frame.querySelector(':scope > [data-veil]')?.remove()
}
</script>

<template>
  <RouterView v-slot="{ Component, route }">
    <Transition :css="false" @leave="onLeave" @enter="onEnter">
      <div
        v-if="Component"
        :key="frameKey(route, Component.type as PageComponent)"
        :class="!block && 'flex flex-1 flex-col'"
      >
        <div :class="!block && 'flex flex-1 flex-col'">
          <component :is="Component" />
        </div>
      </div>
    </Transition>
  </RouterView>
</template>
