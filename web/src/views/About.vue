<script setup lang="ts">
import LogoMark from '@/components/LogoMark.vue'
import { nextTick, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { ChevronDown, SquarePlus, Star, Users } from '@lucide/vue'
import Medal from '@/components/Medal.vue'
import NumberCard from '@/components/NumberCard.vue'
import AppBar from '@/components/nav/AppBar.vue'
import { useCrisp } from '@/composables/useCrisp'
import { platform } from '@/lib/native'
import { version } from '../../package.json'
import { smooth } from '@/lib/motion'

// About ScotDance, organised by who it's for: families, then organisers. The common questions keep
// their #faq-… links so older shared links still land on the right answer.
const crisp = useCrisp()
const isWeb = platform === 'web'
const year = new Date().getFullYear()
const platformLabel = platform === 'ios' ? 'iOS' : platform === 'android' ? 'Android' : 'Web'

// What families get, each beside the real thing they'll see in the app.
const forFamilies = [
  { piece: 'rosette', title: 'Results as they happen', body: 'Placings show up as soon as they’re entered. No more waiting by the results board.' },
  { piece: 'number', title: 'Know when they’re on', body: 'Their platform, dancing order and session, straight from the organisers’ schedule.' },
  { piece: 'follow', title: 'Follow your dancers', body: 'Your own, or your whole studio, at a glance on Home.' },
  { piece: 'record', title: 'Every result, on record', body: 'All their placings, season after season.' },
] as const

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
    q: 'Is it safe to use? What about privacy?',
    a: 'In plain words: yes, it’s completely legitimate. It checks all the security boxes you’d expect, and does nothing nefarious with the (minimal) data it collects. Competition data is entered by organisers: the same names, numbers, towns, age groups and results as the program and the results PDFs posted on an association’s website. The difference is it’s all in one place, so each dancer’s results are gathered onto one profile, season after season. Nothing like a birthdate, address or school is ever asked for, and search engines like Google are asked not to list dancer pages. There are more details on the <a href="/policies" class="text-primary underline">privacy and terms</a> page.',
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
  nextTick(() => document.getElementById(`faq-${id}`)?.scrollIntoView({ behavior: smooth(), block: 'start' }))
}
onMounted(() => applyHash(route.hash))
watch(() => route.hash, applyHash)
</script>

<template>
  <div class="flex flex-1 flex-col pb-[calc(var(--chrome-bottom)+1.5rem)]">
    <AppBar title="About ScotDance.app" :fallback="{ to: { name: 'home' }, label: 'Home' }" />

    <main class="mx-auto w-full max-w-3xl space-y-8 px-4 pt-[calc(var(--chrome-top)+0.5rem)]">
      <header class="brand-panel rounded-3xl p-5">
        <LogoMark class="size-16" />
        <h1 class="text-display mt-3 text-[1.5625rem] text-balance">From the <span class="whitespace-nowrap">warm-up</span> to the awards.</h1>
        <p class="mt-2 text-base font-medium">
          Browse competitions, follow dancers, and see results as they happen. Free, anywhere in the world.
        </p>
        <RouterLink
          :to="{ name: 'home' }"
          class="bg-primary-foreground text-primary-fill press mt-4 inline-flex h-12 items-center gap-2 rounded-full px-5 text-base font-semibold"
        >
          <Users class="size-5" /> Go to your dancers
        </RouterLink>
      </header>

      <section class="space-y-3">
        <h2 class="text-title">For families</h2>
        <ul class="surface rows-inset overflow-hidden rounded-2xl [--inset:5.5rem]">
          <li v-for="f in forFamilies" :key="f.title" class="flex items-center gap-4 px-4 py-3">
            <span class="flex w-15 shrink-0 justify-center" aria-hidden="true">
              <Medal v-if="f.piece === 'rosette'" :place="1" />
              <NumberCard v-else-if="f.piece === 'number'" number="107" color="var(--dancer-1)" size="sm" />
              <span v-else-if="f.piece === 'follow'" class="bg-blue-paper flex size-11 items-center justify-center rounded-full">
                <Star class="fill-secondary text-secondary size-6" />
              </span>
              <span v-else class="flex -space-x-2.5">
                <Medal :place="2" size="sm" />
                <Medal :place="1" size="sm" />
              </span>
            </span>
            <span>
              <span class="block text-base font-semibold">{{ f.title }}</span>
              <span class="text-muted-foreground text-callout">{{ f.body }}</span>
            </span>
          </li>
        </ul>
      </section>

      <section class="space-y-3">
        <h2 class="text-title">For organisers</h2>
        <div class="surface space-y-3 rounded-2xl p-4">
          <p class="text-base">
            <span class="font-semibold">Run the day without the paper.</span>
            Build the schedule, import your dancers and post results as they’re announced. It saves hours of work, and keeps every result on record for later. Free, for any competition.
          </p>
          <RouterLink
            :to="{ name: 'competitions.submit' }"
            class="bg-blue-paper text-primary press inline-flex h-11 items-center gap-2 rounded-full px-4 text-base font-semibold"
          >
            <SquarePlus class="size-5" /> Submit a competition
          </RouterLink>
        </div>
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
              <div class="text-muted-foreground overflow-hidden px-4 text-base leading-relaxed">
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
