<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { hideNativeSplash, isNative } from '@/lib/native'

// The native apps' launch, continued: the same picture as the native splash
// (the mark centred at 9% of the longer side, on the app's background), so
// taking over from it is invisible. Then the dancer's head hops up out of the
// flag and lands, and the app fades in behind it. Native only; with Reduce
// Motion it just fades. Its colours follow the system appearance, as the
// native splash does, not the app's own theme setting.
const router = useRouter()
const show = ref(isNative)
const leaving = ref(false)
const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

onMounted(async () => {
  if (!show.value) return
  // Two frames: this overlay is on screen before the native splash goes.
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  hideNativeSplash()
  const hop = new Promise((r) => setTimeout(r, reduce ? 0 : 900))
  await Promise.all([hop, router.isReady()])
  leaving.value = true
  setTimeout(() => (show.value = false), 260)
})
</script>

<template>
  <div
    v-if="show"
    aria-hidden="true"
    :class="[
      'fixed inset-0 z-[100] grid place-items-center bg-[#f2f4f7] [@media(prefers-color-scheme:dark)]:bg-[#0c0f13] transition-opacity duration-(--dur-base) ease-standard',
      leaving && 'pointer-events-none opacity-0',
    ]"
  >
    <svg
      viewBox="0 0 512 512"
      overflow="visible"
      :class="[
        'size-[max(9vw,9vh)] transition-[scale] duration-(--dur-base) ease-exit',
        leaving && 'scale-110',
      ]"
    >
      <defs>
        <clipPath id="splash-flag"><rect width="512" height="512" rx="115" /></clipPath>
      </defs>
      <g clip-path="url(#splash-flag)" :class="!reduce && 'splash-crouch'">
        <rect width="512" height="512" fill="#0065bd" />
        <g stroke="#fff" stroke-width="96">
          <line x1="-20" y1="74" x2="532" y2="440" />
          <line x1="-20" y1="440" x2="532" y2="74" />
        </g>
      </g>
      <circle cx="256" cy="86" r="70" fill="#fff" :class="!reduce && 'splash-hop'" />
    </svg>
  </div>
</template>
