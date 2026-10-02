<script setup lang="ts">
import LogoMark from '@/components/LogoMark.vue'
import { nextTick, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { CalendarDays, ChevronDown, GraduationCap, Heart, Search, Star, Trophy, Users } from '@lucide/vue'
import AppBar from '@/components/nav/AppBar.vue'
import { useCrisp } from '@/composables/useCrisp'
import { platform } from '@/lib/native'
import { version } from '../../package.json'

// About ScotDance, organised by who it's for. The common questions keep
// their #faq-… links so older shared links still land on the right answer.
const crisp = useCrisp()
const isWeb = platform === 'web'
const year = new Date().getFullYear()
const platformLabel = platform === 'ios' ? 'iOS' : platform === 'android' ? 'Android' : 'Web'

// One line per role, about the same length, each in its own colour.
const roles = [
  { icon: Heart, title: 'Parents', color: 'var(--dancer-1)', line: 'Follow your dancers and see their results as they happen.' },
  { icon: Star, title: 'Dancers', color: 'var(--dancer-4)', line: 'Your schedule and results, without the paper.' },
  { icon: GraduationCap, title: 'Teachers', color: 'var(--dancer-2)', line: 'Follow your whole class and see everyone at a glance.' },
  { icon: CalendarDays, title: 'Organisers', color: 'var(--dancer-5)', line: 'Saves hours of work and paper, and keeps every result on record for later.' },
]

const steps = [
  { icon: Search, title: 'Find your dancer', body: 'Search by name or number, or browse by age group.' },
  { icon: Star, title: 'Tap Follow', body: 'Their day shows up on Home, and in every competition they enter.' },
  { icon: Trophy, title: 'Watch it come in', body: 'Callbacks and placings, posted as they’re announced.' },
]

const faqs: { id: string; q: string; a?: string }[] = [
  {
    id: 'free',
    q: 'Is there a cost to use it at my local competition?',
    a: 'No! All competition data is user-submitted, and you can use it as a competition organiser or attendee for free, anywhere in the world. There is no plan for this to ever change.',
  },
  {
    id: 'worldwide',
    q: 'Can I use this in any country?',
  },
  {
    id: 'independence',
    q: 'Is ScotDance.app affiliated with any association, governing body or competition?',
    a: 'No, it’s a completely independent, not-for-profit, volunteer-run endeavour.',
  },
  {
    id: 'download',
    q: 'Do I need to download or install anything?',
    a: 'No, the App Store and Google Play apps are entirely optional. Everything works exactly the same in a web browser on whatever device you own, at <a href="https://scotdance.app" class="text-primary underline">scotdance.app</a>. Of course, it’s handy to have it on your home screen, so the apps make that easy.',
  },
  {
    id: 'privacy',
    q: 'Is it safe to use? What about my data?',
    a: 'In plain words: yes, it’s completely legitimate. It checks all the security boxes you’d expect, and does nothing nefarious with the (minimal) data it collects. Since all competition data is user-submitted, it’s much like results PDFs posted on an association’s website, just more convenient, hopefully. There are more details on the <a href="/policies" class="text-primary underline">privacy and terms</a> page.',
  },
]

const route = useRoute()
const open = ref(new Set<string>())
const toggle = (id: string) => {
  const next = new Set(open.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  open.value = next
}
function applyHash(hash: string) {
  if (hash === '#faqs') {
    nextTick(() => document.getElementById('faqs')?.scrollIntoView({ block: 'start' }))
    return
  }
  const id = hash.match(/^#faq-(.+)$/)?.[1]
  if (!id || !faqs.some((f) => f.id === id)) return
  if (!open.value.has(id)) toggle(id)
  nextTick(() => document.getElementById(`faq-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}
onMounted(() => applyHash(route.hash))
watch(() => route.hash, applyHash)
</script>

<template>
  <div class="flex flex-1 flex-col pb-[calc(var(--chrome-bottom)+1.5rem)]">
    <AppBar title="About ScotDance.app" :fallback="{ to: { name: 'home' }, label: 'Home' }" />

    <main class="mx-auto w-full max-w-3xl space-y-8 px-4 pt-[calc(var(--chrome-top)+0.5rem)]">
      <header class="brand-panel relative overflow-hidden rounded-3xl p-5">
        <LogoMark class="pointer-events-none absolute -right-6 -bottom-10 size-52 rotate-[-8deg] opacity-[0.08]" />
        <img src="/img/touchicon.png" alt="" class="relative size-12 rounded-xl shadow-sm" />
        <h1 class="text-display relative mt-4 text-[1.5625rem] text-balance">From the <span class="whitespace-nowrap">warm-up</span> to the awards.</h1>
        <p class="relative mt-2 text-base font-medium opacity-90">
          Browse competitions, follow dancers, and see results as they happen. Free, anywhere in the world.
        </p>
        <RouterLink
          :to="{ name: 'home' }"
          class="bg-primary-foreground text-primary-fill press relative mt-4 inline-flex h-12 items-center gap-2 rounded-full px-5 text-base font-semibold"
        >
          <Users class="size-5" /> Go to your dancers
        </RouterLink>
      </header>

      <section class="space-y-3">
        <h2 class="text-title">Made for</h2>
        <div class="grid grid-cols-2 gap-3">
          <article v-for="r in roles" :key="r.title" class="surface space-y-2 rounded-2xl p-4">
            <component :is="r.icon" class="size-7" stroke-width="1.75" :style="{ color: r.color }" aria-hidden="true" />
            <h3 class="text-heading">{{ r.title }}</h3>
            <p class="text-callout leading-snug">{{ r.line }}</p>
          </article>
        </div>
      </section>

      <section class="space-y-3">
        <h2 class="text-title">On competition day</h2>
        <ol class="space-y-2">
          <li v-for="(s, i) in steps" :key="s.title" class="surface flex items-start gap-3 rounded-2xl p-4">
            <span class="bg-primary-fill text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-full text-base font-extrabold">
              {{ i + 1 }}
            </span>
            <span>
              <span class="block text-base font-semibold">{{ s.title }}</span>
              <span class="text-muted-foreground text-callout">{{ s.body }}</span>
            </span>
          </li>
        </ol>
      </section>

      <section v-if="isWeb" class="surface space-y-3 rounded-2xl p-4 text-center">
        <h2 class="text-heading">Get the app</h2>
        <p class="text-muted-foreground text-callout">Install it on your phone, or just bookmark it in any browser.</p>
        <div class="flex flex-wrap justify-center gap-3">
          <a href="https://apps.apple.com/us/app/scotdance/id1386475626" target="_blank" rel="noopener" aria-label="Download on the App Store" class="press rounded-lg">
            <img src="/img/app-store.svg" alt="Download on the App Store" class="h-12" />
          </a>
          <a href="https://play.google.com/store/apps/details?id=info.mismith.scotdance" target="_blank" rel="noopener" aria-label="Get it on Google Play" class="press rounded-lg">
            <img src="/img/play-store.svg" alt="Get it on Google Play" class="h-12" />
          </a>
        </div>
      </section>

      <section id="faqs" class="scroll-mt-(--chrome-top) space-y-3">
        <h2 class="text-title">Questions and answers</h2>
        <ul class="surface rows-inset overflow-hidden rounded-2xl">
          <li v-for="f in faqs" :id="`faq-${f.id}`" :key="f.id" class="scroll-mt-[calc(var(--chrome-top)+0.5rem)]">
            <button
              type="button"
              class="press-row focus-inset flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left"
              :aria-expanded="open.has(f.id)"
              :aria-controls="`faq-panel-${f.id}`"
              @click="toggle(f.id)"
            >
              <span class="flex-1 text-base font-medium">{{ f.q }}</span>
              <ChevronDown
                :class="[
                  'text-muted-foreground size-5 shrink-0 transition-transform duration-(--dur-slow) ease-snappy motion-reduce:transition-none',
                  open.has(f.id) && 'rotate-180',
                ]"
              />
            </button>
            <!-- The answer grows open, rather than snapping the page down. -->
            <div
              :id="`faq-panel-${f.id}`"
              :inert="!open.has(f.id)"
              :class="[
                'grid transition-[grid-template-rows,opacity] duration-(--dur-slow) ease-snappy motion-reduce:transition-none',
                open.has(f.id) ? 'grid-rows-[1fr]' : 'grid-rows-[0fr] opacity-0',
              ]"
            >
              <div class="text-muted-foreground text-callout overflow-hidden px-4 leading-relaxed">
                <p class="pb-4">
                  <template v-if="f.id === 'worldwide'">
                    Yes, anywhere in the world. Curiously, usage in the United States has been very light so far. If you’ve
                    got a theory why, please
                    <button v-if="crisp.available" type="button" class="text-primary font-semibold underline" @click="crisp.open()">get in touch</button><template v-else>get in touch</template>.
                  </template>
                  <span v-else v-html="f.a" />
                </p>
              </div>
            </div>
          </li>
        </ul>
      </section>

      <footer class="text-muted-foreground space-y-2 pb-4 text-center text-sm">
        <!-- Wraps at the comma, not mid-phrase -->
        <p><span class="inline-block">Built by a Highland dance family,</span> <span class="inline-block">for Highland dance families.</span></p>
        <p class="flex flex-wrap justify-center gap-x-3">
          <button v-if="crisp.available" type="button" class="text-primary py-2 font-semibold" @click="crisp.open()">Help</button>
          <RouterLink :to="{ name: 'policies' }" class="text-primary py-2 font-semibold">Privacy and terms</RouterLink>
          <a href="https://github.com/mismith/scotdance" target="_blank" rel="noopener" class="text-primary py-2 font-semibold">Source code</a>
        </p>
        <p>
          2017–{{ year }} · <a href="https://mur.bot" target="_blank" rel="noopener" class="hover:underline">Murray Rowan</a> · {{ platformLabel }} · v{{ version }}
        </p>
      </footer>
    </main>
  </div>
</template>
