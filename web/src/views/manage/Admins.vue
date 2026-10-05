<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { get, onValue } from 'firebase/database'
import AdminsPanel from '@/components/admin/AdminsPanel.vue'
import SectionHeader from '@/components/admin/SectionHeader.vue'
import { useManagedCompetition } from '@/composables/admin/useManagedCompetition'
import { dataRef } from '@/firebase'
import { useAuthStore } from '@/stores/auth'
import { useMeStore } from '@/stores/me'

// Who can manage this competition (see AdminsPanel). Everyone who can
// without an invite is whoever submitted it, or someone a system admin
// added: only system admins can look up who they are.

const m = useManagedCompetition()
const auth = useAuthStore()
const me = useMeStore()

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
  holders.value.map((uid) => ({
    uid,
    email: uid === auth.uid ? me.email : known[uid] || null,
    detail: uid === submittedBy.value ? 'Submitted the competition' : 'Organiser',
  })),
)
const panel = ref<{ count: number } | null>(null)
</script>

<template>
  <div class="max-w-2xl space-y-8 p-4 pb-[calc(3rem+var(--safe-bottom))]">
    <SectionHeader
      title="Admins"
      :count="panel?.count || null"
      description="People who can change this competition: its details, dancers, schedule and results."
    />
    <AdminsPanel
      ref="panel"
      :invites="m.invites.value"
      :holders="others"
      :write-invites="(u) => m.writeData(u, null)"
      :new-key="m.newKey"
      :link-for="(inviteId) => `/competitions/${m.competitionId.value}/invites/${inviteId}`"
      what="this competition"
      unknown-holder="Another organiser"
    >
      <template #note>
        <p v-if="me.isAdmin" class="text-muted-foreground text-sm">System admins can always manage every competition.</p>
      </template>
    </AdminsPanel>
  </div>
</template>
