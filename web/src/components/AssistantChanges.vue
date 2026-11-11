<script setup lang="ts">
import { ref, watch } from 'vue'
import { History, LoaderCircle, TriangleAlert } from '@lucide/vue'
import Dialog from '@/components/Dialog.vue'
import EmptyState from '@/components/EmptyState.vue'
import Button from '@/components/ui/Button.vue'
import { CHANGES_PAGE, loadChanges, namesOf, type Change } from '@/lib/assistants'
import { formatDateTime } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'

// What one connected AI assistant changed lately (ADR 0018), newest first, from the person's index. View only: undoing
// is done by asking the assistant. (An Undo button would sit in each row, using the change's `scope` and `scopeId`.)

const props = defineProps<{ open: boolean; connection: string; name: string }>()
defineEmits<{ close: [] }>()

const auth = useAuthStore()
const changes = ref<Change[]>([])
const names = ref<Record<string, string>>({})
const limit = ref(CHANGES_PAGE)
const state = ref<'loading' | 'ready' | 'failed'>('loading')
const more = ref(false)

async function load() {
  if (!auth.uid) return
  try {
    // One more than shown tells whether there is more
    const found = await loadChanges(auth.uid, props.connection, limit.value + 1)
    more.value = found.length > limit.value
    changes.value = found.slice(0, limit.value)
    names.value = await namesOf(changes.value)
    state.value = 'ready'
  } catch {
    state.value = 'failed'
  }
}

watch(
  () => props.open,
  (open) => {
    if (!open) return
    limit.value = CHANGES_PAGE
    state.value = 'loading'
    void load()
  },
  { immediate: true },
)

const showMore = ref(false)
async function loadMore() {
  showMore.value = true
  limit.value += CHANGES_PAGE
  await load()
  showMore.value = false
}

const where = (c: Change) => names.value[`${c.scope}/${c.scopeId}`] || (c.scope === 'competitions' ? 'A competition that is gone' : 'An organisation that is gone')
</script>

<template>
  <Dialog :open="open" variant="sheet" @close="$emit('close')">
    <template #header><h2 class="text-title truncate">What {{ name }} changed</h2></template>
    <div class="pb-[calc(1.5rem+var(--safe-bottom))]">
      <div v-if="state === 'loading'" class="flex justify-center py-12" role="status" aria-busy="true">
        <LoaderCircle class="text-muted-foreground size-6 animate-spin" />
      </div>
      <EmptyState v-else-if="state === 'failed'" size="inline" :icon="TriangleAlert" title="That didn’t open" description="Check your connection and try again.">
        <Button variant="primary" @click="load">Try again</Button>
      </EmptyState>
      <EmptyState
        v-else-if="!changes.length"
        size="inline"
        :icon="History"
        title="Nothing changed yet"
        description="When this AI assistant changes something, it shows here for 30 days. Changes it made before then aren’t listed."
      />
      <template v-else>
        <p class="text-muted-foreground px-4 pb-2 text-sm">Newest first. To undo one, ask the AI assistant.</p>
        <ul class="rows-engraved [--inset:1rem] [--inset-end:1rem]">
          <li v-for="c in changes" :key="c.id" class="space-y-0.5 px-4 py-3">
            <span class="block text-base font-semibold break-words" :class="c.undone ? 'text-muted-foreground line-through' : ''">{{ c.summary }}</span>
            <span class="text-muted-foreground block text-sm">{{ where(c) }}</span>
            <span class="text-muted-foreground block text-sm">
              {{ formatDateTime(c.at) }}<template v-if="c.undone"> · Undone</template><template v-else-if="c.undoOf"> · An undo</template>
            </span>
          </li>
        </ul>
        <div v-if="more" class="px-4 pt-2"><Button block :busy="showMore" @click="loadMore">Show more</Button></div>
      </template>
    </div>
  </Dialog>
</template>
