<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { useHead } from '@unhead/vue'
import GlobalBottomNav from '@/components/nav/GlobalBottomNav.vue'
import LoginDialog from '@/components/LoginDialog.vue'
import AlertsSheet from '@/components/AlertsSheet.vue'
import AlertBanner from '@/components/AlertBanner.vue'
import RolesSheet from '@/components/RolesSheet.vue'
import { useRoles } from '@/composables/useRoles'
import { startLiveAlerts } from '@/composables/useLiveAlerts'
import SupportLauncher from '@/components/SupportLauncher.vue'
import UpdateDialog from '@/components/UpdateDialog.vue'
import { buildTitle } from '@/composables/usePageTitle'
import { useCrisp } from '@/composables/useCrisp'
import { useMeStore } from '@/stores/me'
import { useDisplayPrefs } from '@/composables/useDisplayPrefs'
import { useAuthStore } from '@/stores/auth'

// Default page title from route meta. Component-level usePageTitle calls
// (e.g. entity layouts) stack on top and override; when they unmount Unhead
// falls back here. Keep this in Unhead — not document.title — so writes are
// reconciled together.
const route = useRoute()
useHead({ title: () => buildTitle([route.meta.title]) })

// Routes that own their own bottom nav (entity layouts, competition layout)
// opt out via `meta.ownsBottomNav` — declared once on the layout route, applies
// to every child. Avoids brittle name-prefix matching against future entities.
// /search keeps GlobalBottomNav so the search input stays mounted across the
// home ↔ search transition — required for iOS to keep the soft keyboard up.
const showGlobalNav = computed(
  () => !route.matched.some((r) => r.meta.ownsBottomNav),
)

// Text size and contrast preferences (More › Display) live on <html>.
useDisplayPrefs()

// Asks new accounts how they use the app (see useRoles).
useRoles()

// Placing alerts for followed dancers while the app is open.
startLiveAlerts()

// Finish a passwordless sign-in when the app is opened from the emailed link.
const auth = useAuthStore()
onMounted(() => {
  auth.completeEmailLinkSignIn().catch((e) => console.warn('[auth] email link', e))
})

// Pass the signed-in user's email to Crisp so support has context. Lives
// here (rather than inside useCrisp) so the composable stays decoupled
// from pinia — Crisp wiring is pure SDK calls, app-state glue is here.
const crisp = useCrisp()
const me = useMeStore()
watch(() => me.email, (email) => crisp.setUserEmail(email), { immediate: true })
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <RouterView />

    <GlobalBottomNav v-if="showGlobalNav" />
  </div>
  <SupportLauncher />
  <LoginDialog />
  <AlertsSheet />
  <AlertBanner />
  <RolesSheet />
  <UpdateDialog />
</template>
