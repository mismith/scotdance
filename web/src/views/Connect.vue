<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getCurrentUser } from 'vuefire'
import { Bot, LoaderCircle, ShieldOff, TimerOff, TriangleAlert } from '@lucide/vue'
import AppBar from '@/components/nav/AppBar.vue'
import EmptyState from '@/components/EmptyState.vue'
import Button from '@/components/ui/Button.vue'
import { usePageTitle } from '@/composables/usePageTitle'
import { answerRequest, lookUpRequest, type AssistantRequest } from '@/lib/assistants'
import { useAuthStore } from '@/stores/auth'
import { useMeStore } from '@/stores/me'

// An AI assistant (Claude, ChatGPT) has asked to manage this person's competitions and sent them here (ADR 0018).
// Signing in comes first, and the address stays, so they land back here. There is nothing to pick: what it can
// reach is checked by the database rules on every call. The server decides; this only asks.

const route = useRoute()
const auth = useAuthStore()
const me = useMeStore()
const requestId = computed(() => (typeof route.query.request === 'string' ? route.query.request : ''))

type State = 'loading' | 'signed-out' | 'nothing' | 'ask' | 'gone' | 'failed'
const state = ref<State>('loading')
const asked = ref<AssistantRequest>()
const authReady = ref(false)

async function load() {
  if (!authReady.value) return
  if (!auth.isSignedIn) return void (state.value = 'signed-out')
  state.value = 'loading'
  // It can only reach what they manage, so with nothing to manage there is nothing to allow
  if (!me.accessKnown) return
  if (!me.canManageAny) return void (state.value = 'nothing')
  if (!requestId.value) return void (state.value = 'gone')
  try {
    const found = await lookUpRequest(requestId.value)
    if (!found) return void (state.value = 'gone')
    asked.value = found
    state.value = 'ask'
  } catch {
    state.value = 'failed'
  }
}
onMounted(async () => {
  await getCurrentUser()
  authReady.value = true
})
watch(() => [authReady.value, auth.isSignedIn, requestId.value, me.accessKnown, me.canManageAny], load, { immediate: true })

const known = computed(() => asked.value?.known ?? false)
const name = computed(() => asked.value?.client.name ?? '')
const host = computed(() => asked.value?.client.host ?? '')

usePageTitle(['Connect an AI assistant'])

const busy = ref(false)
const problem = ref('')
async function answer(deny?: true) {
  if (busy.value) return
  busy.value = true
  problem.value = ''
  try {
    const redirect = await answerRequest(requestId.value, deny)
    // Off to the assistant: stay busy until the page goes, so nothing is pressed twice
    if (redirect) return void window.location.assign(redirect)
    state.value = 'gone'
  } catch {
    problem.value = 'That didn’t work. Check your connection and try again.'
  }
  busy.value = false
}
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <AppBar title="Connect an AI assistant" show-title :fallback="{ to: { name: 'home' }, label: 'Home' }" />
    <main class="mx-auto w-full max-w-lg flex-1 px-4 pt-[calc(var(--chrome-top)+1rem)] pb-[calc(var(--chrome-bottom)+1.5rem)]">
      <div v-if="state === 'loading'" class="flex justify-center py-20" role="status" aria-busy="true">
        <LoaderCircle class="text-muted-foreground size-8 animate-spin" />
      </div>

      <EmptyState
        v-else-if="state === 'signed-out'"
        :icon="Bot"
        title="Connect your AI assistant"
        description="Sign in to ScotDance.app to allow it."
      >
        <Button variant="primary" size="lg" @click="auth.openLogin()">Sign in</Button>
      </EmptyState>

      <EmptyState
        v-else-if="state === 'nothing'"
        :icon="ShieldOff"
        title="You don’t manage anything yet"
        description="An AI assistant can only work with the competitions and organisations you’re an admin of. Add a competition, or ask an admin to invite you, then connect it again."
      >
        <Button variant="primary" size="lg" :to="{ name: 'home' }">Back to Home</Button>
      </EmptyState>

      <EmptyState
        v-else-if="state === 'gone'"
        :icon="TimerOff"
        title="That request has run out"
        description="Go back to your AI assistant and connect again."
      />

      <EmptyState v-else-if="state === 'failed'" :icon="TriangleAlert" title="That didn’t open" description="Check your connection and try again.">
        <Button variant="primary" size="lg" @click="load">Try again</Button>
      </EmptyState>

      <form v-else @submit.prevent="answer()">
        <EmptyState
          :icon="Bot"
          :title="known ? `Let ${name} manage your competitions?` : `Let ${host} manage your competitions?`"
          description="This AI assistant can look up and change the competitions and organisations you manage, the same as you can. It can’t invite or remove admins, or delete a competition."
        >
          <Button type="submit" variant="primary" size="lg" :busy="busy">Allow</Button>
          <Button variant="plain" size="lg" :disabled="busy" @click="answer(true)">Not now</Button>
          <template #footer>
            <span v-if="problem" class="text-destructive block font-medium" role="alert">{{ problem }}</span>
            <span v-if="!known" class="block font-medium">It calls itself “{{ name }}”. ScotDance.app doesn’t know it, so only allow it if you set it up yourself.</span>
            <span class="block">You can see what it changed, and disconnect it, any time in Account.</span>
          </template>
        </EmptyState>
      </form>
    </main>
  </div>
</template>
