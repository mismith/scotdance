<script setup lang="ts">
// The single owner-profile editor, used directly here and by the hosted entry.
import { computed, nextTick, ref, useId, watch } from 'vue'
import { Trash2, ChevronDown, Shield } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import Dialog from '@/components/Dialog.vue'
import DancerAccess from './DancerAccess.vue'
import ConnectBrand from './ConnectBrand.vue'
import DancerDefaults from './DancerDefaults.vue'
import DancerPhoto from './DancerPhoto.vue'
import PublicDancerLink from './PublicDancerLink.vue'
import BirthdayField from './BirthdayField.vue'
import { tidy, tidyStudio } from './profileFields'
import {
  tidyRegistration,
  registrationCategory,
  registrationProblem,
} from './registration'
import type { Dancer } from './account'
import type {
  EditorContext,
  EditorWrite,
  EditorResult,
  AccessRequest,
} from './editor/types'
const props = defineProps<
  EditorContext & {
    persist: (request: EditorWrite) => Promise<EditorResult>
    verifyEmail?: () => Promise<void>
    manageAccess?: (request: AccessRequest) => Promise<unknown>
  }
>()
const emit = defineEmits<{ close: []; saved: [result: EditorResult] }>()
const accessBusy = ref(false),
  shared = ref(!!props.dancer?.shared)
const busy = ref(false)
const error = ref('')
const photo = ref(props.photo?.value ?? null)
const photoEditing = ref(false)
const showPhoto = computed(() => !!props.photo && !props.hiddenFields?.includes('photo'))
const showPublicDancer = computed(() => !props.hiddenFields?.includes('publicDancer'))
const opened = ref(true)
let lastWrite = '',
  requestId = ''
const draft = ref<Dancer>(
  props.dancer
    ? JSON.parse(JSON.stringify(props.dancer))
    : {
        id: crypto.randomUUID(),
        revision: 0,
        firstName: '',
        lastName: '',
        birthday: '',
        category: '',
        studio: props.defaults.studio,
        registrationNumber: '',
        location: JSON.parse(
          JSON.stringify(
            props.defaults.location ?? { town: '', province: '', country: 'Canada' },
          ),
        ),
      },
)
const title = computed(() => (props.dancer ? 'Edit dancer' : 'Add dancer'))
const deleting = ref(false)
const confirmDefaults = ref(false)
const categoryMode = ref(!draft.value.registrationNumber && !!draft.value.category)
const manualCardCategory = ref(
  !!draft.value.registrationNumber &&
    !registrationCategory(draft.value.registrationNumber),
)
const categories = ['Primary', 'Beginner', 'Novice', 'Intermediate', 'Premier']
function toggleCategory() {
  manualCardCategory.value = false
  categoryMode.value = !categoryMode.value
  if (categoryMode.value) {
    draft.value.registrationNumber = ''
    numberIssue.value = ''
  }
}
const form = ref<HTMLFormElement>()
const formId = useId()
const publicLink = ref<InstanceType<typeof PublicDancerLink>>()
const preparing = ref(false)
const field = 'field mt-1.5 h-12 w-full rounded-xl px-3 text-base'
const normalized = (value = '') => value.trim().replace(/\s+/g, ' ').toLowerCase()
const locationKey = (p?: Dancer['location']) =>
  [p?.town, p?.province, p?.country].map(normalized).join('|')
const initial = {
  studio: normalized(draft.value.studio),
  location: locationKey(draft.value.location),
}
const changedDefaults = computed(() => ({
  studio:
    !!draft.value.studio &&
    normalized(draft.value.studio) !== initial.studio &&
    normalized(draft.value.studio) !== normalized(props.defaults.studio),
  location:
    !!draft.value.location?.town &&
    locationKey(draft.value.location) !== initial.location &&
    locationKey(draft.value.location) !== locationKey(props.defaults.location),
}))
const numberIssue = ref('')
watch(
  () => draft.value.registrationNumber,
  (number) => {
    const category = registrationCategory(number)
    if (category) draft.value.category = category
  },
  { immediate: true },
)
function settleNumber() {
  manualCardCategory.value =
    !!draft.value.registrationNumber &&
    !registrationCategory(draft.value.registrationNumber)
  draft.value.registrationNumber = tidyRegistration(draft.value.registrationNumber)
  numberIssue.value = draft.value.registrationNumber
    ? registrationProblem(draft.value.registrationNumber, draft.value.category)
    : ''
}
function close() {
  if (!busy.value && !preparing.value && !accessBusy.value) {
    opened.value = false
  }
}
async function save() {
  if (preparing.value || busy.value || photoEditing.value || accessBusy.value) return
  if (!form.value?.reportValidity()) return
  draft.value.firstName = tidy(draft.value.firstName)
  draft.value.lastName = tidy(draft.value.lastName)
  draft.value.studio = tidyStudio(draft.value.studio)
  settleNumber()
  if (numberIssue.value) return
  preparing.value = true
  try {
    await nextTick()
    await publicLink.value?.finishMatching()
  } finally {
    preparing.value = false
  }
  if (
    !shared.value &&
    props.otherDancers &&
    (changedDefaults.value.studio || changedDefaults.value.location)
  ) {
    confirmDefaults.value = true
    return
  }
  await write()
}
async function write(updateDefaults = false, remove = false) {
  if (busy.value) return
  busy.value = true
  error.value = ''
  const dancer = JSON.parse(JSON.stringify(draft.value)) as Dancer
  if (!showPublicDancer.value) delete dancer.publicDancer
  const body = {
    ...(showPhoto.value && photo.value !== props.photo?.value
      ? { photo: photo.value }
      : {}),
    action: remove ? ('delete' as const) : ('save' as const),
    dancer,
    defaults: updateDefaults ? { ...changedDefaults.value } : {},
    defaultsRevision: props.defaultsRevision,
  }
  // A retry of an uncertain network result must reuse the original receipt.
  const fingerprint = JSON.stringify(body)
  if (fingerprint !== lastWrite) {
    lastWrite = fingerprint
    requestId = crypto.randomUUID()
  }
  try {
    const result = await props.persist({ ...body, requestId })
    emit('saved', result)
    opened.value = false
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Could not save. Please try again.'
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <Dialog
    :open="opened"
    :morph="false"
    variant="sheet"
    size="lg"
    :closable="!busy && !preparing && !accessBusy"
    @close="close"
    @closed="emit('close')"
  >
    <template #header
      ><h2 class="flex min-w-0"><ConnectBrand /></h2
    ></template>
    <template #header-actions>
      <button
        v-if="props.dancer && !deleting && !confirmDefaults"
        type="button"
        class="press-row text-muted-foreground hover:text-destructive relative flex size-9 shrink-0 items-center justify-center rounded-full after:absolute after:-inset-1"
        aria-label="Delete dancer"
        :disabled="busy || preparing || accessBusy"
        @click="deleting = true"
      >
        <Trash2 class="size-4" aria-hidden="true" />
      </button>
    </template>
    <div class="p-4">
      <div class="mb-4 flex items-center justify-between gap-2">
        <h3 class="text-heading font-semibold">
          {{
            deleting
              ? 'Delete dancer?'
              : confirmDefaults
                ? 'Use these details for new dancers?'
                : title
          }}
        </h3>
        <DancerAccess
          v-if="props.dancer && props.manageAccess && !deleting && !confirmDefaults"
          :id="props.dancer.id"
          :request="props.manageAccess"
          :verify-email="props.verifyEmail"
          :disabled="busy || preparing"
          @removed="opened = false"
          @changed="shared = $event"
          @busy="accessBusy = $event"
        />
      </div>
      <div v-if="deleting" class="space-y-4">
        <p>
          Delete {{ draft.firstName }} {{ draft.lastName
          }}{{ shared ? ' for all owners' : '' }}? Existing entries and studio records
          stay unchanged.
        </p>
        <div class="flex flex-wrap gap-2">
          <Button variant="destructive" :busy="busy" @click="write(false, true)"
            >Delete dancer</Button
          ><Button :disabled="busy || preparing" @click="deleting = false"
            >Keep dancer</Button
          >
        </div>
      </div>
      <div v-else-if="confirmDefaults" class="space-y-4">
        <p>
          Also save
          {{
            [changedDefaults.studio && 'studio', changedDefaults.location && 'location']
              .filter(Boolean)
              .join(' and ')
          }}
          as your account defaults? Your other dancers keep their own details.
        </p>
        <div class="flex flex-wrap gap-2">
          <Button variant="primary" :busy="busy" @click="write(false)"
            >Just this dancer</Button
          ><Button :disabled="busy || preparing" @click="write(true)"
            >Update defaults too</Button
          ><Button
            variant="plain"
            :disabled="busy || preparing"
            @click="confirmDefaults = false"
            >Back</Button
          >
        </div>
      </div>
      <form v-else :id="formId" ref="form" class="space-y-5" @submit.prevent="save">
        <fieldset :disabled="busy || preparing" class="grid min-w-0 grid-cols-2 gap-4">
          <label class="text-callout font-medium"
            >First name<input
              v-model="draft.firstName"
              :class="field"
              required
              maxlength="120"
              name="given-name"
              autocomplete="section-dancer given-name"
              @blur="draft.firstName = tidy(draft.firstName)"
          /></label>
          <label class="text-callout font-medium"
            >Last name<input
              v-model="draft.lastName"
              :class="field"
              required
              maxlength="120"
              name="family-name"
              autocomplete="section-dancer family-name"
              @blur="draft.lastName = tidy(draft.lastName)"
          /></label>
          <BirthdayField
            v-model="draft.birthday"
            label="Birthday"
            class="col-span-2 sm:col-span-1"
          />
          <div class="col-span-2 min-w-0 sm:col-span-1">
            <div class="flex items-baseline justify-between gap-2">
              <label
                :for="categoryMode ? 'dancer-category' : 'dancer-registration'"
                class="text-callout font-medium"
                >{{ categoryMode ? 'Category' : 'Registration number' }}</label
              >
              <button
                type="button"
                class="text-primary shrink-0 text-xs"
                @click="toggleCategory"
              >
                {{ categoryMode ? 'Use registration number' : 'Don’t have one?' }}
              </button>
            </div>
            <input
              v-if="!categoryMode"
              id="dancer-registration"
              v-model="draft.registrationNumber"
              :class="field"
              maxlength="120"
              autocomplete="off"
              @blur="settleNumber"
            />
            <label
              v-if="!categoryMode && manualCardCategory"
              for="dancer-category"
              class="text-callout mt-2 block font-medium"
              >Category</label
            >
            <div v-if="categoryMode || manualCardCategory" class="relative mt-1.5">
              <select
                id="dancer-category"
                aria-label="Category"
                v-model="draft.category"
                class="field h-12 w-full appearance-none rounded-xl pr-10 pl-3 text-base"
              >
                <option value="">Choose…</option>
                <option v-for="category in categories" :key="category">
                  {{ category }}
                </option>
              </select>
              <ChevronDown
                class="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
                aria-hidden="true"
              />
            </div>
            <span
              v-if="numberIssue"
              role="alert"
              class="text-destructive mt-1 block text-sm"
              >{{ numberIssue }}</span
            >
          </div>
          <DancerDefaults
            v-model:studio="draft.studio"
            :location="draft.location || { town: '', province: '', country: 'Canada' }"
            @update:location="draft.location = $event"
            :defaults="props.defaults"
            class="col-span-2"
          />
          <DancerPhoto
            v-if="showPhoto"
            :class="showPublicDancer ? 'col-span-2 sm:col-span-1' : 'col-span-2'"
            v-model="photo"
            @editing="photoEditing = $event"
          />
          <PublicDancerLink
            v-if="showPublicDancer"
            ref="publicLink"
            v-model="draft.publicDancer"
            :first-name="draft.firstName"
            :last-name="draft.lastName"
            :class="showPhoto ? 'col-span-2 sm:col-span-1' : 'col-span-2'"
          />
        </fieldset>
      </form>
      <p v-if="error" role="alert" class="text-destructive mt-4">{{ error }}</p>
    </div>
    <template v-if="!deleting && !confirmDefaults" #footer>
      <div class="flex items-center justify-between gap-4">
        <p class="text-muted-foreground flex items-center gap-1.5 text-sm">
          <Shield
            class="size-4 shrink-0 text-amber-500 dark:text-amber-400"
            aria-hidden="true"
          />
          <span>Shared only when you consent.</span>
        </p>
        <Button
          class="ml-auto shrink-0"
          type="submit"
          :form="formId"
          variant="primary"
          :busy="busy || preparing"
          :disabled="accessBusy || photoEditing"
          >Save</Button
        >
      </div>
    </template>
  </Dialog>
</template>
