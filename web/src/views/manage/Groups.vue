<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ChevronDown, ChevronRight, Shuffle } from '@lucide/vue'
import CollectionEditor from '@/components/admin/CollectionEditor.vue'
import ImportTip from '@/components/admin/ImportTip.vue'
import SwitchField from '@/components/admin/SwitchField.vue'
import { useManagedCompetition, type MGroup } from '@/composables/admin/useManagedCompetition'
import { toast } from '@/lib/admin/feedback'
import { canEdit, friendlyError } from '@/lib/admin/write'
import type { CollectionSpec } from '@/lib/admin/collection'
import { isChampionshipName } from '@/types/competition'
import { planSameDancesAs, planSetDanceGroup, planSetNotChampionship } from '@shared/plans/membership'

const m = useManagedCompetition()

const AGE_RANGES = [
  '7 & Under 10 Years',
  '10 & Under 12 Years',
  '12 & Under 14 Years',
  '14 & Under 16 Years',
  '16 & Under 18 Years',
  '18 & Under 21 Years',
  '21 Years & Over',
]

const spec: CollectionSpec<MGroup> = {
  path: 'groups',
  route: 'manage.groups',
  singular: 'age group',
  plural: 'age groups',
  sortable: true,
  fields: [
    {
      key: 'categoryId',
      label: 'Category',
      kind: 'select',
      required: true,
      half: true,
      bulk: true,
      placeholder: 'Choose a category',
      options: () => m.categories.value.map((c) => ({ value: c.id, label: c.label })),
      hint: m.categories.value.length ? undefined : 'Add categories first, under Categories.',
    },
    {
      key: 'name',
      label: 'Age range',
      kind: 'text',
      half: true,
      placeholder: 'e.g. 12 & Under 14 Years',
      hint: 'Leave empty when the category is one group, like Primary.',
    },
    { key: 'trophy', label: 'Trophy', kind: 'text', half: true, placeholder: 'e.g. Adeline Duncan Memorial' },
    {
      key: 'sponsor',
      label: 'Trophy sponsor',
      kind: 'select',
      half: true,
      placeholder: 'None',
      // A sponsor from Staff (stored by id, so the
      // results page can show their details). Older competitions typed a name
      // instead; those names stay choosable as they are.
      options: () => {
        const ids = new Set(m.staff.value.map((s) => s.id))
        const typed = [...new Set(m.groups.value.map((g) => g.sponsor?.trim()).filter((s): s is string => !!s && !ids.has(s)))]
        return [
          ...m.sponsors.value.map((s) => ({ value: s.id, label: s.label, group: typed.length ? 'Sponsors' : undefined })),
          ...typed.map((name) => ({ value: name, label: name, group: 'Typed names' })),
        ]
      },
      hint: m.sponsors.value.length ? undefined : 'Add sponsors under Staff first.',
    },
  ],
  title: (g) => g.label,
  subtitle: (g) => {
    const entries = m.groupDancers(g.id)
    const dances = m.groupDances(g.id).length
    // Any duet, trio or group: count entries, as its dancers are more.
    const n = entries.length
    const who = entries.some((d) => d.team) ? `${n} ${n === 1 ? 'entry' : 'entries'}` : `${n} ${n === 1 ? 'dancer' : 'dancers'}`
    return `${who} · ${dances} ${dances === 1 ? 'dance' : 'dances'}`
  },
  defaults: (prev) => ({ categoryId: prev?.categoryId ?? '' }),
  presets: AGE_RANGES.map((name) => ({ label: name, values: { name } })),
  presetsScope: 'categoryId',
  importFirst: true,
  emptyHint: 'Add the age groups dancing at this competition, or import them with your dancers.',
}

// --- Dances this group does
const copyFrom = ref('')
async function setDance(groupId: string, danceId: string, on: boolean) {
  const { data, summary } = planSetDanceGroup(m.state.value, danceId, groupId, on)
  await m.writeData(data, summary)
}
async function sameAs(groupId: string) {
  const source = copyFrom.value
  copyFrom.value = ''
  if (!source) return
  const same = planSameDancesAs(m.state.value, groupId, source)
  if (!same) return toast('Already the same dances')
  const message = same.summary
  try {
    const change = await m.writeData(same.data, message)
    toast(message, { action: { label: 'Undo', run: () => m.undoChange(change) } })
  } catch (e) {
    toast(friendlyError(e), { tone: 'error' })
  }
}

function setNotChampionship(groupId: string, on: boolean) {
  const { data, summary } = planSetNotChampionship(m.state.value, groupId, on)
  return m.writeData(data, summary)
}

const drawSummary = (groupId: string) => {
  const dances = m.groupDances(groupId)
  const drawn = dances.filter((d) => (m.draws.value[groupId]?.[d.id]?.length ?? 0) > 0).length
  if (!dances.length) return 'Choose this group’s dances first.'
  if (!drawn) return 'No draws yet. Optional: the order dancers go up in each dance.'
  return `Set for ${drawn} of ${dances.length} ${dances.length === 1 ? 'dance' : 'dances'}.`
}

const items = computed(() => m.groups.value)
</script>

<template>
  <CollectionEditor :spec="spec" :items="items">
    <template #list-intro><ImportTip /></template>
    <template #detail-extra="{ item }">
      <!-- Also in Results entry, where organisers are on the day. -->
      <SwitchField
        v-if="isChampionshipName(item.category?.name, item.name)"
        :model-value="!!item.notChampionship"
        label="Not run as a championship"
        description="Too few dancers turned up for a championship, so it ran as a regular competition. Its results say so."
        :save="(on) => setNotChampionship(item.id, on)"
      />
      <section class="space-y-3">
        <div class="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 class="text-heading">Dances</h3>
            <p class="text-muted-foreground text-sm">What this age group dances. Results and the schedule use this.</p>
          </div>
          <label v-if="m.groups.value.length > 1" class="flex items-center gap-2 text-sm font-medium">
            <span class="sr-only">Same dances as another age group</span>
            <span class="relative">
              <select
                v-model="copyFrom"
                :disabled="!canEdit"
                class="field text-callout h-11 max-w-56 appearance-none rounded-xl pr-9 pl-3"
                @change="sameAs(item.id)"
              >
                <option value="">Same dances as…</option>
                <option v-for="g in m.groups.value.filter((g) => g.id !== item.id)" :key="g.id" :value="g.id">{{ g.label }}</option>
              </select>
              <ChevronDown class="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2" />
            </span>
          </label>
        </div>
        <ul v-if="m.dances.value.length" class="rows-engraved">
          <li v-for="d in m.dances.value" :key="d.id" class="py-1">
            <SwitchField :model-value="!!d.groupIds?.[item.id]" :label="d.label" :save="(on) => setDance(item.id, d.id, on)" />
          </li>
        </ul>
        <p v-else class="text-muted-foreground text-base">
          No dances yet.
          <RouterLink :to="{ name: 'manage.dances', params: { competitionId: m.competitionId.value } }" class="text-primary font-semibold">Add dances</RouterLink>
        </p>
      </section>

      <section class="space-y-3">
        <h3 class="text-heading">Draws</h3>
        <RouterLink
          :to="{ name: 'manage.groups.draws', params: { competitionId: m.competitionId.value, itemId: item.id } }"
          class="press-row focus-inset -mx-4 flex min-h-16 items-center gap-3 py-3 pr-3 pl-4"
        >
          <Shuffle class="text-primary size-6 shrink-0" stroke-width="1.75" aria-hidden="true" />
          <span class="min-w-0 flex-1">
            <span class="block text-base font-semibold">Dancing order</span>
            <span class="text-muted-foreground block text-sm">{{ drawSummary(item.id) }}</span>
          </span>
          <ChevronRight class="text-muted-foreground size-5" />
        </RouterLink>
      </section>
    </template>
  </CollectionEditor>
</template>
