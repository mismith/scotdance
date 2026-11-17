<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { LoaderCircle, Mail, UsersRound } from '@lucide/vue'
import Popover from './Popover.vue'
import Button from '@/components/ui/Button.vue'
import type { AccessRequest, AccessState } from './editor/types'
const props = defineProps<{
  id: string
  disabled?: boolean
  request: (request: AccessRequest) => Promise<unknown>
}>()
const emit = defineEmits<{
  removed: []
  changed: [shared: boolean]
  busy: [value: boolean]
}>()
const open = ref(false)
const inviteForm = ref<HTMLFormElement>()
const content = ref<HTMLElement>()
function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((part) => Array.from(part)[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  )
}
const state = ref<AccessState>(),
  busy = ref(false),
  error = ref(''),
  email = ref('')
const confirm = ref<AccessState['owners'][number]>()
async function askToRemove(person: AccessState['owners'][number]) {
  confirm.value = person
  await nextTick()
  content.value?.querySelector<HTMLButtonElement>('[data-cancel-removal]')?.focus()
}
async function cancelRemoval() {
  const uid = confirm.value?.uid
  confirm.value = undefined
  await nextTick()
  const button = Array.from(
    content.value?.querySelectorAll<HTMLButtonElement>('[data-owner]') || [],
  ).find((button) => button.dataset.owner === uid)
  button?.focus()
}
watch(open, (value) => {
  if (!value) confirm.value = undefined
})
let lastInvite = '',
  requestId = '',
  live = true,
  refreshing = false
let timer: ReturnType<typeof setInterval>
watch(busy, (value) => emit('busy', value))
onBeforeUnmount(() => {
  live = false
  clearInterval(timer)
  window.removeEventListener('focus', refresh)
})
async function perform(work: () => Promise<void>) {
  if (busy.value || !live) return
  busy.value = true
  error.value = ''
  try {
    await work()
  } catch (e) {
    if (live) error.value = e instanceof Error ? e.message : 'Please try again.'
  } finally {
    if (live) busy.value = false
  }
}
async function load() {
  const value = (await props.request({
    action: 'access',
    id: props.id,
    operation: 'list',
  })) as AccessState
  if (live) {
    state.value = value
    emit('changed', value.shared)
  }
}
async function invite() {
  await perform(async () => {
    const body = { ids: [props.id], email: email.value.trim() },
      fingerprint = JSON.stringify(body)
    if (fingerprint !== lastInvite) {
      requestId = crypto.randomUUID()
      lastInvite = fingerprint
    }
    await props.request({ action: 'invite', id: props.id, ...body, requestId })
    if (!live) return
    await load()
    email.value = ''
    lastInvite = ''
    await nextTick()
    inviteForm.value?.reset()
  })
}
async function remove() {
  if (!state.value || !confirm.value) return
  const target = confirm.value
  await perform(async () => {
    await props.request({
      action: 'access',
      id: props.id,
      operation: target.you ? 'leave' : 'remove',
      ownerUid: target.uid,
      accessRevision: state.value!.accessRevision,
    })
    confirm.value = undefined
    if (target.you) emit('removed')
    else {
      await load()
      await nextTick()
      content.value?.querySelector<HTMLButtonElement>('button')?.focus()
    }
  })
}
async function revoke(id: string) {
  await perform(async () => {
    await props.request({
      action: 'access',
      id: props.id,
      operation: 'revoke',
      invitationId: id,
    })
    lastInvite = ''
    await load()
  })
}
async function refresh() {
  if (busy.value || refreshing || document.visibilityState !== 'visible') return
  refreshing = true
  try {
    await load()
  } catch (e) {
    if (live) {
      state.value = undefined
      error.value = e instanceof Error ? e.message : 'Could not refresh access.'
    }
  } finally {
    refreshing = false
  }
}
onMounted(() => {
  void perform(load)
  timer = setInterval(refresh, 15000)
  window.addEventListener('focus', refresh)
})
</script>
<template>
  <Popover
    v-model:open="open"
    title="Sharing"
    :width="340"
    align="end"
    :dismissible="!busy"
  >
    <template #anchor>
      <button
        type="button"
        class="press-row text-primary flex min-h-11 shrink-0 items-center gap-2 rounded-full px-2 text-sm"
        :aria-expanded="open"
        aria-haspopup="dialog"
        :disabled="disabled"
        @click="disabled && $event.stopPropagation()"
      >
        <span
          v-if="state && state.owners.length > 1"
          class="flex -space-x-2"
          aria-hidden="true"
        >
          <span
            v-for="(person, index) in state.owners.slice(0, 3)"
            :key="person.uid"
            class="border-background grid size-7 place-items-center rounded-full border-2 text-[10px] font-semibold"
            :class="
              index % 2
                ? 'bg-stone-200 text-stone-700 dark:bg-stone-700 dark:text-stone-200'
                : 'bg-blue-paper text-primary'
            "
            >{{ initials(person.name) }}</span
          >
          <span
            v-if="state.owners.length > 3"
            class="bg-blue-paper text-primary border-background grid size-7 place-items-center rounded-full border-2 text-[10px] font-semibold"
            >+{{ state.owners.length - 3 }}</span
          >
        </span>
        <UsersRound v-else class="size-4 shrink-0" aria-hidden="true" />
        <span>Sharing</span>
      </button>
    </template>
    <div ref="content" class="space-y-3">
      <section v-if="confirm" class="space-y-4" role="group" aria-label="Confirm removal">
        <div class="space-y-2">
          <h3 class="text-heading font-semibold">
            {{ confirm.you ? 'Leave sharing?' : `Remove ${confirm.name}’s access?` }}
          </h3>
          <p class="text-muted-foreground text-sm">
            {{
              confirm.you
                ? `${state?.name || 'This dancer'} will be removed from your account. The other accounts will keep access.`
                : `${confirm.name} will no longer be able to view or manage ${state?.name || 'this dancer'}.`
            }}
          </p>
        </div>
        <div class="flex flex-wrap justify-end gap-2">
          <Button size="sm" data-cancel-removal :disabled="busy" @click="cancelRemoval"
            >Cancel</Button
          >
          <Button size="sm" variant="destructive" :busy="busy" @click="remove">{{
            confirm.you ? 'Leave sharing' : 'Remove access'
          }}</Button>
        </div>
      </section>
      <template v-else>
        <header class="space-y-1">
          <h3 class="text-heading font-semibold">Shared access</h3>
          <p class="text-muted-foreground text-sm">
            {{
              state && state.owners.length > 1
                ? 'These accounts can manage this dancer alongside you.'
                : 'Invite someone to manage this dancer alongside you.'
            }}
          </p>
        </header>
        <template v-if="state">
          <ul class="space-y-1">
            <li
              v-for="(person, index) in state.owners"
              :key="person.uid"
              class="flex min-h-12 items-center gap-2"
            >
              <span
                class="grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold"
                :class="
                  index % 2
                    ? 'bg-stone-200 text-stone-700 dark:bg-stone-700 dark:text-stone-200'
                    : 'bg-blue-paper text-primary'
                "
                aria-hidden="true"
                >{{ initials(person.name) }}</span
              >
              <span class="min-w-0 flex-1 text-sm wrap-anywhere"
                >{{ person.name
                }}<span v-if="person.you" class="text-muted-foreground">
                  (you)</span
                ></span
              >
              <Button
                v-if="state.owners.length > 1 || !person.you"
                size="sm"
                :disabled="busy"
                :data-owner="person.uid"
                @click="askToRemove(person)"
                >{{ person.you ? 'Leave' : 'Remove' }}</Button
              >
            </li>
          </ul>
          <div
            v-if="state.invitations.length"
            class="border-border space-y-2 border-t pt-3"
          >
            <div
              v-for="pending in state.invitations"
              :key="pending.id"
              class="flex min-h-11 items-center gap-2"
            >
              <Mail class="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
              <span class="min-w-0 flex-1 text-sm wrap-anywhere"
                >{{ pending.email
                }}<small class="text-muted-foreground block">{{
                  pending.delivery === 'sent'
                    ? 'Invited'
                    : pending.delivery === 'failed'
                      ? 'Email failed. Cancel and try again.'
                      : 'Sending email…'
                }}</small></span
              >
              <Button
                size="sm"
                :disabled="busy"
                :aria-label="`Cancel invitation to ${pending.email}`"
                @click="revoke(pending.id)"
                >Cancel</Button
              >
            </div>
          </div>
          <form
            ref="inviteForm"
            class="border-border border-t pt-3"
            @submit.prevent="invite"
          >
            <fieldset
              :disabled="busy || !state.emailVerified"
              class="flex min-w-0 items-center gap-2"
            >
              <input
                v-model="email"
                type="email"
                required
                maxlength="254"
                autocomplete="off"
                aria-label="Invite by email"
                placeholder="Invite by email"
                class="field h-11 min-w-0 flex-1 rounded-xl px-3 text-base"
              />
              <Button type="submit" variant="tonal" size="sm" :busy="busy">Invite</Button>
            </fieldset>
          </form>
          <p v-if="!state.emailVerified" class="text-muted-foreground text-xs">
            Verify your email in
            <a
              href="https://connect.scotdance.app/account"
              target="_blank"
              rel="noopener"
              class="text-primary underline"
              >Account</a
            >
            to invite someone.
          </p>
        </template>
        <p
          v-else-if="busy"
          role="status"
          class="text-muted-foreground flex items-center gap-2 text-sm"
        >
          <LoaderCircle class="size-4 animate-spin" aria-hidden="true" />Loading sharing…
        </p>
      </template>
      <p v-if="error" role="alert" class="text-destructive text-sm">{{ error }}</p>
      <Button v-if="error" size="sm" :disabled="busy" @click="perform(load)"
        >Try again</Button
      >
    </div>
  </Popover>
</template>
