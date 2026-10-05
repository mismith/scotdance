<script setup lang="ts">
import { computed, ref } from 'vue'
import { MailPlus, ShieldCheck } from '@lucide/vue'
import EmptyState from '@/components/EmptyState.vue'
import Button from '@/components/ui/Button.vue'
import MovingList from '@/components/admin/MovingList.vue'
import type { RawInvite, WithId } from '@/composables/admin/useManagedCompetition'
import { confirm, toast } from '@/lib/admin/feedback'
import { inviteStatus } from '@/lib/admin/invites'
import { canEdit, friendlyError } from '@/lib/admin/write'
import { formatRelative } from '@/lib/format'
import { isNative } from '@/lib/native'
import { useAuthStore } from '@/stores/auth'

// Who can manage a competition or an organisation. Invites are emailed by the
// server; the person accepts from the link and gets access. Removing someone
// deletes their invite, which takes the access away again. People with access
// but no invite (whoever submitted it, or someone a system admin added) are
// `holders`.

type Invite = WithId<RawInvite>

const props = defineProps<{
  invites: Invite[]
  holders: Array<{ uid: string; email: string | null; detail: string }>
  /** Save invite changes; paths start `invites/…`. */
  writeInvites: (updates: Record<string, unknown>) => Promise<unknown>
  newKey: () => string
  /** The page an invite's link opens, e.g. `/competitions/{id}/invites/{inviteId}`. */
  linkFor: (inviteId: string) => string
  /** "this competition" or "this organisation", for the confirmations. */
  what: string
  /** Someone with access whose email can't be looked up. */
  unknownHolder?: string
}>()

const auth = useAuthStore()

const status = (i: Invite) => inviteStatus(i)
const admins = computed(() => props.invites.filter((i) => status(i) === 'accepted'))
const others = computed(() => props.holders.filter((h) => !admins.value.some((i) => i.acceptedBy === h.uid)))
const pending = computed(() => props.invites.filter((i) => status(i) !== 'accepted').sort((a, b) => (b.created ?? '').localeCompare(a.created ?? '')))
const count = computed(() => others.value.length + admins.value.length)
defineExpose({ count })

const email = ref('')
const emailError = ref<string | null>(null)
const sending = ref(false)

async function invite() {
  if (sending.value) return
  const value = email.value.trim().toLowerCase()
  emailError.value = null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    emailError.value = 'Enter an email address, like name@example.com.'
    return
  }
  const already = props.invites.find((i) => i.payload?.email?.toLowerCase() === value && status(i) !== 'cancelled')
  if (already) {
    emailError.value = status(already) === 'accepted' ? 'They’re already an admin.' : 'They’ve already been invited. Resend it below.'
    return
  }
  sending.value = true
  try {
    await props.writeInvites({ [`invites/${props.newKey()}`]: { created: new Date().toISOString(), payload: { email: value } } })
    email.value = ''
    toast(`Invite sent to ${value}`)
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  } finally {
    sending.value = false
  }
}

async function resend(i: Invite) {
  try {
    // Clearing an accept the server turned down (or never finished) lets them accept again.
    await props.writeInvites({ [`invites/${i.id}/created`]: new Date().toISOString(), [`invites/${i.id}/cancelled`]: null, [`invites/${i.id}/accepted`]: null })
    toast(`Sent again to ${i.payload?.email}`)
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  }
}
async function cancel(i: Invite) {
  try {
    await props.writeInvites({ [`invites/${i.id}/cancelled`]: new Date().toISOString() })
    toast('Invite cancelled', { action: { label: 'Undo', run: () => props.writeInvites({ [`invites/${i.id}/cancelled`]: null }) } })
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  }
}
async function removeInvite(i: Invite) {
  try {
    await props.writeInvites({ [`invites/${i.id}`]: null })
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  }
}
async function removeAdmin(i: Invite) {
  const self = i.acceptedBy === auth.uid
  const ok = await confirm({
    title: self ? 'Remove yourself?' : `Remove ${i.payload?.email ?? 'this admin'}?`,
    message: self
      ? `You’ll no longer be able to manage ${props.what}, unless someone invites you again.`
      : `They’ll no longer be able to manage ${props.what}. You can invite them again later.`,
    confirmLabel: 'Remove',
    destructive: true,
  })
  if (!ok) return
  try {
    await props.writeInvites({ [`invites/${i.id}`]: null })
    toast(`Removed ${i.payload?.email ?? 'admin'}`)
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  }
}

// For when the email doesn't arrive: the same link, to send another way.
// The apps aren't on the web, so theirs is the emailed (#/) form.
async function copyLink(i: Invite) {
  const path = props.linkFor(i.id)
  try {
    await navigator.clipboard.writeText(isNative ? `https://scotdance.app/#${path}` : `${location.origin}${path}`)
    toast(`Link copied. Send it to ${i.payload?.email ?? 'them'} any way you like.`)
  } catch {
    toast('The link couldn’t be copied.', { tone: 'error' })
  }
}

const when = (iso?: string) => (iso ? formatRelative(iso) : '')
</script>

<template>
  <div class="space-y-8">
    <section class="space-y-3">
      <MovingList v-if="others.length || admins.length" class="surface divide-y overflow-hidden rounded-2xl">
        <li v-for="o in others" :key="o.uid" class="flex min-h-15 items-center gap-3 px-4 py-2">
          <ShieldCheck class="text-primary size-5 shrink-0" />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-base font-medium">
              {{ o.email ?? (o.uid === auth.uid ? 'You' : (unknownHolder ?? 'Another admin')) }}<span v-if="o.email && o.uid === auth.uid" class="text-muted-foreground font-normal"> (you)</span>
            </span>
            <span class="text-muted-foreground block text-sm">{{ o.detail }}</span>
          </span>
        </li>
        <li v-for="i in admins" :key="i.id" class="flex min-h-15 items-center gap-3 py-2 pr-2 pl-4">
          <ShieldCheck class="text-primary size-5 shrink-0" />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-base font-medium">
              {{ i.payload?.email ?? 'Unknown' }}<span v-if="i.acceptedBy === auth.uid" class="text-muted-foreground font-normal"> (you)</span>
            </span>
            <span class="text-muted-foreground block text-sm">Accepted {{ when(i.accepted) }}</span>
          </span>
          <Button variant="plain" class="text-destructive!" :disabled="!canEdit" @click="removeAdmin(i)">Remove</Button>
        </li>
      </MovingList>
      <EmptyState v-else :icon="ShieldCheck" title="No admins yet" description="Invite someone below to help manage it." />
      <slot name="note" />
    </section>

    <form class="surface space-y-3 rounded-2xl p-4" novalidate @submit.prevent="invite">
      <label :for="`invite-email-${what}`" class="text-heading block">Invite someone</label>
      <!-- (Only flex-1 side by side: stacked, its zero basis would squash it.) -->
      <div class="flex flex-col gap-2 sm:flex-row">
        <input
          :id="`invite-email-${what}`"
          v-model="email"
          type="email"
          inputmode="email"
          autocomplete="off"
          placeholder="name@example.com"
          :aria-invalid="!!emailError || undefined"
          :aria-describedby="`invite-email-${what}-note`"
          class="field placeholder:text-muted-foreground h-12 min-w-0 rounded-xl px-3 text-base sm:flex-1"
        />
        <Button type="submit" variant="primary" size="lg" :disabled="!canEdit" :busy="sending">
          <MailPlus /> Send invite
        </Button>
      </div>
      <p v-if="emailError" :id="`invite-email-${what}-note`" class="text-destructive text-sm font-medium" role="alert">{{ emailError }}</p>
      <p v-else :id="`invite-email-${what}-note`" class="text-muted-foreground text-sm">They’ll get an email with a link. Once they accept (signed in with any account), they can manage it too.</p>
    </form>

    <section v-if="pending.length" class="space-y-3">
      <h2 class="text-heading">Invites</h2>
      <MovingList class="surface divide-y overflow-hidden rounded-2xl">
        <li v-for="i in pending" :key="i.id" class="flex flex-wrap items-center gap-x-2 gap-y-1 py-2 pr-2 pl-4">
          <span class="min-w-0 flex-1 basis-48 py-1">
            <span class="block truncate text-base font-medium">{{ i.payload?.email ?? 'Unknown' }}</span>
            <span v-if="status(i) === 'pending' && i.emailFailed" class="text-destructive block text-sm font-medium">
              The email didn’t go out. Copy the link and send it yourself.
            </span>
            <span v-else class="text-muted-foreground block text-sm">
              {{ status(i) === 'cancelled' ? `Cancelled ${when(i.cancelled)}` : status(i) === 'expired' ? 'Expired' : status(i) === 'accepting' ? 'Accepting…' : `Sent ${when(i.created)}` }}
            </span>
          </span>
          <span class="flex flex-wrap gap-1">
            <Button v-if="status(i) === 'pending'" @click="copyLink(i)">Copy link</Button>
            <Button :disabled="!canEdit" @click="resend(i)">{{ status(i) === 'pending' ? 'Resend' : 'Send again' }}</Button>
            <Button v-if="status(i) === 'pending'" variant="plain" :disabled="!canEdit" @click="cancel(i)">Cancel</Button>
            <Button v-else variant="plain" class="text-destructive!" :disabled="!canEdit" @click="removeInvite(i)">Delete</Button>
          </span>
        </li>
      </MovingList>
    </section>
  </div>
</template>
