<script setup lang="ts">
import { computed, onScopeDispose, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { get, onValue } from 'firebase/database'
import { Check, ShieldCheck } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import EmptyState from '@/components/EmptyState.vue'
import Skeleton from '@/components/Skeleton.vue'
import SectionHeader from '@/components/admin/SectionHeader.vue'
import { dataRef } from '@/firebase'
import { toast } from '@/lib/admin/feedback'
import { friendlyError, write } from '@/lib/admin/write'
import { formatLongDate } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'

// Which accounts have opened lots of dancers' profiles, to catch someone
// browsing children's profiles in the app. (It isn't anti-scraping: results
// are public.) The app records each profile an account opens, once a day
// (lib/profileViews.ts); functions flag any account over 50 different dancers
// in a day and email you (functions/src/profileViews.ts). Below the flags:
// who opened the most over the last week, so 50 can be judged against a
// normal busy week.

interface Flag {
  uid: string
  day: string
  count: number
  week: number
  at: number
  dismissedBy?: string
  dismissedAt?: number
}
interface Person {
  email?: string
  displayName?: string
}

const FLAG_OVER = 50
const auth = useAuthStore()

const flags = ref<Flag[]>([])
const flagsLoaded = ref(false)
const off = onValue(
  dataRef('dancers:viewFlags'),
  (snap) => {
    const val = (snap.val() ?? {}) as Record<string, Record<string, Omit<Flag, 'uid' | 'day'>>>
    flags.value = Object.entries(val)
      .flatMap(([uid, days]) => Object.entries(days).map(([day, f]) => ({ ...f, uid, day })))
      .sort((a, b) => (b.at ?? 0) - (a.at ?? 0))
    flagsLoaded.value = true
    for (const f of flags.value) void personOf(f.uid)
  },
  () => (flagsLoaded.value = true),
)
onScopeDispose(off)
const waiting = computed(() => flags.value.filter((f) => !f.dismissedAt))

// The busiest accounts over the last 7 UTC days: different dancers, counted once.
const busiest = ref<Array<{ uid: string; count: number }>>([])
const busiestLoaded = ref(false)
const days = Array.from({ length: 7 }, (_, i) => new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10))
get(dataRef('dancers:views'))
  .then((snap) => {
    const val = (snap.val() ?? {}) as Record<string, Record<string, Record<string, unknown>>>
    busiest.value = Object.entries(val)
      .map(([uid, byDay]) => ({ uid, count: new Set(days.flatMap((d) => Object.keys(byDay[d] ?? {}))).size }))
      .filter((a) => a.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
    for (const a of busiest.value) void personOf(a.uid)
  })
  .catch(() => {})
  .finally(() => (busiestLoaded.value = true))

// Who an account is, read once each.
const people = reactive<Record<string, Person | null>>({})
async function personOf(uid: string) {
  if (uid in people) return
  people[uid] = null
  try {
    people[uid] = ((await get(dataRef(`users/${uid}`))).val() as Person | null) ?? {}
  } catch {
    // The row says it can't tell whose it is.
  }
}
const nameOf = (uid: string) => people[uid]?.displayName || people[uid]?.email || (people[uid] ? 'No name' : '…')
const emailOf = (uid: string) => (people[uid]?.displayName ? people[uid]?.email : undefined)

const dismissing = reactive(new Set<string>())
async function dismiss(f: Flag) {
  const key = `${f.uid}/${f.day}`
  dismissing.add(key)
  try {
    await write({ [`dancers:viewFlags/${key}/dismissedBy`]: auth.uid, [`dancers:viewFlags/${key}/dismissedAt`]: Date.now() })
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  } finally {
    dismissing.delete(key)
  }
}
</script>

<template>
  <div class="max-w-3xl space-y-8 p-4 pb-[calc(3rem+var(--safe-bottom))]">
    <SectionHeader title="Profile views" description="Accounts opening lots of dancers’ profiles in the app." />

    <section class="space-y-3">
      <h2 class="text-heading">Flagged <span v-if="waiting.length" class="text-muted-foreground text-base font-medium tabular-nums">{{ waiting.length }}</span></h2>
      <div v-if="!flagsLoaded" class="space-y-2"><Skeleton v-for="i in 2" :key="i" class="h-24 w-full rounded-xl!" /></div>
      <EmptyState
        v-else-if="!waiting.length"
        :icon="ShieldCheck"
        size="inline"
        title="Nothing flagged"
        :description="`An account that opens more than ${FLAG_OVER} different dancers’ profiles in a day shows up here, and in an email.`"
      />
      <ul v-else class="rows-engraved -mx-4 [--inset:1rem] [--inset-end:1rem]">
        <li v-for="f in waiting" :key="`${f.uid}/${f.day}`" class="space-y-3 px-4 py-3">
          <div class="min-w-0">
            <span class="block truncate text-base font-medium">{{ nameOf(f.uid) }}</span>
            <span v-if="emailOf(f.uid)" class="text-muted-foreground block truncate text-sm">{{ emailOf(f.uid) }}</span>
          </div>
          <dl class="text-sm [&>div]:flex [&>div]:justify-between [&>div]:gap-3 [&>div]:py-1 [&_dt]:text-muted-foreground [&_dd]:text-right">
            <div><dt>Day</dt><dd>{{ formatLongDate(f.day) }}</dd></div>
            <div><dt>Profiles opened that day</dt><dd class="font-semibold tabular-nums">{{ f.count }}</dd></div>
            <div><dt>Last 7 days</dt><dd class="font-semibold tabular-nums">{{ f.week }}</dd></div>
            <div><dt>Why</dt><dd>Over {{ FLAG_OVER }} in a day</dd></div>
          </dl>
          <div class="flex flex-wrap gap-2">
            <Button variant="tonal" :busy="dismissing.has(`${f.uid}/${f.day}`)" @click="dismiss(f)"><Check /> Looks fine</Button>
            <Button :to="{ name: 'admin.users', params: { userId: f.uid } }">Open in Users</Button>
          </div>
        </li>
      </ul>
    </section>

    <section class="space-y-3">
      <h2 class="text-heading">Most profiles opened, last 7 days</h2>
      <div v-if="!busiestLoaded" class="space-y-2"><Skeleton v-for="i in 4" :key="i" class="h-14 w-full rounded-xl!" /></div>
      <p v-else-if="!busiest.length" class="text-muted-foreground text-sm">No profiles opened in the last 7 days.</p>
      <ol v-else class="rows-engraved -mx-4 [--inset:1rem] [--inset-end:1rem]">
        <li v-for="a in busiest" :key="a.uid">
          <RouterLink :to="{ name: 'admin.users', params: { userId: a.uid } }" class="press-row focus-inset flex min-h-14 items-center gap-3 px-4 py-2">
            <span class="min-w-0 flex-1">
              <span class="block truncate text-base font-medium">{{ nameOf(a.uid) }}</span>
              <span v-if="emailOf(a.uid)" class="text-muted-foreground block truncate text-sm">{{ emailOf(a.uid) }}</span>
            </span>
            <span class="text-base font-semibold tabular-nums">{{ a.count }}</span>
          </RouterLink>
        </li>
      </ol>
      <p class="text-muted-foreground text-sm">Counts each dancer once per account per day. Kept 60 days.</p>
    </section>
  </div>
</template>
