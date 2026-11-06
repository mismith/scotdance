<script setup lang="ts">
import { computed, onScopeDispose, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { get, onValue } from 'firebase/database'
import { EyeOff } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import EmptyState from '@/components/EmptyState.vue'
import Skeleton from '@/components/Skeleton.vue'
import SectionHeader from '@/components/admin/SectionHeader.vue'
import { setDancerHidden, type HiddenInfo } from '@/composables/useDancerHidden'
import { BASIC_LATEST } from '@/composables/useDancerRecord'
import { dataRef } from '@/firebase'
import { toast } from '@/lib/admin/feedback'
import { friendlyError } from '@/lib/admin/write'
import { formatLongDate } from '@/lib/format'

// Profiles hidden when a family asked (from the dancer's profile): only the
// basic profile shows, to everyone. Showing one again is here, too.

const hidden = ref<Record<string, HiddenInfo>>({})
const loaded = ref(false)
const off = onValue(
  dataRef('dancers:hidden'),
  (snap) => {
    hidden.value = (snap.val() ?? {}) as Record<string, HiddenInfo>
    loaded.value = true
    // Names are read once each, as they're needed.
    for (const id of Object.keys(hidden.value)) void nameOf(id)
  },
  () => (loaded.value = true),
)
onScopeDispose(off)

const names = reactive<Record<string, string>>({})
async function nameOf(id: string) {
  if (id in names) return
  names[id] = ''
  try {
    names[id] = ((await get(dataRef(`dancers/${id}/name`))).val() as string | null) ?? ''
  } catch {
    // The row says it can't tell whose it is.
  }
}

const rows = computed(() => Object.entries(hidden.value).map(([id, info]) => ({ id, ...info })).sort((a, b) => (b.at ?? 0) - (a.at ?? 0)))

const showing = reactive(new Set<string>())
async function showAgain(id: string) {
  showing.add(id)
  try {
    await setDancerHidden(id, false)
    toast(`${names[id] ? `${names[id]}’s profile` : 'The profile'} is showing again`)
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  } finally {
    showing.delete(id)
  }
}
</script>

<template>
  <div class="max-w-3xl space-y-6 p-4 pb-[calc(3rem+var(--safe-bottom))]">
    <SectionHeader
      title="Hidden profiles"
      :count="rows.length || null"
      :description="`Profiles hidden when a family asked. Everyone sees the basic profile: the latest ${BASIC_LATEST} competitions. They stay in Search, Dancers and every competition’s results.`"
    />
    <div v-if="!loaded" class="space-y-2"><Skeleton v-for="i in 3" :key="i" class="h-16 w-full rounded-xl!" /></div>
    <EmptyState v-else-if="!rows.length" :icon="EyeOff" size="inline" title="No hidden profiles" description="Hide one from the dancer’s profile." />
    <ul v-else class="rows-engraved -mx-4 [--inset:1rem] [--inset-end:1rem]">
      <li v-for="r in rows" :key="r.id" class="flex min-h-16 items-center gap-3 px-4 py-2.5">
        <span class="min-w-0 flex-1">
          <RouterLink :to="{ name: 'dancer.info', params: { dancerId: r.id } }" class="text-primary block truncate text-base font-medium">{{ names[r.id] || 'A dancer' }}</RouterLink>
          <span class="text-muted-foreground block text-sm">Hidden by {{ r.byName }} on {{ formatLongDate(r.at) }}</span>
          <span v-if="r.note" class="text-muted-foreground block text-sm break-words">{{ r.note }}</span>
        </span>
        <Button variant="tonal" :busy="showing.has(r.id)" @click="showAgain(r.id)">Show again</Button>
      </li>
    </ul>
  </div>
</template>
