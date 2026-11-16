<script setup lang="ts">
import { ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import DancerThumbnail from './DancerThumbnail.vue'
import DancerPage from './DancerPage.vue'
import type { Dancer } from './account'
import { ChevronRight, Plus, Users, Shield } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import EmptyState from '@/components/EmptyState.vue'
import { useConnectAccount } from './account'
const store = useConnectAccount()
const editing = ref<Dancer>()
const open = ref(false)
onBeforeRouteLeave(() => { if (open.value) { if (!store.busy) open.value = false; return false } })
function edit(dancer?: Dancer, event?: MouseEvent) { if (event?.currentTarget instanceof HTMLElement) event.currentTarget.focus({ preventScroll: true }); editing.value = dancer; store.error = ''; open.value = true }
</script>
<template>
  <section>
    <h1 class="sr-only">Dancers</h1>
    <div class="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
      <Button @click="edit(undefined, $event)" variant="primary"><Plus aria-hidden="true" /> Add dancer</Button>
      <span class="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Shield class="size-4 shrink-0 text-amber-500 dark:text-amber-400" aria-hidden="true" />Shared only when you consent</span>
    </div>
    <EmptyState v-if="!store.dancers.length" :icon="Users" title="No dancers yet" description="Add yourself or a dancer you manage." />
    <ul v-else class="-mx-3 space-y-1">
      <li v-for="dancer in store.dancers" :key="dancer.id">
        <button type="button" @click="edit(dancer, $event)" class="focus-inset flex w-full text-left min-h-20 items-center gap-3 rounded-xl px-3 py-3 hover:bg-foreground/3 focus-visible:bg-foreground/3">
          <DancerThumbnail :dancer="dancer" />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-base font-semibold">{{ dancer.firstName }} {{ dancer.lastName }}</span>
            <span v-if="dancer.category || dancer.studio" class="block truncate text-sm text-muted-foreground">{{ [dancer.category, dancer.studio].filter(Boolean).join(' · ') }}</span>
          </span>
          <ChevronRight class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      </li>
    </ul>
    <DancerPage v-if="open" :dancer="editing" @close="open = false" />
  </section>
</template>
