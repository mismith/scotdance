<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { ChevronLeft } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import DancerDetails from './DancerDetails.vue'
import { useConnectAccount, type Dancer } from './account'
const store = useConnectAccount()
const route = useRoute()
const router = useRouter()
const existing = store.dancers.find(d => d.id === route.params.id)
const missing = !!route.params.id && !existing
const draft = ref<Dancer>(existing ? JSON.parse(JSON.stringify(existing)) : {
  id: crypto.randomUUID(), revision: 0, firstName: '', lastName: '', birthday: '', category: '', studio: '', registrationNumber: '',
})
draft.value.location ??= { town: '', province: '', country: '' }
const title = computed(() => existing ? 'Edit dancer' : 'Add dancer')
const deleting = ref(false)
const details = ref<InstanceType<typeof DancerDetails>>()
const field = 'field mt-1.5 h-12 w-full rounded-xl px-3 text-base'
async function save(remove = false) {
  if (!remove) details.value?.commitPending()
  if (await store.save(draft.value, remove)) await router.push('/dancers')
}
</script>
<template>
  <section>
    <RouterLink to="/dancers" class="press-row -ml-2 mb-3 inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-callout font-semibold text-primary"><ChevronLeft class="size-4" aria-hidden="true" />Dancers</RouterLink>
    <h1 class="mb-6 text-hero">{{ missing ? 'Dancer not found' : title }}</h1>
    <p v-if="missing" class="text-muted-foreground">This dancer may have been deleted.</p>
    <form v-else class="space-y-6" @submit.prevent="save()">
      <p class="text-muted-foreground">Only their name is required for now. Changes also update this dancer in Entries.</p>
      <fieldset :disabled="store.busy" class="grid min-w-0 grid-cols-1 gap-5 sm:grid-cols-2">
        <label class="text-callout font-medium">First name<input v-model="draft.firstName" :class="field" required maxlength="120" autocomplete="off" /></label>
        <label class="text-callout font-medium">Last name<input v-model="draft.lastName" :class="field" required maxlength="120" autocomplete="off" /></label>
        <label class="text-callout font-medium">Birthday <span class="text-muted-foreground">(optional)</span><input v-model="draft.birthday" :class="field" type="date" min="1900-01-01" :max="new Date().toISOString().slice(0, 10)" /></label>
        <label class="text-callout font-medium">Registration number <span class="text-muted-foreground">(optional)</span><input v-model="draft.registrationNumber" :class="field" maxlength="120" /></label>
        <DancerDetails ref="details" v-model="draft" class="sm:col-span-2" />
      </fieldset>
      <div v-if="!deleting" class="flex flex-wrap items-center gap-2">
        <Button type="submit" variant="primary" :busy="store.busy">Save dancer</Button>
        <Button to="/dancers" variant="plain" :disabled="store.busy">Cancel</Button>
        <Button v-if="existing" variant="plain" class="sm:ml-auto" :disabled="store.busy" @click="deleting = true">Delete dancer</Button>
      </div>
      <div v-else role="alert" class="space-y-3">
        <p>Delete this dancer? Existing competition entries will stay unchanged.</p>
        <div class="flex flex-wrap gap-2">
          <Button variant="destructive" :busy="store.busy" @click="save(true)">Delete dancer</Button>
          <Button :disabled="store.busy" @click="deleting = false">Keep dancer</Button>
        </div>
      </div>
    </form>
  </section>
</template>
