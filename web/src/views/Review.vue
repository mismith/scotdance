<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { get, onValue, set } from 'firebase/database'
import { dataRef } from '@/firebase'
import AppBar from '@/components/nav/AppBar.vue'
import TartanSwatch from '@/components/TartanSwatch.vue'
import { useMeStore } from '@/stores/me'
import { useGuardiansStore, type Claim } from '@/stores/guardians'
import { usePageTitle } from '@/composables/usePageTitle'
import type { Tartan } from '@/lib/tartan'

// Admin: link requests and custom tartans waiting to be checked. People
// already linked to a dancer can approve others themselves, so this is the
// fallback, not the only way in.
usePageTitle(['Requests to check'])
const me = useMeStore()
const guardians = useGuardiansStore()

const allClaims = ref<Record<string, Record<string, Claim>>>({})
const allCustoms = ref<Record<string, Record<string, Omit<Tartan, 'id'>>>>({})
const approvedIds = ref<Record<string, unknown>>({})
const emails = ref<Record<string, string>>({})
const offs: Array<() => void> = []

watch(
  () => me.isAdmin,
  (yes) => {
    offs.splice(0).forEach((off) => off())
    if (!yes) return
    offs.push(onValue(dataRef('dancers:guardians'), (s) => (allClaims.value = s.val() ?? {}), () => {}))
    offs.push(onValue(dataRef('users:tartans'), (s) => (allCustoms.value = s.val() ?? {}), () => {}))
    offs.push(onValue(dataRef('tartans'), (s) => (approvedIds.value = s.val() ?? {}), () => {}))
  },
  { immediate: true },
)
onBeforeUnmount(() => offs.forEach((off) => off()))

const claims = computed(() =>
  Object.entries(allClaims.value)
    .flatMap(([dancerId, byUser]) =>
      Object.entries(byUser ?? {}).map(([uid, c]) => ({ dancerId, uid, ...c })),
    )
    .filter((c) => c.status === 'pending')
    .sort((a, b) => a.createdAt - b.createdAt),
)
const customs = computed(() =>
  Object.entries(allCustoms.value)
    .flatMap(([uid, byId]) => Object.entries(byId ?? {}).map(([id, t]) => ({ uid, ...t, id })))
    .filter((t) => !t.declined && !approvedIds.value[t.id]),
)

watch(claims, async (list) => {
  for (const c of list) {
    if (emails.value[c.uid] !== undefined) continue
    emails.value = { ...emails.value, [c.uid]: '' }
    const snap = await get(dataRef(`users/${c.uid}/email`))
    emails.value = { ...emails.value, [c.uid]: snap.val() ?? '' }
  }
})

const relationship = (c: Claim) => ({ parent: 'Parent or guardian', self: 'The dancer', teacher: 'Teacher' })[c.relationship]
const when = (t: number) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

async function approveTartan(t: (typeof customs.value)[number]) {
  await set(dataRef(`tartans/${t.id}`), { name: t.name, threadcount: t.threadcount, palette: t.palette, createdAt: Date.now() })
}
async function declineTartan(t: (typeof customs.value)[number]) {
  await set(dataRef(`users:tartans/${t.uid}/${t.id}/declined`), true)
}
</script>

<template>
  <div class="flex flex-1 flex-col pb-[calc(var(--chrome-bottom)+1.5rem)]">
    <AppBar title="Requests to check" :fallback="{ to: { name: 'more' }, label: 'More' }" />
    <main class="mx-auto w-full max-w-3xl space-y-6 px-4 pt-[calc(var(--chrome-top)+0.5rem)]">
      <h1 class="text-display">Requests to check</h1>
      <p v-if="!me.isAdmin" class="text-muted-foreground text-base">This page is for ScotDance admins.</p>

      <template v-else>
        <section class="space-y-2">
          <h2 class="text-heading flex items-baseline justify-between">
            Link requests <span class="text-muted-foreground text-sm font-semibold">{{ claims.length }}</span>
          </h2>
          <p v-if="!claims.length" class="bg-card text-muted-foreground rounded-2xl border p-4 text-base shadow-sm">Nothing waiting.</p>
          <ul v-else class="bg-card divide-y overflow-hidden rounded-2xl border shadow-sm">
            <li v-for="c in claims" :key="`${c.dancerId}/${c.uid}`" class="space-y-2 p-4">
              <p class="text-base">
                <b>{{ c.name || emails[c.uid] || 'Someone' }}</b> wants to link to
                <RouterLink :to="{ name: 'dancer.info', params: { dancerId: c.dancerId } }" class="text-primary font-bold">
                  {{ c.dancerName }}
                </RouterLink>
              </p>
              <p class="text-muted-foreground text-sm">
                {{ [relationship(c), c.name ? emails[c.uid] : null, when(c.createdAt)].filter(Boolean).join(' · ') }}<template v-if="c.note"> · “{{ c.note }}”</template>
              </p>
              <div class="flex gap-2">
                <button type="button" class="bg-primary text-primary-foreground h-11 flex-1 rounded-xl text-[0.9375rem] font-bold" @click="guardians.decide(c.dancerId, c.uid, 'approved')">
                  Approve
                </button>
                <button type="button" class="bg-card border-strong h-11 flex-1 rounded-xl border text-[0.9375rem] font-bold" @click="guardians.decide(c.dancerId, c.uid, 'denied')">
                  Decline
                </button>
              </div>
            </li>
          </ul>
        </section>

        <section class="space-y-2">
          <h2 class="text-heading flex items-baseline justify-between">
            Custom tartans <span class="text-muted-foreground text-sm font-semibold">{{ customs.length }}</span>
          </h2>
          <p v-if="!customs.length" class="bg-card text-muted-foreground rounded-2xl border p-4 text-base shadow-sm">Nothing waiting.</p>
          <ul v-else class="bg-card divide-y overflow-hidden rounded-2xl border shadow-sm">
            <li v-for="t in customs" :key="t.id" class="space-y-2 p-4">
              <TartanSwatch :tartan="t" class="h-16 rounded-xl border" />
              <p class="text-base font-bold">{{ t.name }}</p>
              <p class="text-muted-foreground font-mono text-sm break-words">{{ t.threadcount }}</p>
              <div class="flex gap-2">
                <button type="button" class="bg-primary text-primary-foreground h-11 flex-1 rounded-xl text-[0.9375rem] font-bold" @click="approveTartan(t)">
                  Add to the list
                </button>
                <button type="button" class="bg-card border-strong h-11 flex-1 rounded-xl border text-[0.9375rem] font-bold" @click="declineTartan(t)">
                  Keep private
                </button>
              </div>
            </li>
          </ul>
        </section>
      </template>
    </main>
  </div>
</template>
