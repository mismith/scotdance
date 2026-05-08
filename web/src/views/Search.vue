<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Search, X } from '@lucide/vue'

const router = useRouter()
const q = ref('')

function close() {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.replace({ name: 'competitions' })
  }
}

interface Preset {
  kicker: string
  title: string
  sub: string
  count: number
}

const presets: Preset[] = [
  {
    kicker: 'Near you',
    title: 'This weekend within 200 km',
    sub: 'Cobourg, Pickering, Hamilton',
    count: 3,
  },
  {
    kicker: 'Championships',
    title: 'Major championships, this season',
    sub: 'Canadians, Cowal, Worlds',
    count: 6,
  },
  {
    kicker: 'Open now',
    title: 'Registration open',
    sub: 'Comps accepting entries today',
    count: 14,
  },
  {
    kicker: 'Multi-day',
    title: 'Weekend-long competitions',
    sub: 'For families travelling',
    count: 11,
  },
  {
    kicker: 'First-timer',
    title: 'Beginner & Novice friendly',
    sub: 'Smaller fields, pre-Premier',
    count: 22,
  },
  {
    kicker: 'Province',
    title: 'In Ontario',
    sub: 'Your home province',
    count: 18,
  },
]

const examples = [
  { q: 'Aileen', match: 'Aileen Stewart · Premier dancer' },
  { q: 'Maxville', match: 'Glengarry Highland Games at Maxville' },
  { q: 'Premier G3', match: 'Premier G3 results · last 30 days' },
]
</script>

<template>
  <div class="flex flex-1 flex-col">
    <header
      class="bg-background pt-safe sticky top-0 z-20 mx-auto flex w-full max-w-3xl items-center gap-2 p-3"
    >
      <div
        class="bg-nav/90 text-nav-foreground h-12 min-w-0 flex-1 rounded-full border border-white/10 px-4 shadow-md backdrop-blur-xl [view-transition-class:clip] [view-transition-group:contain] [view-transition-name:nav-left]"
      >
        <div class="flex h-full items-center gap-2 [view-transition-name:match-element]">
          <Search class="size-4 shrink-0 opacity-80" />
          <input
            v-model="q"
            type="search"
            placeholder="Search"
            class="placeholder:text-nav-foreground/50 min-w-0 flex-1 bg-transparent text-sm focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
        </div>
      </div>
      <button
        type="button"
        class="bg-nav/90 text-nav-foreground flex size-12 shrink-0 items-center justify-center rounded-full border border-white/10 shadow-md backdrop-blur-xl [view-transition-class:clip] [view-transition-group:contain] [view-transition-name:nav-right] hover:opacity-90"
        title="Close search"
        aria-label="Close search"
        @click="close"
      >
        <span class="[view-transition-name:match-element]">
          <X class="size-5" />
        </span>
      </button>
    </header>
    <main class="mx-auto w-full max-w-3xl flex-1 space-y-6 p-4 pt-0">
      <section class="space-y-3">
        <h2
          class="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase"
        >
          Suggested searches
        </h2>
        <ul class="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <li
            v-for="preset in presets"
            :key="preset.kicker"
            class="bg-card hover:bg-accent flex min-h-24 cursor-pointer flex-col gap-1.5 rounded-xl border p-3"
          >
            <div class="flex items-center justify-between">
              <span
                class="text-primary text-[10px] font-semibold tracking-[0.14em] uppercase"
              >
                {{ preset.kicker }}
              </span>
              <span class="text-primary font-serif text-sm font-medium tabular-nums">
                {{ preset.count }}
              </span>
            </div>
            <div class="font-serif text-base leading-tight font-medium tracking-tight">
              {{ preset.title }}
            </div>
            <div class="text-muted-foreground text-xs leading-snug">{{ preset.sub }}</div>
          </li>
        </ul>
      </section>

      <section class="space-y-2">
        <h2
          class="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase"
        >
          Or just type a name
        </h2>
        <ul class="divide-y rounded-md border">
          <li
            v-for="example in examples"
            :key="example.q"
            class="hover:bg-accent flex cursor-pointer items-center gap-3 p-3"
          >
            <Search class="text-muted-foreground size-4 shrink-0" />
            <div class="min-w-0 flex-1">
              <div class="truncate font-serif text-sm font-medium tracking-tight">
                &ldquo;{{ example.q }}&rdquo;
              </div>
              <div class="text-muted-foreground truncate text-xs">
                → {{ example.match }}
              </div>
            </div>
          </li>
        </ul>
      </section>

      <p class="text-muted-foreground text-xs">
        Search overlay — stub. Presets and examples are placeholders.
      </p>
    </main>
  </div>
</template>
