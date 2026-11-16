<script setup lang="ts">
// Parity: also inspect mismith/scotdance-entries/src/views/DancerEditor.vue when changing behavior. See ./AGENTS.md.
import { computed, nextTick, ref, watch } from 'vue'
import { Trash2, ChevronDown } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import Dialog from '@/components/Dialog.vue'
import DancerDefaults from './DancerDefaults.vue'
import PublicDancerLink from './PublicDancerLink.vue'
import BirthdayField from './BirthdayField.vue'
import { tidy, tidyStudio } from './profileFields'
import { tidyRegistration, registrationCategory, registrationProblem } from './registration'
import { useConnectAccount, type Dancer } from './account'
const props = defineProps<{ dancer?: Dancer }>()
const emit = defineEmits<{ close: [] }>()
const store = useConnectAccount()
const draft = ref<Dancer>(props.dancer ? JSON.parse(JSON.stringify(props.dancer)) : {
  id: crypto.randomUUID(), revision: 0, firstName: '', lastName: '', birthday: '', category: '',
  studio: store.defaults.studio, registrationNumber: '', location: JSON.parse(JSON.stringify(store.defaults.location ?? { town: '', province: '', country: 'Canada' })),
})
const title = computed(() => props.dancer ? 'Edit dancer' : 'Add dancer')
const deleting = ref(false)
const confirmDefaults = ref(false)
const categoryMode = ref(!draft.value.registrationNumber && !!draft.value.category)
const manualCardCategory = ref(!!draft.value.registrationNumber && !registrationCategory(draft.value.registrationNumber))
const categories = ['Primary', 'Beginner', 'Novice', 'Intermediate', 'Premier']
function toggleCategory() { manualCardCategory.value = false; categoryMode.value = !categoryMode.value; if (categoryMode.value) { draft.value.registrationNumber = ''; numberIssue.value = '' } }
const form = ref<HTMLFormElement>()
const publicLink = ref<InstanceType<typeof PublicDancerLink>>()
const preparing = ref(false)
const field = 'field mt-1.5 h-12 w-full rounded-xl px-3 text-base'
const normalized = (value = '') => value.trim().replace(/\s+/g, ' ').toLowerCase()
const locationKey = (p?: Dancer['location']) => [p?.town, p?.province, p?.country].map(normalized).join('|')
const initial = { studio: normalized(draft.value.studio), location: locationKey(draft.value.location) }
const changedDefaults = computed(() => ({
  studio: !!draft.value.studio && normalized(draft.value.studio) !== initial.studio && normalized(draft.value.studio) !== normalized(store.defaults.studio),
  location: !!draft.value.location?.town && locationKey(draft.value.location) !== initial.location && locationKey(draft.value.location) !== locationKey(store.defaults.location),
}))
const numberIssue = ref('')
watch(() => draft.value.registrationNumber, number => {
  const category = registrationCategory(number)
  if (category) draft.value.category = category
}, { immediate: true })
function settleNumber() {
  manualCardCategory.value = !!draft.value.registrationNumber && !registrationCategory(draft.value.registrationNumber)
  draft.value.registrationNumber = tidyRegistration(draft.value.registrationNumber)
  numberIssue.value = draft.value.registrationNumber ? registrationProblem(draft.value.registrationNumber, draft.value.category) : ''
}
function close() { if (!store.busy && !preparing.value) { store.error = ''; emit('close') } }
async function save() {
  if (preparing.value || store.busy) return
  if (!form.value?.reportValidity()) return
  draft.value.firstName = tidy(draft.value.firstName)
  draft.value.lastName = tidy(draft.value.lastName)
  draft.value.studio = tidyStudio(draft.value.studio)
  settleNumber()
  if (numberIssue.value) return
  preparing.value = true
  try { await nextTick(); await publicLink.value?.finishMatching() } finally { preparing.value = false }
  if (store.dancers.some(d => d.id !== props.dancer?.id) && (changedDefaults.value.studio || changedDefaults.value.location)) { confirmDefaults.value = true; return }
  await persist()
}
async function persist(updateDefaults = false, remove = false) {
  if (await store.save(draft.value, remove, updateDefaults ? changedDefaults.value : {})) emit('close')
}
</script>
<template>
  <Dialog :open="true" :morph="false" variant="sheet" size="lg" :closable="!store.busy && !preparing" @close="close">
    <template #header><h2 class="text-title">{{ deleting ? 'Delete dancer?' : confirmDefaults ? 'Use these details for new dancers?' : title }}</h2></template>
    <template #header-actions>
      <button v-if="props.dancer && !deleting && !confirmDefaults" type="button" class="press-row relative flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-destructive after:absolute after:-inset-1" aria-label="Delete dancer" :disabled="store.busy || preparing" @click="deleting = true"><Trash2 class="size-4" aria-hidden="true" /></button>
    </template>
    <div class="p-4">
      <div v-if="deleting" class="space-y-4">
        <p>Delete {{ draft.firstName }} {{ draft.lastName }}? Existing competition entries stay unchanged.</p>
        <div class="flex flex-wrap gap-2"><Button variant="destructive" :busy="store.busy" @click="persist(false, true)">Delete dancer</Button><Button :disabled="store.busy || preparing" @click="deleting = false">Keep dancer</Button></div>
      </div>
      <div v-else-if="confirmDefaults" class="space-y-4">
        <p>Also save {{ [changedDefaults.studio && 'studio', changedDefaults.location && 'location'].filter(Boolean).join(' and ') }} as your account defaults? Your other dancers keep their own details.</p>
        <div class="flex flex-wrap gap-2"><Button variant="primary" :busy="store.busy" @click="persist(false)">Just this dancer</Button><Button :disabled="store.busy || preparing" @click="persist(true)">Update defaults too</Button><Button variant="plain" :disabled="store.busy || preparing" @click="confirmDefaults = false">Back</Button></div>
      </div>
      <form v-else ref="form" class="space-y-5" @submit.prevent="save">
        <fieldset :disabled="store.busy || preparing" class="grid min-w-0 grid-cols-2 gap-4">
          <label class="text-callout font-medium">First name<input v-model="draft.firstName" :class="field" required maxlength="120" name="given-name" autocomplete="section-dancer given-name" @blur="draft.firstName = tidy(draft.firstName)" /></label>
          <label class="text-callout font-medium">Last name<input v-model="draft.lastName" :class="field" required maxlength="120" name="family-name" autocomplete="section-dancer family-name" @blur="draft.lastName = tidy(draft.lastName)" /></label>
          <BirthdayField v-model="draft.birthday" label="Birthday" class="col-span-2 sm:col-span-1" />
          <div class="col-span-2 min-w-0 sm:col-span-1">
            <div class="flex items-baseline justify-between gap-2">
              <label :for="categoryMode ? 'dancer-category' : 'dancer-registration'" class="text-callout font-medium">{{ categoryMode ? 'Category' : 'Registration number' }}</label>
              <button type="button" class="shrink-0 text-xs text-primary" @click="toggleCategory">{{ categoryMode ? 'Use registration number' : 'Don’t have one?' }}</button>
            </div>
            <input v-if="!categoryMode" id="dancer-registration" v-model="draft.registrationNumber" :class="field" maxlength="120" autocomplete="off" @blur="settleNumber" />
            <label v-if="!categoryMode && manualCardCategory" for="dancer-category" class="mt-2 block text-callout font-medium">Category</label>
            <div v-if="categoryMode || manualCardCategory" class="relative mt-1.5">
              <select id="dancer-category" aria-label="Category" v-model="draft.category" class="field h-12 w-full appearance-none rounded-xl pl-3 pr-10 text-base"><option value="">Choose…</option><option v-for="category in categories" :key="category">{{ category }}</option></select>
              <ChevronDown class="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            </div>
            <span v-if="numberIssue" role="alert" class="mt-1 block text-sm text-destructive">{{ numberIssue }}</span>
          </div>
          <DancerDefaults v-model:studio="draft.studio" :location="draft.location || { town: '', province: '', country: 'Canada' }" @update:location="draft.location = $event" :defaults="store.defaults" class="col-span-2" />
          <PublicDancerLink ref="publicLink" v-model="draft.publicDancer" :first-name="draft.firstName" :last-name="draft.lastName" class="col-span-2" />
        </fieldset>
        <div class="flex justify-end">
          <Button type="submit" variant="primary" :busy="store.busy || preparing">Save</Button>
        </div>
      </form>
      <p v-if="store.error" role="alert" class="mt-4 text-destructive">{{ store.error }}</p>
    </div>
  </Dialog>
</template>
