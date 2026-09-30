<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Check, Palette, Search, X } from '@lucide/vue'
import Dialog from '@/components/Dialog.vue'
import TartanSwatch from '@/components/TartanSwatch.vue'
import TartanBuilder from '@/components/TartanBuilder.vue'
import { useTartansStore } from '@/stores/tartans'
import { useDancerLooksStore } from '@/stores/dancerLooks'

// Choosing the tartan a dancer wears. Pick from the list, or make one.
const props = defineProps<{ open: boolean; dancerId: string; dancerName: string; currentId: string | null }>()
const emit = defineEmits<{ close: []; saved: [tartanId: string | null] }>()

const tartans = useTartansStore()
const looks = useDancerLooksStore()
const first = computed(() => props.dancerName.split(' ')[0] || 'this dancer')

const view = ref<'list' | 'build'>('list')
const q = ref('')
const picked = ref<string | null>(null)
const saving = ref(false)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    view.value = 'list'
    q.value = ''
    picked.value = props.currentId
  },
)

const list = computed(() => {
  // "McLeod" finds MacLeod, and the other way round.
  const norm = (x: string) => x.toLowerCase().replace(/\bmc/g, 'mac')
  const term = norm(q.value.trim())
  return term ? tartans.all.filter((t) => norm(t.name).includes(term)) : tartans.all
})
const pickedTartan = computed(() => tartans.get(picked.value))

async function save(id: string | null) {
  saving.value = true
  try {
    await looks.setPick(props.dancerId, id)
    emit('saved', id)
    emit('close')
  } finally {
    saving.value = false
  }
}
function onCreated(id: string) {
  picked.value = id
  save(id)
}
</script>

<template>
  <Dialog :open="open" variant="sheet" size="md" @close="emit('close')">
    <template #header>
      <h2 class="text-title">{{ view === 'build' ? 'Make a tartan' : `${first}’s tartan` }}</h2>
    </template>

    <div v-if="view === 'build'" class="p-4 pb-[calc(1.5rem+var(--safe-bottom))]">
      <TartanBuilder @created="onCreated" @cancel="view = 'list'" />
    </div>

    <div v-else class="flex min-h-[75svh] flex-col">
      <div class="bg-card sticky top-0 z-10 space-y-3 border-b p-4">
        <div class="relative overflow-hidden rounded-2xl border shadow-inner">
          <TartanSwatch :tartan="pickedTartan" :scale="0.7" class="h-24" />
          <p
            v-if="pickedTartan"
            class="absolute inset-x-2 bottom-2 w-fit max-w-[calc(100%-1rem)] truncate rounded-lg bg-black/65 px-2.5 py-1 text-[0.9375rem] font-bold text-white"
          >
            {{ pickedTartan.name }}
          </p>
          <p v-else class="text-muted-foreground absolute inset-0 flex items-center justify-center text-base font-semibold">
            Pick one below
          </p>
        </div>
        <label class="bg-card border-strong focus-within:border-primary flex h-12 items-center gap-2 rounded-xl border-2 px-3">
          <Search class="text-muted-foreground size-5 shrink-0" />
          <input
            v-model="q"
            type="search"
            autocomplete="off"
            placeholder="Search tartans"
            class="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-base outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          <button v-if="q" type="button" class="text-muted-foreground -mr-1 flex size-10 items-center justify-center" aria-label="Clear" @click="q = ''">
            <X class="size-5" />
          </button>
        </label>
      </div>

      <ul class="flex-1 divide-y" role="listbox" :aria-label="`Tartans for ${first}`">
        <li>
          <button type="button" class="flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left hover:bg-accent" @click="view = 'build'">
            <span class="bg-blue-paper text-primary flex size-12 shrink-0 items-center justify-center rounded-xl">
              <Palette class="size-6" />
            </span>
            <span class="min-w-0">
              <span class="block text-base font-bold">Make your own</span>
              <span class="text-muted-foreground block text-sm">If {{ first }}’s tartan isn’t listed</span>
            </span>
          </button>
        </li>
        <li v-for="t in list" :key="t.id">
          <button
            type="button"
            role="option"
            :aria-selected="picked === t.id"
            :class="['flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left', picked === t.id ? 'bg-blue-paper' : 'hover:bg-accent']"
            @click="picked = t.id"
          >
            <TartanSwatch :tartan="t" :scale="0.35" class="size-12 shrink-0 rounded-xl border shadow-inner" />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-base font-bold">{{ t.name }}</span>
              <span v-if="t.custom" class="text-muted-foreground block text-sm">Made by you</span>
            </span>
            <Check v-if="picked === t.id" class="text-primary size-6 shrink-0" stroke-width="3" />
          </button>
        </li>
        <li v-if="!list.length" class="text-muted-foreground px-4 py-6 text-center text-base">
          No tartan matches “{{ q }}”. Try one word, like the clan name, or make your own.
        </li>
      </ul>

      <div class="bg-card sticky bottom-0 space-y-1 border-t p-4 pb-[calc(1rem+var(--safe-bottom))]">
        <p v-if="pickedTartan?.author && pickedTartan.licence?.includes('BY')" class="text-muted-foreground truncate pb-1 text-center text-xs">
          Pattern by
          <a :href="pickedTartan.sourceUrl" target="_blank" rel="noopener" class="underline">{{ pickedTartan.author }}</a>,
          {{ pickedTartan.licence }}
        </p>
        <button
          type="button"
          class="bg-primary text-primary-foreground h-12 w-full rounded-xl text-base font-bold disabled:opacity-50"
          :disabled="!picked || picked === currentId || saving"
          @click="save(picked)"
        >
          {{ saving ? 'Saving…' : picked && picked === currentId ? 'Already chosen' : pickedTartan ? `Use ${pickedTartan.name}` : 'Choose a tartan' }}
        </button>
        <button
          v-if="currentId"
          type="button"
          class="text-muted-foreground h-11 w-full text-[0.9375rem] font-bold"
          :disabled="saving"
          @click="save(null)"
        >
          Clear your pick
        </button>
      </div>
    </div>
  </Dialog>
</template>
