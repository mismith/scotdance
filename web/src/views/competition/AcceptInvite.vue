<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getCurrentUser } from 'vuefire'
import { onValue } from 'firebase/database'
import { CircleCheck, LoaderCircle, MailOpen, MailX } from '@lucide/vue'
import AppBar from '@/components/nav/AppBar.vue'
import EmptyState from '@/components/EmptyState.vue'
import Button from '@/components/ui/Button.vue'
import { usePageTitle } from '@/composables/usePageTitle'
import { dataRef } from '@/firebase'
import { inviteStatus, type Invite } from '@/lib/admin/invites'
import { friendlyError, write } from '@/lib/admin/write'
import { useAuthStore } from '@/stores/auth'
import { useMeStore } from '@/stores/me'

// Where an admin invite email lands, for a competition or an organisation.
// Accepting asks the server to give this account access to manage it.

const route = useRoute()
const auth = useAuthStore()
const me = useMeStore()
const isOrganisation = computed(() => !!route.params.organisationId)
const ownerId = computed(() => String(route.params.organisationId ?? route.params.competitionId ?? ''))
const inviteId = computed(() => String(route.params.inviteId ?? ''))
const recordPath = computed(() => `${isOrganisation.value ? 'organisations' : 'competitions'}/${ownerId.value}`)
const invitePath = computed(() => `${isOrganisation.value ? 'organisations:data' : 'competitions:data'}/${ownerId.value}/invites/${inviteId.value}`)
const asker = computed(() => (isOrganisation.value ? 'one of its admins' : 'the organiser'))

const competition = ref<{ name?: string } | null>(null)
const invite = ref<Invite | null>(null)
const loaded = ref(false)
const authReady = ref(false)
onMounted(async () => {
  await getCurrentUser()
  authReady.value = true
})

let offs: Array<() => void> = []
watch(
  () => [recordPath.value, invitePath.value, auth.uid],
  () => {
    offs.forEach((off) => off())
    offs = [onValue(dataRef(recordPath.value), (s) => (competition.value = s.val()))]
    if (!auth.uid) return
    offs.push(
      onValue(
        dataRef(invitePath.value),
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

const state = computed(() => {
  if (!authReady.value) return 'loading'
  if (!auth.isSignedIn) return 'signed-out'
  if (!loaded.value) return 'loading'
  const i = invite.value
  if (!i?.created) return 'missing'
  if (isOrganisation.value ? me.hasOrganisationPerm(ownerId.value) : me.hasCompetitionPerm(ownerId.value)) return 'yours'
  const status = inviteStatus(i)
  if (status === 'accepted') return i.acceptedBy === auth.uid ? 'accepting' : 'taken'
  return status === 'pending' ? 'open' : status
})

// The server gives access within a second or two. If it still hasn't after
// a while, it failed, and an invite can only be accepted once: say so.
const slow = ref(false)
let slowTimer: ReturnType<typeof setTimeout> | undefined
watch(
  state,
  (s) => {
    clearTimeout(slowTimer)
    slow.value = false
    if (s === 'accepting') slowTimer = setTimeout(() => (slow.value = true), 20_000)
  },
  { immediate: true },
)
onScopeDispose(() => clearTimeout(slowTimer))

const error = ref<string | null>(null)
async function accept() {
  error.value = null
  try {
    await write({ [`${invitePath.value}/accepted`]: new Date().toISOString() })
  } catch (e) {
    // Refused: someone accepted it first, or it was cancelled or deleted.
    error.value = /permission.denied/i.test(String(e)) ? `This invite can’t be accepted any more. Ask ${asker.value} to invite you again.` : friendlyError(e)
  }
}
const name = computed(() => competition.value?.name ?? (isOrganisation.value ? 'this organisation' : 'this competition'))
const manageRoute = computed(() =>
  isOrganisation.value ? { name: 'organisation.manage', params: { organisationId: ownerId.value } } : { name: 'manage', params: { competitionId: ownerId.value } },
)
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <AppBar title="Invitation" show-title :fallback="{ to: { name: 'home' }, label: 'Home' }" />
    <main class="mx-auto w-full max-w-lg flex-1 px-4 pt-[calc(var(--chrome-top)+1rem)] pb-[calc(var(--chrome-bottom)+1.5rem)]">
      <div v-if="state === 'loading'" class="flex justify-center py-20"><LoaderCircle class="text-muted-foreground size-8 animate-spin" /></div>

      <EmptyState
        v-else-if="state === 'signed-out'"
        :icon="MailOpen"
        :title="`You’re invited to help manage ${name}`"
        description="Sign in, or create an account, to accept. Any email address works."
      >
        <Button variant="primary" size="lg" @click="auth.openLogin()">Sign in to accept</Button>
      </EmptyState>

      <EmptyState
        v-else-if="state === 'open'"
        :icon="MailOpen"
        :title="`Help manage ${name}`"
        :description="isOrganisation ? 'Accept to change its page and add its competitions.' : 'Accept to edit its details, dancers, schedule and results.'"
      >
        <Button variant="primary" size="lg" @click="accept">Accept</Button>
        <template v-if="error" #footer>
          <span class="text-destructive font-medium" role="alert">{{ error }}</span>
        </template>
      </EmptyState>

      <EmptyState
        v-else-if="state === 'accepting' && slow"
        :icon="MailX"
        title="Your access isn’t set up yet"
        :description="`It’s taking much longer than it should. Ask ${asker} to delete this invite and invite you again.`"
      />
      <div v-else-if="state === 'accepting'" class="flex flex-col items-center gap-3 py-20 text-center">
        <LoaderCircle class="text-primary size-8 animate-spin" />
        <p class="text-base font-medium">Setting up your access…</p>
      </div>

      <EmptyState v-else-if="state === 'yours'" :icon="CircleCheck" :title="`You can manage ${name}`">
        <Button variant="primary" size="lg" :to="manageRoute">Start managing</Button>
      </EmptyState>

      <EmptyState v-else-if="state === 'taken'" :icon="MailX" title="This invite was already used" description="It was accepted from another account. Ask to be invited again if that wasn’t you." />
      <EmptyState v-else-if="state === 'cancelled'" :icon="MailX" title="This invite was cancelled" :description="`Ask ${asker} to invite you again.`" />
      <EmptyState v-else-if="state === 'expired'" :icon="MailX" title="This invite has expired" :description="`Ask ${asker} to send it again.`" />
      <EmptyState v-else :icon="MailX" title="Invite not found" :description="`The link may be wrong, or the invite was deleted. Ask ${asker} to invite you again.`" />
    </main>
  </div>
</template>
