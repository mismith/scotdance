<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import Dialog from '@/components/Dialog.vue'
import LoginForm, { type LoginStep } from '@/components/LoginForm.vue'

// Sign-in, asked for at the moment it matters (tapping Favourite) and saying so.
const auth = useAuthStore()
const step = ref<LoginStep>('signin')
const form = ref<InstanceType<typeof LoginForm> | null>(null)

const heading = computed(() => {
  if (step.value === 'register') return 'Create an account'
  if (step.value === 'forgot') return 'Reset your password'
  const r = auth.loginReason
  if (r?.reason === 'follow' && r.name) return `Sign in to favourite ${r.name.split(' ')[0]}`
  // A competition's Alerts, or Settings.
  if (r?.reason === 'alerts') return r.name ? `Sign in to get alerts for ${r.name}` : 'Sign in to get alerts'
  if (r?.reason === 'submit') return 'Sign in to add a competition'
  // The Favourite star on judges, venues and the like.
  if (r?.reason === 'favorite') return r.name ? `Sign in to favourite ${r.name}` : 'Sign in to favourite this'
  return 'Sign in to ScotDance.app'
})
// What favourites get you; an organiser submitting has read why already.
const benefits = computed(() => {
  const r = auth.loginReason
  if (r?.reason === 'submit') return []
  const first = r?.reason === 'follow' ? r.name?.split(' ')[0] : undefined
  return [
    first ? `See ${first}’s day on your Home screen` : 'See your dancers’ day on your Home screen',
    'Get an alert when placings are posted',
    'Your dancers on every device',
  ]
})

// Each opening starts at a fresh sign-in, without the fade.
let opening = false
watch(
  () => auth.loginDialogOpen,
  (open) => {
    if (!open) return
    opening = true
    form.value?.reset()
    void nextTick(() => (opening = false))
  },
)

watch(
  () => auth.isSignedIn,
  (signedIn) => {
    if (signedIn && auth.loginDialogOpen) auth.closeLogin()
  },
)

// The heading fades in with the form as it changes.
const headingEl = ref<HTMLElement | null>(null)
watch(step, async () => {
  if (opening || matchMedia('(prefers-reduced-motion: reduce)').matches) return
  await nextTick()
  headingEl.value?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' })
})
</script>

<template>
  <Dialog :open="auth.loginDialogOpen" :morph="auth.loginSheet" variant="sheet" @close="auth.closeLogin()">
    <template #header>
      <h2 ref="headingEl" class="text-title">{{ heading }}</h2>
    </template>

    <LoginForm ref="form" v-model:step="step" :benefits="benefits" class="p-4 pb-[calc(1.5rem+var(--safe-bottom))]" />
  </Dialog>
</template>
