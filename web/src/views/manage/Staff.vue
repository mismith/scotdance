<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ChevronRight, Link2, Lock } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import CollectionEditor from '@/components/admin/CollectionEditor.vue'
import SharedSheet from '@/components/admin/SharedSheet.vue'
import { provideSharedSheet } from '@/composables/admin/useSharedParts'
import { changeLink, previewLink } from '@/lib/admin/links'
import { confirm, toast } from '@/lib/admin/feedback'
import { canEdit, friendlyError } from '@/lib/admin/write'
import { replacesSentence } from '@/lib/admin/linkWords'
import { useManagedCompetition, type MStaff } from '@/composables/admin/useManagedCompetition'
import type { CollectionSpec } from '@/lib/admin/collection'
import { forEachScheduleDance } from '@/lib/admin/scheduleTree'
import { idList } from '@/lib/schedule'

const m = useManagedCompetition()

const ROLES = ['Judge', 'Piper', 'Volunteer', 'Sponsor']

const spec: CollectionSpec<MStaff> = {
  path: 'staff',
  route: 'manage.staff',
  singular: 'staff member',
  plural: 'staff',
  sortable: true,
  fields: [
    { key: 'type', label: 'Role', kind: 'select', required: true, bulk: true, placeholder: 'Choose a role', options: () => ROLES.map((r) => ({ value: r, label: r })) },
    { key: 'firstName', label: 'First name', kind: 'text', half: true, hint: 'For a sponsor, the organisation’s name.' },
    { key: 'lastName', label: 'Last name', kind: 'text', half: true },
    { key: 'location', label: 'Location', kind: 'text', placeholder: 'e.g. Scotland' },
    { key: 'image', label: 'Photo or logo', kind: 'image', storage: 'staff' },
    { key: 'description', label: 'About', kind: 'textarea', hint: 'A short bio, shown when someone taps their name.' },
    { key: 'website', label: 'Website', kind: 'url', placeholder: 'e.g. example.com' },
  ],
  title: (s) => s.label,
  subtitle: (s) => [s.type ?? 'No role', s.location].filter(Boolean).join(' · '),
  defaults: (prev) => ({ type: prev?.type ?? '' }),
  impact: (ids) => {
    // Take them off any platform they're judging in the schedule.
    const updates: Record<string, unknown> = {}
    forEachScheduleDance(m.schedule.value, (path, item) => {
      for (const [pid, p] of Object.entries(item.platforms ?? {})) {
        const judges = idList(p?.orderedJudgeIds)
        const kept = judges.filter((j) => !ids.includes(j))
        if (kept.length !== judges.length) updates[`${path}/platforms/${pid}/orderedJudgeIds`] = kept.length ? kept : null
      }
    })
    const n = Object.keys(updates).length
    // And off any trophy they sponsor (stored by id), or its sponsor line would show the id.
    const trophies = m.groups.value.filter((g) => g.sponsor && ids.includes(g.sponsor))
    for (const g of trophies) updates[`groups/${g.id}/sponsor`] = null
    const warnings = []
    if (n) warnings.push(`They’re judging in ${n} ${n === 1 ? 'part' : 'parts'} of the schedule and will be taken off.`)
    if (trophies.length) warnings.push(`They sponsor ${trophies.length === 1 ? 'a trophy' : `${trophies.length} trophies`}, which will show no sponsor.`)
    return { updates, warnings }
  },
  searchText: (s) => [s.type, s.location].join(' '),
  emptyHint: 'Add the judges, pipers, volunteers and sponsors to credit them on the competition page.',
}

const items = computed(() => m.staff.value)

// Linked (ADR 0007): staff shared from the main one are changed there, so
// they're locked here (tapping says why); one keeping its own is offered the
// main one's.
const { mainName, isOther: notMain, shared: sharedPart, mainTo } = provideSharedSheet(m.competitionId)
const shared = computed(() => sharedPart('staff'))

const busy = ref(false)
async function useItsStaff() {
  if (busy.value) return
  busy.value = true
  try {
    const id = m.competitionId.value
    const plan = (await previewLink({ action: 'sync', competitionId: id, part: 'staff', on: true })).targets[0]?.parts[0]
    if (plan?.blocked) throw new Error(plan.blocked)
    if (plan?.replaces) {
      const ok = await confirm({
        title: `Use ${mainName.value}’s staff?`,
        message: `${replacesSentence(m.competition.value?.name?.trim() || 'This one', plan, mainName.value)} They stay in step with it from then on.`,
        confirmLabel: 'Use its staff',
      })
      if (!ok || m.competitionId.value !== id) return
    }
    await changeLink({ action: 'sync', competitionId: id, part: 'staff', on: true })
    toast(`Staff: shared from ${mainName.value}`)
  } catch (e) {
    toast(e instanceof Error && !('code' in e) ? e.message : friendlyError(e), { tone: 'error' })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <CollectionEditor :spec="spec" :items="items" :shared="shared ? 'staff' : undefined">
    <template v-if="notMain" #notice>
      <RouterLink
        v-if="shared && mainTo('manage.staff')"
        :to="mainTo('manage.staff')!"
        class="press bg-blue-paper text-primary text-callout m-4 flex min-h-12 items-center gap-2.5 rounded-2xl px-4 font-semibold"
      >
        <Lock class="size-5 shrink-0" aria-hidden="true" />
        <span class="min-w-0 flex-1">Shared from {{ mainName }}</span>
        <ChevronRight class="size-5 shrink-0" aria-hidden="true" />
      </RouterLink>
      <div v-else-if="!shared" role="note" class="bg-blue-paper m-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl p-4">
        <Link2 class="text-primary size-5 shrink-0" aria-hidden="true" />
        <p class="text-callout min-w-0 flex-1 basis-48">Use <span class="font-semibold">{{ mainName }}</span>’s staff, kept in step from then on.</p>
        <Button size="sm" :disabled="!canEdit" :busy="busy" @click="useItsStaff">Use its staff</Button>
      </div>
      <SharedSheet />
    </template>
  </CollectionEditor>
</template>
