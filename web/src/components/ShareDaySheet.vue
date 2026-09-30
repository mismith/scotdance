<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Download, Link, Share } from '@lucide/vue'
import Dialog from '@/components/Dialog.vue'
import { drawShareCard } from '@/lib/shareCard'
import type { DancerDay } from '@/lib/dancerDay'
import type { Competition } from '@/types/competition'

// "Share Emma's day": a result card image for the family chat, plus a plain
// link to the page. Uses the phone's own share menu where it can.
const props = defineProps<{
  open: boolean
  days: DancerDay[]
  competition: Competition | null
  color: string | null
  hasPlacings: boolean
}>()
const emit = defineEmits<{ close: [] }>()

const url = ref<string | null>(null)
const blob = ref<Blob | null>(null)
const status = ref<string | null>(null)
const first = computed(() => props.days[0]?.dancer.firstName || props.days[0]?.dancer.fullName || 'Dancer')
const fileName = computed(() => `${(props.days[0]?.dancer.fullName ?? 'dancer').replace(/\s+/g, '-')}-results.png`)

watch(
  () => props.open,
  async (open) => {
    status.value = null
    if (!open) return
    try {
      blob.value = await drawShareCard({ days: props.days, competition: props.competition, color: props.color })
      if (url.value) URL.revokeObjectURL(url.value)
      url.value = URL.createObjectURL(blob.value)
    } catch {
      status.value = 'The card couldn’t be drawn. You can still share the link.'
    }
  },
)
onBeforeUnmount(() => url.value && URL.revokeObjectURL(url.value))

async function shareImage() {
  if (!blob.value) return
  const file = new File([blob.value], fileName.value, { type: 'image/png' })
  const data: ShareData = { files: [file], title: `${first.value}’s results` }
  if (navigator.canShare?.(data)) {
    try {
      await navigator.share(data)
      return
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
  }
  save()
}

function save() {
  if (!url.value) return
  const a = document.createElement('a')
  a.href = url.value
  a.download = fileName.value
  a.click()
  status.value = 'Saved to your downloads.'
}

async function shareLink() {
  const href = window.location.href
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ url: href, title: `${first.value} at ${props.competition?.name ?? 'ScotDance'}` })
      return
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
  }
  try {
    await navigator.clipboard.writeText(href)
    status.value = 'Link copied.'
  } catch {
    status.value = href
  }
}
</script>

<template>
  <Dialog :open="open" variant="sheet" @close="emit('close')">
    <template #header>
      <h2 class="text-title">Share {{ first }}’s day</h2>
    </template>
    <div class="space-y-3 p-4 pb-[calc(1.5rem+var(--safe-bottom))]">
      <img
        v-if="url"
        :src="url"
        :alt="`Result card for ${first}`"
        class="mx-auto aspect-[4/5] w-full max-w-72 rounded-xl border shadow-md"
      />
      <div v-else class="bg-muted mx-auto aspect-[4/5] w-full max-w-72 animate-pulse rounded-xl" />
      <p v-if="!hasPlacings" class="text-muted-foreground text-center text-sm">
        No placings yet. The card fills in as results are posted.
      </p>
      <button
        type="button"
        class="bg-primary text-primary-foreground flex h-12 w-full items-center justify-center gap-2 rounded-xl text-base font-bold disabled:opacity-60"
        :disabled="!blob"
        @click="shareImage"
      >
        <Share class="size-5" /> Share image
      </button>
      <div class="grid grid-cols-2 gap-2">
        <button
          type="button"
          class="bg-card border-strong flex h-12 items-center justify-center gap-2 rounded-xl border text-base font-bold"
          :disabled="!blob"
          @click="save"
        >
          <Download class="size-5" /> Save
        </button>
        <button
          type="button"
          class="bg-card border-strong flex h-12 items-center justify-center gap-2 rounded-xl border text-base font-bold"
          @click="shareLink"
        >
          <Link class="size-5" /> Share link
        </button>
      </div>
      <p v-if="status" class="text-center text-[0.9375rem] font-semibold" role="status">{{ status }}</p>
    </div>
  </Dialog>
</template>
