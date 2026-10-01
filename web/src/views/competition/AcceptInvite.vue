<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { getCurrentUser } from 'vuefire'
import { onValue } from 'firebase/database'
import { CircleCheck, LoaderCircle, MailOpen, MailX } from '@lucide/vue'
import AppBar from '@/components/nav/AppBar.vue'
import EmptyState from '@/components/EmptyState.vue'
import { usePageTitle } from '@/composables/usePageTitle'
import { dataRef } from '@/firebase'
import { friendlyError, write } from '@/lib/admin/write'
import { useAuthStore } from '@/stores/auth'
import { useMeStore } from '@/stores/me'
import type { Competition } from '@/types/competition'

// Where an admin invite email lands. Accepting asks the server to give this
// account access to manage the competition.

interface Invite {
  created?: string
  cancelled?: string
  expires?: string
  accepted?: string
  acceptedBy?: string
  payload?: { email?: string }
}

const route = useRoute()
const auth = useAuthStore()
const me = useMeStore()
const competitionId = computed(() => String(route.params.competitionId ?? ''))
const inviteId = computed(() => String(route.params.inviteId ?? ''))

const competition = ref<Competition | null>(null)
const invite = ref<Invite | null>(null)
const loaded = ref(false)
const authReady = ref(false)
onMounted(async () => {
  await getCurrentUser()
  authReady.value = true
})

let offs: Array<() => void> = []
watch(
  () => [competitionId.value, inviteId.value, auth.uid],
  () => {
    offs.forEach((off) => off())
    offs = [onValue(dataRef(`competitions/${competitionId.value}`), (s) => (competition.value = s.val()))]
    if (!auth.uid) return
    offs.push(
      onValue(
        dataRef(`competitions:data/${competitionId.value}/invites/${inviteId.value}`),
        (s) => {
          invite.value = s.val()
          loaded.value = true
        },
        () => (loaded.value = true),
      ),
    )
  },
  { immediate: true },
)
onScopeDispose(() => offs.forEach((off) => off()))

usePageTitle(() => ['Invitation', competition.value?.name])

const past = (iso?: string) => !!iso && new Date(iso).getTime() <= Date.now()
const state = computed(() => {
  if (!authReady.value) return 'loading'
  if (!auth.isSignedIn) return 'signed-out'
  if (!loaded.value) return 'loading'
  const i = invite.value
  if (!i?.created) return 'missing'
  if (me.hasCompetitionPerm(competitionId.value)) return 'yours'
  if (past(i.accepted)) return i.acceptedBy ? (i.acceptedBy === auth.uid ? 'accepting' : 'taken') : 'accepting'
  if (past(i.cancelled)) return 'cancelled'
  if (past(i.expires)) return 'expired'
  return 'open'
})

const error = ref<string | null>(null)
async function accept() {
  error.value = null
  try {
    await write({ [`competitions:data/${competitionId.value}/invites/${inviteId.value}/accepted`]: new Date().toISOString() })
  } catch (e) {
    error.value = friendlyError(e)
  }
}
const name = computed(() => competition.value?.name ?? 'this competition')
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <AppBar title="Invitation" show-title :fallback="{ to: { name: 'home' }, label: 'Home' }" />
    <main class="mx-auto w-full max-w-lg flex-1 px-4 pt-[calc(var(--chrome-top)+1rem)] pb-[calc(var(--chrome-bottom)+1.5rem)]">
      <div v-if="state === 'loading'" class="flex justify-center py-20"><LoaderCircle class="text-muted-foreground size-8 animate-spin" /></div>

      <template v-else-if="state === 'signed-out'">
        <EmptyState :icon="MailOpen" :title="`You’re invited to help manage ${name}`" description="Sign in, or create an account, to accept. Any email address works." />
        <div class="flex justify-center"><button type="button" class="bg-primary text-primary-foreground h-12 rounded-xl px-6 text-base font-bold" @click="auth.openLogin()">Sign in to accept</button></div>
      </template>

      <template v-else-if="state === 'open'">
        <EmptyState :icon="MailOpen" :title="`Help manage ${name}`" description="Accept to edit its details, dancers, schedule and results." />
        <div class="flex flex-col items-center gap-2">
          <button type="button" class="bg-primary text-primary-foreground h-12 rounded-xl px-8 text-base font-bold" @click="accept">Accept</button>
          <p v-if="error" class="text-destructive text-sm font-semibold" role="alert">{{ error }}</p>
        </div>
      </template>

      <div v-else-if="state === 'accepting'" class="flex flex-col items-center gap-3 py-20 text-center">
        <LoaderCircle class="text-primary size-8 animate-spin" />
        <p class="text-base font-semibold">Setting up your access…</p>
      </div>

      <template v-else-if="state === 'yours'">
        <EmptyState :icon="CircleCheck" :title="`You can manage ${name}`" />
        <div class="flex justify-center">
          <RouterLink :to="{ name: 'manage', params: { competitionId } }" class="bg-primary text-primary-foreground h-12 content-center rounded-xl px-6 text-base font-bold">Start managing</RouterLink>
        </div>
      </template>

      <EmptyState v-else-if="state === 'taken'" :icon="MailX" title="This invite was already used" description="It was accepted from another account. Ask to be invited again if that wasn’t you." />
      <EmptyState v-else-if="state === 'cancelled'" :icon="MailX" title="This invite was cancelled" description="Ask the organiser to invite you again." />
      <EmptyState v-else-if="state === 'expired'" :icon="MailX" title="This invite has expired" description="Ask the organiser to send it again." />
      <EmptyState v-else :icon="MailX" title="Invite not found" description="The link may be wrong, or the invite was deleted. Ask the organiser to invite you again." />
    </main>
  </div>
</template>
