<script setup lang="ts">
import { ref, watch } from 'vue'
import { useConnectAccount, type Dancer } from './account'
const props = defineProps<{ dancer: Dancer }>()
const store = useConnectAccount()
const photo = ref<string | null>(null)
watch(() => `${store.account?.uid}:${props.dancer.id}:${props.dancer.photoVersion}`, async (_, __, cleanup) => {
  let cancelled = false
  cleanup(() => { cancelled = true })
  photo.value = null
  if (!props.dancer.photoVersion || !store.account) return
  try {
    const result = await store.loadPhoto(props.dancer.id, true)
    if (!cancelled) photo.value = result
  } catch { /* Keep the initials when the thumbnail is temporarily unavailable. */ }
}, { immediate: true })
</script>
<template>
  <span class="flex h-14 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-blue-paper text-heading font-semibold text-primary" aria-hidden="true">
    <img v-if="photo" :src="photo" alt="" class="size-full object-cover" />
    <span v-else>{{ dancer.firstName.slice(0, 1) }}</span>
  </span>
</template>
