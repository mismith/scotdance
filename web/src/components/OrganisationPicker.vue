<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Check, Plus } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import Dialog from '@/components/Dialog.vue'
import OrganisationMark from '@/components/OrganisationMark.vue'
import SearchField from '@/components/admin/SearchField.vue'
import { useOrganisations } from '@/composables/useOrganisations'
import type { Morph } from '@/lib/morph'
import type { OrganisationListItem } from '@/types/organisation'

// Choose an organisation, or start a new one, in a sheet. Yours come first;
// the rest (where you may pick any) as you type. A name with no match offers
// itself as a new organisation, with a short name if it has one.

const props = withDefaults(
  defineProps<{
    morph: Morph
    title?: string
    /** Organisations you're an admin of, listed first. */
    mine?: string[]
    /** Their heading. */
    mineLabel?: string
    /** Already chosen: ticked, and choosing one again does nothing. */
    chosen?: string[]
    /** Every organisation can be chosen, not only yours. */
    any?: boolean
    /** Offer to start a new one. */
    creatable?: boolean
    /** Under the new organisation's fields, e.g. "You'll be its admin." */
    createHint?: string
  }>(),
  { title: 'Add an organisation', mine: () => [], mineLabel: 'Yours', chosen: () => [], any: false, creatable: true, createHint: 'You’ll be its admin, and can add its logo and details.' },
)
const emit = defineEmits<{
  pick: [organisation: OrganisationListItem]
  create: [organisation: { name: string; shortName: string }]
}>()

const o = useOrganisations()
const query = ref('')
const q = computed(() => query.value.trim().toLowerCase())
const matches = (org: OrganisationListItem) =>
  !q.value || [org.name, org.shortName, org.location].some((s) => (s ?? '').toLowerCase().includes(q.value))

const yours = computed(() => o.organisations.value.filter((org) => props.mine.includes(org.id) && matches(org)))
const others = computed(() =>
  props.any && q.value ? o.organisations.value.filter((org) => !props.mine.includes(org.id) && matches(org)).slice(0, 30) : [],
)
const exact = computed(() => o.organisations.value.some((org) => [org.name, org.shortName].some((s) => s?.trim().toLowerCase() === q.value)))

// --- Starting one
const creating = ref(false)
const newName = ref('')
const newShort = ref('')
const nameEl = ref<HTMLInputElement | null>(null)
async function startCreate() {
  creating.value = true
  newName.value = query.value.trim()
  await nextTick()
  nameEl.value?.focus()
}
function create() {
  const name = newName.value.trim()
  if (!name) return
  emit('create', { name, shortName: newShort.value.trim() })
  void props.morph.hide()
}
function pick(org: OrganisationListItem) {
  if (!props.chosen.includes(org.id)) emit('pick', org)
  void props.morph.hide()
}
watch(
  () => props.morph.open,
  (open) => {
    if (!open) return
    query.value = ''
    creating.value = false
    newName.value = ''
    newShort.value = ''
  },
)
const ROW = 'press-row focus-inset flex min-h-15 w-full items-center gap-3 px-4 py-2 text-left'
</script>

<template>
  <Dialog :open="morph.open" :morph="morph" variant="sheet" size="md" @close="morph.hide()">
    <template #header>
      <h2 class="text-title">{{ creating ? 'New organisation' : title }}</h2>
      <p v-if="!creating" class="text-muted-foreground text-sm">An association, games society or series it’s run by or part of.</p>
    </template>

    <form v-if="creating" class="space-y-4 p-4 pb-[calc(1rem+var(--safe-bottom))]" novalidate @submit.prevent="create">
      <label class="block space-y-1.5">
        <span class="text-callout block font-medium">Name <span class="text-muted-foreground font-normal">(required)</span></span>
        <input ref="nameEl" v-model="newName" type="text" autocomplete="organization" placeholder="e.g. Foothills Highland Dancing Association" class="field h-12 w-full rounded-xl px-3 text-base" />
      </label>
      <label class="block space-y-1.5">
        <span class="text-callout block font-medium">Short name</span>
        <input v-model="newShort" type="text" autocomplete="off" placeholder="e.g. FHDA" class="field h-12 w-full rounded-xl px-3 text-base" />
        <span class="text-muted-foreground block text-sm">What people call it, if it’s shorter. Optional.</span>
      </label>
      <p class="text-muted-foreground text-sm">{{ createHint }}</p>
      <div class="flex gap-3">
        <Button size="lg" @click="creating = false">Back</Button>
        <Button type="submit" variant="primary" size="lg" class="flex-1" :disabled="!newName.trim()">Add</Button>
      </div>
    </form>

    <template v-else>
      <div class="p-4 pt-1">
        <SearchField v-model="query" :label="any ? 'Find an organisation' : 'Find one of yours'" />
      </div>
      <div class="pb-[calc(0.5rem+var(--safe-bottom))]">
        <section v-if="yours.length" :aria-label="mineLabel">
          <h3 class="text-muted-foreground px-4 pb-1 text-footnote font-semibold">{{ mineLabel }}</h3>
          <ul class="divide-y">
            <li v-for="org in yours" :key="org.id">
              <button type="button" :class="ROW" @click="pick(org)">
                <OrganisationMark :organisation="org" />
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-base font-semibold">{{ org.name }}</span>
                  <span v-if="org.shortName || org.location" class="text-muted-foreground block truncate text-sm">{{ [org.shortName, org.location].filter(Boolean).join(' · ') }}</span>
                </span>
                <Check v-if="chosen.includes(org.id)" class="text-primary size-5 shrink-0" aria-label="Added" />
              </button>
            </li>
          </ul>
        </section>
        <section v-if="others.length" aria-label="On ScotDance.app" class="pt-2">
          <h3 class="text-muted-foreground px-4 pb-1 text-footnote font-semibold">On ScotDance.app</h3>
          <ul class="divide-y">
            <li v-for="org in others" :key="org.id">
              <button type="button" :class="ROW" @click="pick(org)">
                <OrganisationMark :organisation="org" />
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-base font-semibold">{{ org.name }}</span>
                  <span v-if="org.shortName || org.location" class="text-muted-foreground block truncate text-sm">{{ [org.shortName, org.location].filter(Boolean).join(' · ') }}</span>
                </span>
                <Check v-if="chosen.includes(org.id)" class="text-primary size-5 shrink-0" aria-label="Added" />
              </button>
            </li>
          </ul>
        </section>
        <p v-if="!yours.length && !others.length && !(creatable && q)" class="text-muted-foreground px-4 py-3 text-sm">
          {{ q ? `Nothing matches “${query.trim()}”.` : any ? 'Type a name to find one.' : 'You’re not an admin of any organisation yet.' }}
        </p>
        <button v-if="creatable && (q || !yours.length) && !exact" type="button" :class="[ROW, 'text-primary']" @click="startCreate">
          <span class="bg-blue-paper flex size-10 shrink-0 items-center justify-center rounded-xl"><Plus class="size-5" /></span>
          <span class="line-clamp-2 min-w-0 flex-1 text-base font-semibold">{{ q ? `New organisation: “${query.trim()}”` : 'New organisation' }}</span>
        </button>
      </div>
    </template>
  </Dialog>
</template>
