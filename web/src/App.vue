<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useHead } from '@unhead/vue'
import GlobalBottomNav from '@/components/nav/GlobalBottomNav.vue'
import PageStack from '@/components/nav/PageStack.vue'
import { topBarFrosted } from '@/lib/topBar'
import AppSidebar from '@/components/nav/AppSidebar.vue'
import LoginDialog from '@/components/LoginDialog.vue'
import AlertsPrompt from '@/components/AlertsPrompt.vue'
import AlertBanner from '@/components/AlertBanner.vue'
import OfflineNotice from '@/components/OfflineNotice.vue'
import { confirmRequest, toasts } from '@/lib/admin/feedback'
import RolesSheet from '@/components/RolesSheet.vue'
import { useRoles } from '@/composables/useRoles'
import { startLiveAlerts } from '@/composables/useLiveAlerts'
import SupportLauncher from '@/components/SupportLauncher.vue'
import UpdateDialog from '@/components/UpdateDialog.vue'
import SplashOverlay from '@/components/SplashOverlay.vue'
import { buildTitle } from '@/composables/usePageTitle'
import { useCrisp } from '@/composables/useCrisp'
import { useMeStore } from '@/stores/me'
import { useDisplayPrefs } from '@/composables/useDisplayPrefs'

// Default page title from route meta. Component-level usePageTitle calls
// (e.g. entity layouts) stack on top and override; when they unmount Unhead
// falls back here. Keep this in Unhead — not document.title — so writes are
// reconciled together.
const route = useRoute()

// Toasts and confirm dialogs only come from Manage and the forms around it,
// so their host loads the first time one is needed, then stays for the exit transition.
const FeedbackHost = defineAsyncComponent(() => import('@/components/admin/FeedbackHost.vue'))
const feedbackUsed = ref(false)
watch([() => toasts.length, confirmRequest], ([n, req]) => {
  if (n || req) feedbackUsed.value = true
})
useHead({
  title: () => buildTitle([route.meta.title]),
  // Pages with dancers' names (mostly minors) stay out of search results.
  // Not robots.txt: a blocked page is never crawled, so its noindex is never seen.
  meta: () => (route.meta.noindex ? [{ name: 'robots', content: 'noindex' }] : []),
})

// Routes that own their own bottom nav (entity layouts, competition layout)
// opt out via `meta.ownsBottomNav` — declared once on the layout route, applies
// to every child. Avoids brittle name-prefix matching against future entities.
// /search keeps GlobalBottomNav so the search input stays mounted across the
// home ↔ search transition — required for iOS to keep the soft keyboard up.
const showGlobalNav = computed(
  () => !route.matched.some((r) => r.meta.ownsBottomNav),
)

// Appearance and text size preferences (Settings) live on <html>.
useDisplayPrefs()

// Asks new accounts how they use the app (see useRoles).
useRoles()

// Placing alerts for followed dancers while the app is open.
startLiveAlerts()

// Pass the signed-in user's email to Crisp so support has context. Lives
// here (rather than inside useCrisp) so the composable stays decoupled
// from pinia — Crisp wiring is pure SDK calls, app-state glue is here.
const crisp = useCrisp()
const me = useMeStore()
watch(() => me.email, (email) => crisp.setUserEmail(email), { immediate: true })
</script>

<template>
  <AppSidebar />
  <div class="flex min-h-dvh flex-col pr-(--chrome-right) pl-(--chrome-left)">
    <PageStack />

    <GlobalBottomNav v-if="showGlobalNav" />
  </div>
  <!-- The bars' frosted glass, one sheet each behind whichever page's bars
       are showing, so it doesn't come and go as pages slide. The top one is
       clear at the top of a page, so the paper shows through, and frosted
       once something scrolls under it, as on iOS (clear means no blur at
       all); it runs 1.25rem past the bar, fading out. The tab bar's rises
       from the foot of the screen to a third of the way up the pill. -->
  <div
    :class="[
      'paper pointer-events-none fixed inset-x-chrome-0 top-0 z-30 h-[calc(var(--safe-top)+4.75rem)] transition-[opacity,backdrop-filter] duration-(--dur-base) [mask-image:linear-gradient(to_bottom,black_calc(100%-1.25rem),transparent)]',
      !topBarFrosted && 'opacity-0 [backdrop-filter:none]!',
    ]"
    aria-hidden="true"
  />
  <div
    class="paper pointer-events-none fixed inset-x-chrome-0 -bottom-10 z-30 hidden h-[calc(2.75rem+max(0.5rem,var(--safe-bottom))+2.5rem)] [mask-image:linear-gradient(to_bottom,transparent,black_0.75rem)] lg:hidden! [:root:has(:is([data-tabbar],[data-bar-copy=tabbar]))_&]:block"
    aria-hidden="true"
  />
  <SupportLauncher />
  <LoginDialog />
  <AlertBanner />
  <AlertsPrompt />
  <OfflineNotice />
  <FeedbackHost v-if="feedbackUsed" />
  <RolesSheet />
  <UpdateDialog />
  <SplashOverlay />
</template>
