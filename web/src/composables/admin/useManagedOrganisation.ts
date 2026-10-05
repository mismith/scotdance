import { computed, ref, watch, type Ref } from 'vue'
import { onValue } from 'firebase/database'
import { dataRef } from '@/firebase'
import { newKey, write } from '@/lib/admin/write'
import type { RawInvite, WithId } from '@/composables/admin/useManagedCompetition'
import type { Organisation } from '@/types/organisation'

// Live, editable view of one organisation for its Manage page: its record,
// its admins' invites, and who has access. Writes go through `write`, so
// they need a connection, like every Manage change.

export function useManagedOrganisation(organisationId: Ref<string>) {
  const organisation = ref<Organisation | null>(null)
  const loaded = ref(false)
  const invitesRaw = ref<Record<string, RawInvite>>({})
  const holders = ref<string[]>([])

  watch(
    organisationId,
    (id, _, onCleanup) => {
      organisation.value = null
      loaded.value = false
      invitesRaw.value = {}
      holders.value = []
      if (!id) return
      const offs = [
        onValue(
          dataRef(`organisations/${id}`),
          (snap) => {
            organisation.value = (snap.val() as Organisation | null) ?? null
            loaded.value = true
          },
          () => (loaded.value = true),
        ),
        onValue(dataRef(`organisations:data/${id}/invites`), (snap) => (invitesRaw.value = snap.val() ?? {}), () => {}),
        onValue(
          dataRef(`organisations:permissions/${id}/users`),
          (snap) => (holders.value = Object.entries(snap.val() ?? {}).filter(([, on]) => on === true).map(([uid]) => uid)),
          () => {},
        ),
      ]
      onCleanup(() => offs.forEach((off) => off()))
    },
    { immediate: true },
  )

  const invites = computed<Array<WithId<RawInvite>>>(() =>
    Object.entries(invitesRaw.value)
      .filter(([, v]) => v && typeof v === 'object')
      .map(([id, v]) => ({ ...v, id })),
  )

  const prefixed = (root: string, updates: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(updates).map(([k, v]) => [`${root}/${organisationId.value}/${k}`, v]))
  /** Change its page: paths under /organisations/{id}. */
  const writeInfo = (updates: Record<string, unknown>) => write(prefixed('organisations', updates))
  /** Its admins' private data (invites): paths under /organisations:data/{id}. */
  const writeData = (updates: Record<string, unknown>) => write(prefixed('organisations:data', updates))
  /** Add it to a competition (true) or take it off (null). */
  const setCompetition = (competitionId: string, on: boolean) =>
    write({ [`competitions/${competitionId}/organisations/${organisationId.value}`]: on || null })

  return { organisationId, organisation, loaded, invites, holders, writeInfo, writeData, setCompetition, newKey }
}
