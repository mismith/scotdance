<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { get, onValue } from 'firebase/database'
import { MailPlus, ShieldCheck } from '@lucide/vue'
import EmptyState from '@/components/EmptyState.vue'
import SectionHeader from '@/components/admin/SectionHeader.vue'
import { useManagedCompetition, type RawInvite, type WithId } from '@/composables/admin/useManagedCompetition'
import { dataRef } from '@/firebase'
import { confirm, toast } from '@/lib/admin/feedback'
import { inviteStatus } from '@/lib/admin/invites'
import { canEdit, friendlyError } from '@/lib/admin/write'
import { formatRelative } from '@/lib/format'
import { isNative } from '@/lib/native'
import { useAuthStore } from '@/stores/auth'
import { useMeStore } from '@/stores/me'

// Who can manage this competition. Invites are emailed by the server; the
// person accepts from the link and gets access. Removing someone deletes
// their invite, which takes the access away again.

const m = useManagedCompetition()
const auth = useAuthStore()
const me = useMeStore()

type Invite = WithId<RawInvite>
const status = (i: Invite) => inviteStatus(i)

const admins = computed(() => m.invites.value.filter((i) => status(i) === 'accepted'))

// Everyone else who can manage it has no invite: whoever submitted it, or
// someone a system admin added. Only system admins can look up who they are.
const holders = ref<string[]>([])
watch(
  () => m.competitionId.value,
  (id, _, onCleanup) => {
    holders.value = []
    const off = onValue(
      dataRef(`competitions:permissions/${id}/users`),
      (snap) => (holders.value = Object.entries(snap.val() ?? {}).filter(([, on]) => on === true).map(([uid]) => uid)),
      () => (holders.value = []),
    )
    onCleanup(off)
  },
  { immediate: true },
)
const known = reactive<Record<string, string>>({})
const submittedBy = ref<string | null>(null)
watch(
  [holders, () => me.isAdmin],
  async ([uids, isAdmin]) => {
    if (!isAdmin) return
    try {
      const sid = (m.competition.value as { submissionId?: string } | null)?.submissionId
      const sub = sid ? (await get(dataRef(`competitions:submissions/${sid}`))).val() : null
      submittedBy.value = sub?.submittedBy ?? null
      if (sub?.submittedBy && sub.contact?.email) known[sub.submittedBy] = sub.contact.email
      for (const uid of uids.filter((u) => !(u in known))) known[uid] = (await get(dataRef(`users/${uid}/email`))).val() ?? ''
    } catch {
      /* names are a nicety */
    }
  },
  { immediate: true },
)
const others = computed(() =>
  holders.value
    .filter((uid) => !admins.value.some((i) => i.acceptedBy === uid))
    .map((uid) => ({
      uid,
      email: uid === auth.uid ? me.email : known[uid] || null,
      detail: uid === submittedBy.value ? 'Submitted the competition' : 'Organiser',
    })),
)
const pending = computed(() => m.invites.value.filter((i) => status(i) !== 'accepted').sort((a, b) => (b.created ?? '').localeCompare(a.created ?? '')))

const email = ref('')
const emailError = ref<string | null>(null)
const sending = ref(false)

async function invite() {
  const value = email.value.trim().toLowerCase()
  emailError.value = null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    emailError.value = 'Enter an email address, like name@example.com.'
    return
  }
  const already = m.invites.value.find((i) => i.payload?.email?.toLowerCase() === value && status(i) !== 'cancelled')
  if (already) {
    emailError.value = status(already) === 'accepted' ? 'They’re already an admin.' : 'They’ve already been invited. Resend it below.'
    return
  }
  sending.value = true
  try {
    await m.writeData({ [`invites/${m.newKey()}`]: { created: new Date().toISOString(), payload: { email: value } } }, null)
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
    await m.writeData({ [`invites/${i.id}/created`]: new Date().toISOString(), [`invites/${i.id}/cancelled`]: null, [`invites/${i.id}/accepted`]: null }, null)
    toast(`Sent again to ${i.payload?.email}`)
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  }
}
async function cancel(i: Invite) {
  try {
    await m.writeData({ [`invites/${i.id}/cancelled`]: new Date().toISOString() }, null)
    toast('Invite cancelled', { action: { label: 'Undo', run: () => m.writeData({ [`invites/${i.id}/cancelled`]: null }, null) } })
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  }
}
async function removeInvite(i: Invite) {
  try {
    await m.writeData({ [`invites/${i.id}`]: null }, null)
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  }
}
async function removeAdmin(i: Invite) {
  const self = i.acceptedBy === auth.uid
  const ok = await confirm({
    title: self ? 'Remove yourself?' : `Remove ${i.payload?.email ?? 'this admin'}?`,
    message: self
      ? 'You’ll no longer be able to manage this competition, unless someone invites you again.'
      : 'They’ll no longer be able to manage this competition. You can invite them again later.',
    confirmLabel: 'Remove',
    destructive: true,
  })
  if (!ok) return
  try {
    await m.writeData({ [`invites/${i.id}`]: null }, null)
    toast(`Removed ${i.payload?.email ?? 'admin'}`)
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  }
}

// For when the email doesn't arrive: the same link, to send another way.
// The apps aren't on the web, so theirs is the emailed (#/) form.
async function copyLink(i: Invite) {
  const path = `/competitions/${m.competitionId.value}/invites/${i.id}`
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
  <div class="max-w-2xl space-y-8 p-4 pb-[calc(3rem+var(--safe-bottom))]">
    <SectionHeader
      title="Admins"
      :count="others.length + admins.length || null"
      description="People who can change this competition: its details, dancers, schedule and results."
    />

    <form class="bg-card space-y-3 rounded-2xl border p-4 shadow-sm" novalidate @submit.prevent="invite">
      <label for="invite-email" class="block text-base font-bold">Invite someone</label>
      <div class="flex flex-col gap-2 sm:flex-row">
        <input
          id="invite-email"
          v-model="email"
          type="email"
          inputmode="email"
          autocomplete="off"
          placeholder="name@example.com"
          :aria-invalid="!!emailError || undefined"
          :class="['bg-card h-12 min-w-0 flex-1 rounded-xl border-2 px-3 text-base outline-none', emailError ? 'border-destructive' : 'border-strong focus:border-primary']"
        />
        <button type="submit" :disabled="!canEdit || sending" class="bg-primary text-primary-foreground flex h-12 items-center justify-center gap-1.5 rounded-xl px-5 text-base font-bold disabled:opacity-50">
          <MailPlus class="size-5" /> Send invite
        </button>
      </div>
      <p v-if="emailError" class="text-destructive text-sm font-semibold" role="alert">{{ emailError }}</p>
      <p v-else class="text-muted-foreground text-sm">They’ll get an email with a link. Once they accept (signed in with any account), they can manage it too.</p>
    </form>

    <section class="space-y-3">
      <h2 class="text-heading">Admins</h2>
      <ul v-if="others.length || admins.length" class="bg-card divide-y rounded-2xl border shadow-sm">
        <li v-for="o in others" :key="o.uid" class="flex min-h-15 items-center gap-3 px-4 py-2">
          <ShieldCheck class="text-primary size-5 shrink-0" />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-base font-semibold">
              {{ o.email ?? (o.uid === auth.uid ? 'You' : 'Another organiser') }}<span v-if="o.email && o.uid === auth.uid" class="text-muted-foreground font-normal"> (you)</span>
            </span>
            <span class="text-muted-foreground block text-sm">{{ o.detail }}</span>
          </span>
        </li>
        <li v-for="i in admins" :key="i.id" class="flex min-h-15 items-center gap-3 px-4 py-2">
          <ShieldCheck class="text-primary size-5 shrink-0" />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-base font-semibold">
              {{ i.payload?.email ?? 'Unknown' }}<span v-if="i.acceptedBy === auth.uid" class="text-muted-foreground font-normal"> (you)</span>
            </span>
            <span class="text-muted-foreground block text-sm">Accepted {{ when(i.accepted) }}</span>
          </span>
          <button type="button" :disabled="!canEdit" class="text-destructive hover:bg-destructive/10 h-10 rounded-xl px-3 text-sm font-bold disabled:opacity-50" @click="removeAdmin(i)">
            Remove
          </button>
        </li>
      </ul>
      <EmptyState v-else :icon="ShieldCheck" title="No admins yet" description="Invite someone above to help manage it." />
      <p v-if="me.isAdmin" class="text-muted-foreground text-sm">System admins can always manage every competition.</p>
    </section>

    <section v-if="pending.length" class="space-y-3">
      <h2 class="text-heading">Invites</h2>
      <ul class="bg-card divide-y rounded-2xl border shadow-sm">
        <li v-for="i in pending" :key="i.id" class="flex flex-wrap items-center gap-2 px-4 py-3">
          <span class="min-w-0 flex-1">
            <span class="block truncate text-base font-semibold">{{ i.payload?.email ?? 'Unknown' }}</span>
            <span v-if="status(i) === 'pending' && i.emailFailed" class="text-destructive block text-sm font-semibold">
              The email didn’t go out. Copy the link and send it yourself.
            </span>
            <span v-else class="text-muted-foreground block text-sm">
              {{ status(i) === 'cancelled' ? `Cancelled ${when(i.cancelled)}` : status(i) === 'expired' ? 'Expired' : status(i) === 'accepting' ? 'Accepting…' : `Sent ${when(i.created)}` }}
            </span>
          </span>
          <span class="flex flex-wrap gap-1">
            <button v-if="status(i) === 'pending'" type="button" class="hover:bg-accent h-10 rounded-xl border px-3 text-sm font-bold" @click="copyLink(i)">
              Copy link
            </button>
            <button type="button" :disabled="!canEdit" class="hover:bg-accent h-10 rounded-xl border px-3 text-sm font-bold disabled:opacity-50" @click="resend(i)">
              {{ status(i) === 'pending' ? 'Resend' : 'Send again' }}
            </button>
            <button v-if="status(i) === 'pending'" type="button" :disabled="!canEdit" class="hover:bg-accent h-10 rounded-xl px-3 text-sm font-bold disabled:opacity-50" @click="cancel(i)">
              Cancel
            </button>
            <button v-else type="button" :disabled="!canEdit" class="text-destructive hover:bg-destructive/10 h-10 rounded-xl px-3 text-sm font-bold disabled:opacity-50" @click="removeInvite(i)">
              Delete
            </button>
          </span>
        </li>
      </ul>
    </section>
  </div>
</template>
