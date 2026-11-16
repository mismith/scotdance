<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { ChevronRight, Plus, Users, Info } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import EmptyState from '@/components/EmptyState.vue'
import { useConnectAccount } from './account'
const store = useConnectAccount()
</script>
<template>
  <section>
    <h1 class="sr-only">Dancers</h1>
    <aside class="mb-6 flex gap-3 rounded-2xl bg-blue-paper p-4 text-callout text-muted-foreground">
      <Info class="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
      <p>Your private dancer profiles help prefill forms across the ScotDance.app family of <a href="https://toolkit.scotdance.app" target="_blank" rel="noopener noreferrer" class="text-primary underline underline-offset-4">tools</a>. You choose what to save.</p>
    </aside>
    <div v-if="store.dancers.length" class="mb-6 flex justify-end">
      <Button to="/dancers/new" variant="primary"><Plus aria-hidden="true" /> Add dancer</Button>
    </div>
    <EmptyState v-if="!store.dancers.length" :icon="Users" title="No dancers yet" description="Add yourself or a dancer you manage.">
      <Button to="/dancers/new" variant="primary"><Plus aria-hidden="true" /> Add dancer</Button>
    </EmptyState>
    <ul v-else class="rows-engraved -mx-4 [--inset:1rem] [--inset-end:1rem]">
      <li v-for="dancer in store.dancers" :key="dancer.id">
        <RouterLink :to="`/dancers/${encodeURIComponent(dancer.id)}`" class="press-row focus-inset flex min-h-20 items-center gap-3 px-4 py-3">
          <span class="flex size-11 shrink-0 items-center justify-center rounded-full bg-blue-paper text-heading font-semibold text-primary" aria-hidden="true">{{ dancer.firstName.slice(0, 1) }}</span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-base font-semibold">{{ dancer.firstName }} {{ dancer.lastName }}</span>
            <span v-if="dancer.category || dancer.studio" class="block truncate text-sm text-muted-foreground">{{ [dancer.category, dancer.studio].filter(Boolean).join(' · ') }}</span>
          </span>
          <ChevronRight class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </RouterLink>
      </li>
    </ul>
  </section>
</template>
