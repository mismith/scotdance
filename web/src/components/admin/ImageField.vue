<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { ImagePlus, LoaderCircle } from '@lucide/vue'
import AdminField from '@/components/admin/AdminField.vue'
import { canEdit, friendlyError } from '@/lib/admin/write'
import { uploadImage, type UploadFolder } from '@/lib/admin/upload'

// Pick a photo or logo; it's shrunk on the device, uploaded, and saved.

const props = defineProps<{
  modelValue: string | null | undefined
  label: string
  folder: UploadFolder
  competitionId: string
  save: (url: string | null) => unknown
  hint?: string
  /** Round preview for people, rounded square for logos. */
  shape?: 'round' | 'square'
}>()

const id = useId()
const input = ref<HTMLInputElement | null>(null)
const busy = ref(false)
const error = ref<string | null>(null)
const locked = computed(() => !canEdit.value || busy.value)

async function onPick(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (!file) return
  busy.value = true
  error.value = null
  try {
    const url = await uploadImage(file, props.folder, props.competitionId)
    await props.save(url)
  } catch (err) {
    error.value = err instanceof Error && !/permission/i.test(err.message) ? err.message : friendlyError(err)
  } finally {
    busy.value = false
  }
}

async function remove() {
  error.value = null
  try {
    await props.save(null)
  } catch (err) {
    error.value = friendlyError(err)
  }
}
</script>

<template>
  <AdminField :label="label" :for="id" :hint="hint ?? 'JPEG, PNG or WebP. Big photos are shrunk automatically.'" :error="error">
    <div class="flex items-center gap-4">
      <div
        :class="[
          'bg-muted flex size-20 shrink-0 items-center justify-center overflow-hidden border',
          shape === 'round' ? 'rounded-full' : 'rounded-2xl',
        ]"
      >
        <LoaderCircle v-if="busy" class="text-muted-foreground size-6 animate-spin" />
        <img v-else-if="modelValue" :src="modelValue" alt="" class="size-full object-cover" />
        <ImagePlus v-else class="text-muted-foreground size-7" />
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          :disabled="locked"
          class="bg-card border-strong hover:bg-accent h-11 rounded-xl border px-4 text-[0.9375rem] font-bold disabled:opacity-50"
          @click="input?.click()"
        >
          {{ busy ? 'Uploading…' : modelValue ? 'Replace' : 'Choose image' }}
        </button>
        <button
          v-if="modelValue && !busy"
          type="button"
          :disabled="locked"
          class="text-destructive hover:bg-destructive/10 h-11 rounded-xl px-4 text-[0.9375rem] font-bold disabled:opacity-50"
          @click="remove"
        >
          Remove
        </button>
      </div>
      <input :id="id" ref="input" type="file" accept="image/*" class="sr-only" tabindex="-1" @change="onPick" />
    </div>
  </AdminField>
</template>
