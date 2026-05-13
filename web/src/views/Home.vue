<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { CalendarDays, ChevronDown, ChevronRight, Trophy, Users } from '@lucide/vue'
import { PLATFORM } from '@/composables/useUpdate'
import { version } from '../../package.json'

const platformLabel =
  PLATFORM === 'ios' ? 'iOS' : PLATFORM === 'android' ? 'Android' : 'Web'
const isWeb = PLATFORM === 'web'

const features = [
  {
    n: '01',
    icon: Users,
    title: 'Dancers',
    body: 'Search by number, name, or age group. Mark favourites for quick access throughout the day.',
  },
  {
    n: '02',
    icon: CalendarDays,
    title: 'Schedule',
    body: 'Event start times, platform assignments, and the order of dances — at a glance.',
  },
  {
    n: '03',
    icon: Trophy,
    title: 'Results',
    body: 'Callbacks and placings, posted as they are announced. Archived for review after the competition.',
  },
]

const faqs: { q: string; a: string }[] = [
  {
    q: 'Is there a cost associated with using this site/app at my local competition?',
    a: 'No! All competition data is user-submitted—and you can use it as a competition organizer or competition attendee for free anywhere in the world. There is no plan for this to ever change.',
  },
  {
    q: 'Is ScotDance.app affiliated with any association, organization, governing body, or particular competition(s)?',
    a: 'No, it is a completely independent, not-for-profit, volunteer run endeavour.',
  },
  {
    q: 'Do I need to download or install anything to get access?',
    a: 'No, it\'s entirely optional to use the App/Play Store distributed apps; everything works exactly the same in a web browser on whatever device(s) you own (e.g. by visiting <a href="http://www.scotdance.app" class="underline underline-offset-4">www.scotdance.app</a>). Of course, it\'s handy to have a dedicated place for easy access, so installing a mobile app makes that possible.',
  },
  {
    q: 'Is it safe to use? Are you harvesting my data? Are there privacy concerns with having this information available online?',
    a: 'This service is, in plain words, completely legitimate. It checks all the security boxes you would/should expect, and does nothing remotely nefarious with the (minimal) data it does collect from you. Furthermore, since all competition data is user-submitted, it\'s conceptually equivalent to uploading scanned or exported results PDFs to a dance association\'s website—just made more convenient, hopefully. You can also read more details on the <a href="/policies" class="underline underline-offset-4">Policies</a> page.',
  },
  {
    q: "Why are dancers I've favourited ★ in one competition not favourited in all competitions?",
    a: 'Since dancer numbers are unique for each competition—and names, locations, and ages can be misspelled or change over time—it\'s very difficult (for a computer) to distinguish "Jane Doe" in Competition A from "Jane Doe" in Competition B. So until this app can be connected more directly to registrations, it\'s unfortunately necessary to re-favourite dancers for each competition.',
  },
]

const featuresRef = ref<HTMLElement | null>(null)
function scrollToFeatures(e: Event) {
  e.preventDefault()
  featuresRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <div class="flex flex-1 flex-col" data-route="home">
    <!-- HERO -->
    <section class="relative flex min-h-svh flex-col items-center justify-center px-6">
      <header
        class="absolute inset-x-0 top-0 flex flex-col items-center gap-2 pt-8 text-center"
      >
        <img src="/img/touchicon.png" alt="" class="size-10 rounded-md shadow-sm" />
        <div class="text-lg">ScotDance.app</div>
      </header>

      <div class="mb-32 space-y-5 text-center">
        <h1 class="text-6xl font-medium tracking-tight md:text-8xl">
          Highland dance,<br />tracked.
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
        <header class="mb-16 max-w-2xl space-y-4">
          <div class="text-foreground/65 text-eyebrow text-xs">What it does</div>
          <h2 class="text-4xl font-medium tracking-tight md:text-5xl">
            A virtual program of events, in your pocket.
          </h2>
          <p class="text-muted-foreground text-lg md:text-xl">
            Schedules, dancers, and results in a single place — kept in sync as the day
            unfolds.
          </p>
        </header>

        <div class="grid gap-12 md:grid-cols-3 md:gap-10">
          <article
            v-for="f in features"
            :key="f.n"
            class="border-border/60 flex flex-col gap-4 border-t pt-6"
          >
            <div class="flex items-baseline justify-between">
              <span
                class="text-foreground/40 text-3xl font-medium tracking-tight tabular-nums"
              >
                {{ f.n }}
              </span>
              <component :is="f.icon" class="text-primary size-6" />
            </div>
            <h3 class="text-2xl font-medium tracking-tight md:text-3xl">
              {{ f.title }}
            </h3>
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
          <div class="text-foreground/65 text-eyebrow text-xs">Take it with you</div>
          <h2 class="text-4xl font-medium tracking-tight md:text-5xl">
            From the warm-up to the awards.
          </h2>
          <p class="text-muted-foreground mx-auto max-w-xl text-lg md:text-xl">
            Install it on your phone for one-tap access — or just bookmark it in any
            browser.
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
          class="text-foreground/70 hover:text-foreground inline-flex items-center gap-1 text-sm font-medium transition-colors"
        >
          Continue in your browser
          <ChevronRight class="size-4" />
        </RouterLink>
      </div>
    </section>

    <!-- FAQ -->
    <section class="border-border/60 border-t px-6 py-24 md:py-32">
      <div class="mx-auto w-full max-w-3xl">
        <header class="mb-12 space-y-4">
          <div class="text-foreground/65 text-eyebrow text-xs">Common questions</div>
          <h2 class="text-4xl font-medium tracking-tight md:text-5xl">FAQs</h2>
        </header>

        <dl class="border-border/60 border-t">
          <details
            v-for="(item, i) in faqs"
            :key="i"
            class="border-border/60 group border-b"
          >
            <summary
              class="flex cursor-pointer list-none items-baseline gap-4 py-6 [&::-webkit-details-marker]:hidden"
            >
              <span class="text-foreground/40 w-8 shrink-0 font-medium tabular-nums">
                {{ String(i + 1).padStart(2, '0') }}
              </span>
              <dt class="flex-1 text-xl font-medium tracking-tight md:text-2xl">
                {{ item.q }}
              </dt>
              <ChevronDown
                class="text-muted-foreground mt-1 size-5 shrink-0 transition-transform group-open:rotate-180"
              />
            </summary>
            <dd
              class="text-muted-foreground pr-9 pb-6 pl-12 leading-relaxed"
              v-html="item.a"
            />
          </details>
        </dl>
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
          <p class="text-muted-foreground max-w-md text-base leading-relaxed">
            A volunteer-run project for the highland dance community, by
            <a
              href="https://mismith.io"
              target="_blank"
              rel="noopener"
              class="text-foreground hover:text-primary underline-offset-4 hover:underline"
              >Murray Rowan</a
            >, since 2017.
          </p>
        </div>

        <div class="text-muted-foreground flex flex-col text-sm md:items-end">
          <RouterLink
            :to="{ name: 'policies' }"
            class="hover:text-foreground transition-colors"
          >
            Policies
          </RouterLink>
          <a
            href="https://github.com/mismith/scotdance"
            target="_blank"
            rel="noopener"
            class="hover:text-foreground transition-colors"
          >
            Source code
          </a>
          <div class="text-foreground/50 font-sans text-xs tabular-nums">
            {{ platformLabel }} · v{{ version }}
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>
