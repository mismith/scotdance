<script setup lang="ts">
import { computed, ref } from 'vue'
import { MailPlus, ShieldCheck } from '@lucide/vue'
import { useManagedCompetition, type RawInvite, type WithId } from '@/composables/admin/useManagedCompetition'
import { confirm, toast } from '@/lib/admin/feedback'
import { canEdit, friendlyError } from '@/lib/admin/write'
import { formatRelative } from '@/lib/format'
import { useMeStore } from '@/stores/me'

// Who can manage this competition. Invites are emailed by the server; the
// person accepts from the link and gets access. Removing someone deletes
// their invite, which takes the access away again.

const m = useManagedCompetition()
const me = useMeStore()

const now = () => Date.now()
const past = (iso?: string) => !!iso && new Date(iso).getTime() <= now()
type Invite = WithId<RawInvite>
const status = (i: Invite) => (past(i.accepted) ? 'accepted' : past(i.cancelled) ? 'cancelled' : past(i.expires) ? 'expired' : 'pending')

const admins = computed(() => m.invites.value.filter((i) => status(i) === 'accepted'))
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
    await m.writeData({ [`invites/${i.id}/created`]: new Date().toISOString(), [`invites/${i.id}/cancelled`]: null }, null)
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
  const ok = await confirm({
    title: `Remove ${i.payload?.email ?? 'this admin'}?`,
    message: 'They’ll no longer be able to manage this competition. You can invite them again later.',
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

const when = (iso?: string) => (iso ? formatRelative(iso) : '')
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-8 p-4 pb-[calc(3rem+var(--safe-bottom))] md:p-8">
    <header class="space-y-1">
      <h1 class="text-display">Admins</h1>
      <p class="text-muted-foreground text-base">People who can change this competition: its details, dancers, schedule and results.</p>
    </header>

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
      <ul v-if="admins.length" class="bg-card divide-y rounded-2xl border shadow-sm">
        <li v-for="i in admins" :key="i.id" class="flex min-h-15 items-center gap-3 px-4 py-2">
          <ShieldCheck class="text-primary size-5 shrink-0" />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-base font-semibold">{{ i.payload?.email ?? 'Unknown' }}</span>
            <span class="text-muted-foreground block text-sm">Accepted {{ when(i.accepted) }}</span>
          </span>
          <button type="button" :disabled="!canEdit" class="text-destructive hover:bg-destructive/10 h-10 rounded-xl px-3 text-sm font-bold disabled:opacity-50" @click="removeAdmin(i)">
            Remove
          </button>
        </li>
      </ul>
      <p v-else class="text-muted-foreground text-base">
        Nobody else yet.{{ me.isAdmin ? ' System admins can always manage every competition.' : '' }}
      </p>
    </section>

    <section v-if="pending.length" class="space-y-3">
      <h2 class="text-heading">Invites</h2>
      <ul class="bg-card divide-y rounded-2xl border shadow-sm">
        <li v-for="i in pending" :key="i.id" class="flex flex-wrap items-center gap-2 px-4 py-3">
          <span class="min-w-0 flex-1">
            <span class="block truncate text-base font-semibold">{{ i.payload?.email ?? 'Unknown' }}</span>
            <span class="text-muted-foreground block text-sm">
              {{ status(i) === 'cancelled' ? `Cancelled ${when(i.cancelled)}` : status(i) === 'expired' ? 'Expired' : `Sent ${when(i.created)}` }}
            </span>
          </span>
          <span class="flex gap-1">
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
