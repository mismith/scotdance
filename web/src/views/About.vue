<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { Timeline, ChevronDown, Trophy, Users, IdCard, Compass, Link } from '@lucide/vue'
import SmoothCollapse from '@/components/SmoothCollapse.vue'
import TopBackButton from '@/components/nav/TopBackButton.vue'
import { useCrisp } from '@/composables/useCrisp'
import { PLATFORM } from '@/composables/useUpdate'
import { version } from '../../package.json'

const crisp = useCrisp()

const platformLabel =
  PLATFORM === 'ios' ? 'iOS' : PLATFORM === 'android' ? 'Android' : 'Web'
const isWeb = PLATFORM === 'web'

const features = [
  {
    eyebrow: 'Find',
    icon: Users,
    title: 'Dancers',
    body: 'Search by number, name, or age group. Mark favourites for quick access throughout the day.',
  },
  {
    eyebrow: 'Check',
    icon: Timeline,
    title: 'Schedules',
    body: 'See start times, platforms, and the order of dances. Championship draws included.',
  },
  {
    eyebrow: 'Watch',
    icon: Trophy,
    title: 'Results',
    body: 'Callbacks and placings, posted as they are announced. Archived for review after the competition.',
  },
]

const aggregatorFeatures = [
  {
    eyebrow: 'Follow',
    icon: IdCard,
    title: 'Profiles',
    body: 'A dedicated page for every dancer, judge, and piper. Track things more seamlessly than ever before.',
  },
  {
    eyebrow: 'Explore',
    icon: Compass,
    title: 'Visuals',
    body: "Navigate competitions in a calendar view, or move around on a map. Use habits you've already learned to interact with the highland dance world.",
  },
]

const faqs: { id: string; q: string; a?: string }[] = [
  {
    id: 'free',
    q: 'Is there a cost associated with using this site/app at my local competition?',
    a: 'No! All competition data is user-submitted, and you can use it as a competition organizer or competition attendee for free anywhere in the world. There is no plan for this to ever change.',
  },
  {
    id: 'worldwide',
    q: 'Can I use this in any country?',
    // Rendered inline in template so the support link can call crisp.open()
  },
  {
    id: 'independence',
    q: 'Is ScotDance.app affiliated with any association, organization, governing body, or particular competition(s)?',
    a: 'No, it is a completely independent, not-for-profit, volunteer run endeavour.',
  },
  {
    id: 'download',
    q: 'Do I need to download or install anything to get access?',
    a: 'No, it\'s entirely optional to use the App/Play Store distributed apps; everything works exactly the same in a web browser on whatever device(s) you own (e.g. by visiting <a href="http://www.scotdance.app" class="underline underline-offset-4 transition-colors hover:text-foreground">www.scotdance.app</a>). Of course, it\'s handy to have a dedicated place for easy access, so installing a mobile app makes that possible.',
  },
  {
    id: 'privacy',
    q: 'Is it safe to use? Are you harvesting my data? Are there privacy concerns with having this information available online?',
    a: 'This service is, in plain words, completely legitimate. It checks all the security boxes you would/should expect, and does nothing remotely nefarious with the (minimal) data it does collect from you. Furthermore, since all competition data is user-submitted, it\'s conceptually equivalent to uploading scanned or exported results PDFs to a dance association\'s website, just made more convenient, hopefully. You can also read more details on the <a href="/policies" class="underline underline-offset-4 transition-colors hover:text-foreground">Policies</a> page.',
  },
]

const featuresRef = ref<HTMLElement | null>(null)
function scrollToFeatures(e: Event) {
  e.preventDefault()
  featuresRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const route = useRoute()
const router = useRouter()
const openFaqs = ref(new Set<string>())

function isOpen(id: string) {
  return openFaqs.value.has(id)
}
function toggle(id: string) {
  const next = new Set(openFaqs.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  openFaqs.value = next
}
function scrollToFaq(id: string) {
  document
    .getElementById(`faq-${id}`)
    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
function onLinkClick(id: string) {
  if (!isOpen(id)) toggle(id)
  router.replace({ hash: `#faq-${id}` })
  scrollToFaq(id)
}
function applyHash(hash: string) {
  const match = hash.match(/^#faq-(.+)$/)
  if (!match) return
  const id = match[1]
  if (!faqs.some((f) => f.id === id)) return
  if (!isOpen(id)) toggle(id)
  nextTick(() => scrollToFaq(id))
}
onMounted(() => applyHash(route.hash))
watch(() => route.hash, applyHash)
</script>

<template>
  <div
    class="flex flex-1 flex-col pb-[calc(var(--chrome-bottom)+1rem)]"
    data-route="about"
  >
    <nav class="pointer-events-none fixed inset-x-0 top-0 z-30 px-4 pt-(--nav-top)">
      <div class="mx-auto flex max-w-3xl">
        <TopBackButton />
      </div>
    </nav>

    <!-- HERO -->
    <section class="relative flex min-h-dvh flex-col items-center justify-center px-6">
      <header
        class="absolute inset-x-0 top-0 flex flex-col items-center gap-2 pt-8 text-center"
      >
        <img src="/img/touchicon.png" alt="" class="size-10 rounded-md shadow-sm" />
        <div class="text-lg">ScotDance.app</div>
      </header>

      <div class="mb-32 space-y-5 text-center">
        <h1 class="text-5xl font-medium tracking-tight text-balance md:text-7xl">
          Highland dance,<br />in your pocket.
        </h1>
        <p class="text-muted-foreground mx-auto max-w-2xl text-xl md:text-2xl">
          Browse competitions, follow dancers, and see results as they happen.
        </p>
      </div>

      <a
        href="#features"
        class="text-muted-foreground hover:text-foreground absolute inset-x-0 mx-auto flex w-fit flex-col items-center gap-1.5 transition-colors"
        :style="{ bottom: 'calc(7rem + env(safe-area-inset-bottom))' }"
        aria-label="Scroll to features"
        @click="scrollToFeatures"
      >
        <span class="text-eyebrow text-[10px]"> Discover </span>
        <ChevronDown class="size-4 animate-bounce" />
      </a>
    </section>

    <!-- FEATURES -->
    <section
      id="features"
      ref="featuresRef"
      class="border-border/60 border-t px-6 py-24 md:py-32"
    >
      <div class="mx-auto w-full max-w-5xl">
        <header class="mb-16 space-y-4">
          <div class="text-foreground text-eyebrow text-sm">On the day</div>
          <h2 class="text-5xl font-medium tracking-tight md:text-5xl">
            A program of events, without the paper.
          </h2>
          <p class="text-muted-foreground text-lg md:text-xl">
            Dancers, schedules, and results in a single place, kept in sync as the day
            unfolds.
          </p>
        </header>

        <div class="grid gap-12 md:grid-cols-3 md:gap-10">
          <article
            v-for="f in features"
            :key="f.title"
            class="border-border/60 flex flex-col gap-4 border-t pt-6"
          >
            <div class="flex items-center justify-between gap-4">
              <div class="space-y-1">
                <div class="text-foreground/65 text-eyebrow text-xs">
                  {{ f.eyebrow }}
                </div>
                <h3 class="text-2xl font-medium tracking-tight md:text-3xl">
                  {{ f.title }}
                </h3>
              </div>
              <component :is="f.icon" class="text-primary size-8 shrink-0" />
            </div>
            <p class="text-muted-foreground leading-relaxed">{{ f.body }}</p>
          </article>
        </div>
      </div>
    </section>

    <!-- AGGREGATOR / CROSS-COMPETITION -->
    <section class="border-border/60 border-t px-6 py-24 md:py-32">
      <div class="mx-auto w-full max-w-5xl">
        <header class="mb-16 space-y-4">
          <div class="text-foreground text-eyebrow text-sm">Over the years</div>
          <h2 class="text-5xl font-medium tracking-tight md:text-5xl">
            Multiple sources, stitched together.
          </h2>
          <p class="text-muted-foreground text-lg md:text-xl">
            Years of competition data, pulled together and made handy when you need it.
          </p>
        </header>

        <div class="grid gap-12 md:grid-cols-2 md:gap-10">
          <article
            v-for="f in aggregatorFeatures"
            :key="f.title"
            class="border-border/60 flex flex-col gap-4 border-t pt-6"
          >
            <div class="flex items-center justify-between gap-4">
              <div class="space-y-1">
                <div class="text-foreground/65 text-eyebrow text-xs">
                  {{ f.eyebrow }}
                </div>
                <h3 class="text-2xl font-medium tracking-tight md:text-3xl">
                  {{ f.title }}
                </h3>
              </div>
              <component :is="f.icon" class="text-primary size-8 shrink-0" />
            </div>
            <p class="text-muted-foreground leading-relaxed">{{ f.body }}</p>
          </article>
        </div>
      </div>
    </section>

    <!-- DOWNLOAD / CTA — web only; in-app this is redundant -->
    <section
      v-if="isWeb"
      class="bg-muted/40 border-border/60 border-t px-6 py-24 md:py-32"
    >
      <div class="mx-auto flex w-full max-w-4xl flex-col items-center gap-10 text-center">
        <div class="space-y-4">
          <div class="text-foreground text-eyebrow text-sm">Take it with you</div>
          <h2 class="text-5xl font-medium tracking-tight md:text-5xl">
            From the warm-up to the awards.
          </h2>
          <p class="text-muted-foreground mx-auto max-w-xl text-lg md:text-xl">
            Install it on your phone, or just bookmark it in any browser.
          </p>
        </div>

        <div class="flex flex-wrap items-center justify-center gap-3">
          <a
            href="https://apps.apple.com/us/app/scotdance/id1386475626"
            target="_blank"
            rel="noopener"
            class="transition-opacity hover:opacity-80"
            aria-label="Download on the App Store"
          >
            <img src="/img/app-store.svg" alt="Download on the App Store" class="h-12" />
          </a>
          <a
            href="https://play.google.com/store/apps/details?id=info.mismith.scotdance"
            target="_blank"
            rel="noopener"
            class="transition-opacity hover:opacity-80"
            aria-label="Get it on Google Play"
          >
            <img src="/img/play-store.svg" alt="Get it on Google Play" class="h-12" />
          </a>
        </div>

        <RouterLink
          :to="{ name: 'competitions' }"
          class="text-primary hover:text-primary/80 px-1 py-2 font-sans text-sm font-medium"
        >
          Continue in your browser →
        </RouterLink>
      </div>
    </section>

    <!-- FAQ -->
    <section class="border-border/60 border-t px-6 py-24 md:py-32">
      <div class="mx-auto w-full max-w-3xl">
        <header class="mb-12 space-y-4">
          <div class="text-foreground text-eyebrow text-sm">Common questions</div>
          <h2 class="text-5xl font-medium tracking-tight md:text-5xl">FAQs</h2>
        </header>

        <div class="border-border/60 border-t">
          <div
            v-for="(item, i) in faqs"
            :id="`faq-${item.id}`"
            :key="item.id"
            class="border-border/60 group/faq relative scroll-mt-4 border-b"
          >
            <button
              type="button"
              class="flex w-full cursor-pointer items-baseline gap-4 py-6 pr-20 text-left"
              :aria-expanded="isOpen(item.id)"
              :aria-controls="`faq-panel-${item.id}`"
              @click="toggle(item.id)"
            >
              <span class="text-foreground/40 w-8 shrink-0 font-medium tabular-nums">
                {{ String(i + 1).padStart(2, '0') }}
              </span>
              <span
                :id="`faq-q-${item.id}`"
                class="flex-1 font-serif text-xl font-medium tracking-tight md:text-2xl"
              >
                {{ item.q }}
              </span>
              <ChevronDown
                class="text-muted-foreground absolute top-7 right-0 size-5 transition-transform"
                :class="isOpen(item.id) && 'rotate-180'"
              />
            </button>
            <a
              :href="`#faq-${item.id}`"
              class="text-muted-foreground hover:text-foreground absolute top-8 right-8 opacity-0 transition-opacity group-hover/faq:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
              :aria-label="`Link to: ${item.q}`"
              @click.prevent="onLinkClick(item.id)"
            >
              <Link class="size-3.5" />
            </a>
            <SmoothCollapse
              :id="`faq-panel-${item.id}`"
              role="region"
              :aria-labelledby="`faq-q-${item.id}`"
              :open="isOpen(item.id)"
            >
              <div
                v-if="item.id === 'worldwide'"
                class="text-muted-foreground pr-9 pb-6 pl-12 leading-relaxed"
              >
                Yes, anywhere in the world. Curiously, usage in the United States has been
                very light so far. If you've got a theory why, please
                <button
                  type="button"
                  class="hover:text-foreground cursor-pointer font-serif underline underline-offset-4 transition-colors"
                  @click="crisp.open()"
                >
                  get in touch</button
                >.
              </div>
              <div
                v-else
                class="text-muted-foreground pr-9 pb-6 pl-12 leading-relaxed"
                v-html="item.a"
              />
            </SmoothCollapse>
          </div>
        </div>
      </div>
    </section>

    <!-- ABOUT / FOOTER -->
    <footer class="border-border/60 border-t px-6 py-20">
      <div
        class="mx-auto flex w-full max-w-5xl flex-col gap-10 md:flex-row md:items-end md:justify-between"
      >
        <div class="space-y-4">
          <div class="flex items-center gap-3">
            <img src="/img/touchicon.png" alt="" class="size-8 rounded-md" />
            <div class="text-lg">ScotDance.app</div>
          </div>
          <p class="text-muted-foreground max-w-sm text-base leading-snug">
            A volunteer-run project for the highland dance community. By
            <a
              href="https://mismith.io"
              target="_blank"
              rel="noopener"
              class="hover:text-foreground underline underline-offset-4 transition-colors"
              >Murray Rowan</a
            >, since 2017.
          </p>
        </div>

        <div class="text-muted-foreground flex flex-col gap-2 text-sm md:items-end">
          <div>
            <button
              v-if="crisp.available"
              type="button"
              class="hover:text-foreground cursor-pointer font-serif underline underline-offset-4 transition-colors"
              @click="crisp.open()"
            >
              Support
            </button>
            <template v-if="crisp.available"> · </template>
            <RouterLink
              :to="{ name: 'policies' }"
              class="hover:text-foreground underline underline-offset-4 transition-colors"
            >
              Policies
            </RouterLink>
            ·
            <a
              href="https://github.com/mismith/scotdance"
              target="_blank"
              rel="noopener"
              class="hover:text-foreground underline underline-offset-4 transition-colors"
            >
              Source code
            </a>
          </div>
          <div class="text-foreground/50 font-sans text-xs tabular-nums">
            {{ platformLabel }} · v{{ version }}
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>

<style>
@reference '../style.css';

/* About has no floating top chrome — zero out scroll-padding-top so
   #features anchors land flush at the viewport top with no inset.
   :has() gates on about being mounted (root has data-route="about"),
   so this naturally turns off when navigating away. */
html:has([data-route='about']) {
  @apply scroll-pt-0;
}
</style>
