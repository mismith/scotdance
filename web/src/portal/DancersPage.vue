<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useIntervalFn, useNow } from '@vueuse/core'
import { onBeforeRouteLeave } from 'vue-router'
import DancerThumbnail from './DancerThumbnail.vue'
import DancerPage from './DancerPage.vue'
import type { Dancer } from './account'
import { ChevronRight, LoaderCircle, Plus, ContactRound, UsersRound, Shield } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import EmptyState from '@/components/EmptyState.vue'
import { useConnectAccount } from './account'
const store = useConnectAccount()
const today = useNow({ scheduler: update => useIntervalFn(update, 60_000) })
function ageLabel(birthday: string, now: Date): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday)) return
  const [year, month, day] = birthday.split('-').map(Number)
  const birth = new Date(year, month - 1, day)
  if (birth.getFullYear() !== year || birth.getMonth() !== month - 1 || birth.getDate() !== day || birth > now) return
  const birthdayAhead = now.getMonth() + 1 < month || (now.getMonth() + 1 === month && now.getDate() < day)
  return `Age ${now.getFullYear() - year - Number(birthdayAhead)}`
}
const dancers = computed(() => store.dancers.map(dancer => ({
  dancer,
  description: [dancer.category, ageLabel(dancer.birthday, today.value)].filter(Boolean).join(' · '),
})))
const editing = ref<Dancer>()
const open = ref(false)
const loading = ref<string | null>(null)
const photo = ref<{ value: string | null }>({ value: null })
const problem = ref('')
let generation = 0
function cancelOpening() { generation++; loading.value = null }
onBeforeUnmount(cancelOpening)
watch(() => store.account?.uid, () => { cancelOpening(); open.value = false })
watch(() => store.dancers, dancers => {
  if (open.value && editing.value && !dancers.some(d => d.id === editing.value?.id)) open.value = false
})
onBeforeRouteLeave(() => { cancelOpening(); if (open.value) { if (!store.busy) open.value = false; return false } })
// Prepare the photo on the row; mounting the editor must open only one ready dialog.
async function edit(dancer?: Dancer, event?: MouseEvent) {
  if (loading.value !== null || open.value) return
  if (event?.currentTarget instanceof HTMLElement) event.currentTarget.focus({ preventScroll: true })
  const request = ++generation, owner = store.account?.uid
  problem.value = ''; store.error = ''
  loading.value = dancer?.id ?? 'new'
  try {
    const value = dancer?.photoVersion ? await store.loadPhoto(dancer.id) : null
    if (request !== generation || owner !== store.account?.uid) return
    if (dancer && !store.dancers.some(d => d.id === dancer.id)) return
    photo.value = { value }
    editing.value = dancer
    open.value = true
  } catch (e) {
    if (request === generation) problem.value = e instanceof Error ? e.message : 'Could not open this dancer. Please try again.'
  } finally {
    if (request === generation) loading.value = null
  }
}
</script>
<template>
  <section>
    <h1 class="sr-only">Dancers</h1>
    <div class="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
      <Button @click="edit(undefined, $event)" :disabled="loading !== null" variant="primary"><Plus aria-hidden="true" /> Add dancer</Button>
      <span class="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Shield class="size-4 shrink-0 text-amber-500 dark:text-amber-400" aria-hidden="true" />Shared only when you consent</span>
    </div>
    <p v-if="problem" role="alert" class="mb-4 text-sm text-destructive">{{ problem }}</p>
    <EmptyState v-if="!store.dancers.length" :icon="ContactRound" title="No dancers yet" description="Add yourself or a dancer you manage." />
    <ul v-else class="rows-engraved w-full md:w-1/2 md:max-w-100 [--inset:4rem] [--inset-end:0.5rem]">
      <li v-for="{ dancer, description } in dancers" :key="dancer.id" class="min-w-0">
        <button type="button" :aria-busy="loading === dancer.id || undefined" :disabled="loading !== null" @click="edit(dancer, $event)" class="press-row focus-inset flex w-full text-left min-h-20 items-center gap-3 px-2 py-3">
          <DancerThumbnail :dancer="dancer" />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-base font-semibold">{{ dancer.firstName }} {{ dancer.lastName }}</span>
            <span v-if="description" class="block truncate text-sm text-muted-foreground">{{ description }}</span>
          </span>
          <UsersRound v-if="(dancer.ownerCount ?? 1) > 1" class="size-4 shrink-0 text-muted-foreground" aria-label="Shared dancer" />
          <LoaderCircle v-if="loading === dancer.id" class="size-5 shrink-0 animate-spin text-primary motion-reduce:animate-none" aria-label="Opening dancer" />
          <ChevronRight v-else class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      </li>
    </ul>
    <DancerPage v-if="open" :dancer="editing" :photo="photo" @close="open = false" />
  </section>
</template>
