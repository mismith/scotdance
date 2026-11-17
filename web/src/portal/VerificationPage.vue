<script setup lang="ts">
import { ref } from 'vue'
import { BadgeCheck, LoaderCircle } from '@lucide/vue'
import ConnectBrand from './ConnectBrand.vue'
import { completeVerification } from '@/account/complete-verification'
const code = new URL(location.href).searchParams.get('oobCode') || ''
// Keep the code out of later navigation and referrers; only this page holds it.
history.replaceState(null, '', location.pathname)
const state = ref<'ready' | 'busy' | 'verified' | 'invalid' | 'error'>(code ? 'ready' : 'invalid')
async function verify() {
  if (state.value === 'busy' || state.value === 'verified' || state.value === 'invalid') return
  state.value = 'busy'
  try { await completeVerification(code); state.value = 'verified' }
  catch (error) { state.value = error instanceof Error && error.message === 'invalid-link' ? 'invalid' : 'error' }
}
</script>
<template>
  <main class="mx-auto flex min-h-dvh max-w-xl flex-col px-6 py-10">
    <a href="/account" class="self-start"><ConnectBrand /></a>
    <section class="py-12" aria-live="polite">
      <BadgeCheck v-if="state === 'verified'" class="mb-4 size-7 text-green-700 dark:text-green-400" aria-hidden="true" />
      <h1 class="mb-3 text-title font-bold">{{ state === 'verified' ? 'Email verified' : state === 'invalid' ? 'This link is no longer valid' : 'Verify your email' }}</h1>
      <p class="mb-6 text-muted-foreground">{{ state === 'verified' ? 'Your email is confirmed. You’re ready to share dancer profiles.' : state === 'invalid' ? 'It may have expired or already been used. Return to Account to check your status or request a new email.' : state === 'error' ? 'Could not verify your email. Please check your connection and try again.' : 'Confirm your email to finish verification.' }}</p>
      <a v-if="state === 'verified' || state === 'invalid'" href="/account" class="inline-flex min-h-11 items-center rounded-full bg-primary px-6 py-2 font-semibold text-primary-foreground">{{ state === 'verified' ? 'Return to Connect' : 'Go to Account' }}</a>
      <button v-else type="button" :disabled="state === 'busy'" :aria-busy="state === 'busy'" class="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-6 py-2 font-semibold text-primary-foreground disabled:opacity-60" @click="verify"><LoaderCircle v-if="state === 'busy'" class="size-4 animate-spin" aria-hidden="true" />{{ state === 'busy' ? 'Verifying…' : state === 'error' ? 'Try again' : 'Verify email' }}</button>
      <p v-if="state === 'verified'" class="mt-5 text-footnote text-muted-foreground">You can close this tab and return to where you left off.</p>
    </section>
    <footer class="text-footnote text-muted-foreground"><a href="https://scotdance.app" class="font-semibold">ScotDance.app</a><p class="mt-1">Built by a Highland dance family, for Highland dance families.</p></footer>
  </main>
</template>
