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
  { piece: 'favourite', title: 'Favourite your dancers', body: 'Your own, or your whole studio, at a glance on Home.' },
  { piece: 'number', title: 'Know when they’re on', body: 'Their platform, dancing order and session, straight from the organisers’ schedule.' },
  { piece: 'ribbon', title: 'Results as they happen', body: 'Placings show up as soon as they’re entered, even when you can’t be there.' },
  { piece: 'record', title: 'Every result, on record', body: 'All their placings, season after season.' },
] as const

// Answers are HTML, a <p> per paragraph.
const faqs: { id: string; q: string; a?: string }[] = [
  {
    id: 'free',
    q: 'Does it cost anything?',
    a: '<p>No! It’s free for families and organisers alike, anywhere in the world, and there’s no plan for that to ever change.</p><p>There are no ads, no subscriptions and no paid extras. Everyone gets everything, whether you’re following one dancer or running a whole competition. It’s a not-for-profit, volunteer-run project, and its code is open for anyone to read on <a href="https://github.com/mismith/scotdance" target="_blank" rel="noopener" class="text-primary underline">GitHub</a>.</p>',
  },
  {
    id: 'worldwide',
    q: 'Can I use it in any country?',
  },
  {
    id: 'download',
    q: 'Do I need to download anything?',
    a: '<p>No. Everything works in any web browser at <a href="https://scotdance.app" class="text-primary underline">scotdance.app</a>, on a phone, tablet or computer, with nothing to install.</p><p>The App Store and Google Play apps are optional, but handy: ScotDance.app sits on your home screen, opens straight to your dancers, and can send a notification the moment they place, even when it’s closed. A browser can only show new placings while the page is open.</p><p>Sign in with the same account on each device and your favourites come with you.</p>',
  },
  {
    id: 'alerts',
    q: 'Can I get an alert when my dancer places?',
    a: '<p>Yes. Sign in, find your dancer and tap Favourite. Every dancer you favourite gets alerts, and the bell beside Favourite turns them off (or back on) for just that dancer.</p><p>In the App Store and Google Play apps, turn on Notifications in Settings, then choose which ones you want: <strong>Results</strong>, the moment your dancers’ placings are posted; <strong>Morning of</strong>, who’s dancing today, first thing on competition day; and <strong>Dancer list is up</strong>, when a competition you get alerts for posts its dancers and schedule.</p><p>In a web browser, a banner pops up when one of your dancers places, as long as ScotDance.app is open.</p>',
  },
  {
    id: 'results',
    q: 'Where do the schedules and results come from?',
    a: '<p>From each competition’s own organisers. They add the competition, import their entry list, build the schedule and enter the results on the day, so what you see matches the program and what’s announced.</p><p>Results show up as soon as they’re entered. At most competitions that’s soon after they’re read out, but it’s up to the organisers: some enter them as the day goes, others afterwards. Some don’t add a schedule, and a few choose not to share results here at all.</p><p>If a name, number or placing looks wrong, the competition’s organisers can fix it. Let them know, and once it’s fixed it changes for everyone.</p>',
  },
  {
    id: 'add',
    q: 'My competition isn’t here. Can it be added?',
    a: '<p>Yes, for free. Its organisers, or someone helping them, can add it from <a href="/competitions/add" class="text-primary underline">Add a competition</a>: a few questions about when and where it is, and who runs it. Many go live straight away; others just need a quick look first, and you’ll hear by email once it’s live.</p><p>From there it’s theirs to run. They can invite other admins, import the entry list from a spreadsheet (which sets up the categories and age groups too), build the schedule platform by platform, and post results on the day. It can stay private until it’s ready.</p><p>If you’re a parent, dancer or teacher, pass the link along to your organisers.</p>',
  },
  {
    id: 'independence',
    q: 'Is ScotDance.app affiliated with any association, governing body or competition?',
    a: '<p>No, it’s completely independent: a not-for-profit, volunteer-run endeavour, built by a Highland dance family. No association, governing body or competition runs it, pays for it or decides what goes in it.</p><p>Each competition’s details and results come from its own organisers, who choose to add it here.</p>',
  },
  {
    id: 'favourites',
    q: 'Can anyone see which dancers I’ve favourited?',
    a: '<p>No. Your favourites, and the colours or tartans you choose for them, are private to your account. Nobody else can see who you follow, not the dancers, their teachers or the organisers.</p><p>They’re saved with your account, so they’re the same on every device you sign in on.</p>',
  },
  {
    id: 'privacy',
    q: 'Is it safe to use? What about privacy?',
    a: '<p>Yes, it’s completely legitimate. ScotDance.app isn’t a business and never will be. It’s free, it has no ads and nothing to upsell, and nobody’s information is ever sold, shared or used to make money. It was built by a Highland dance family, and it’s kept running for the community, not for profit.</p><p>It checks all the security boxes you’d expect: every connection is encrypted, and your email address and favourites can only be read by you.</p><p>Organisers enter the same details that are already in the program and the results they post afterwards: names, competitor numbers, towns, age groups and placings. The difference is it’s all in one place, so each dancer’s results gather onto one profile, season after season. It never asks for a birthdate, address or school, and search engines are asked not to list dancer pages.</p><p>Your own account is just an email address and a password, plus a display name if you want one. You can delete it, and everything that goes with it, any time from your Account page. There’s more on the <a href="/policies" class="text-primary underline">privacy and terms</a> page.</p>',
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
          Browse competitions, favourite your dancers, and see results as they happen. Free, anywhere in the world.
        </p>
        <RouterLink
          :to="{ name: 'home' }"
          class="bg-primary-foreground text-primary-fill press mt-4 inline-flex h-12 items-center gap-2 rounded-full px-5 text-base font-semibold"
        >
          <Users class="size-5" /> Go to your dancers
        </RouterLink>
      </header>

      <section class="space-y-3">
        <h2 class="text-section">For families</h2>
        <ul class="rows-engraved -mx-4 [--inset:5.75rem] [--inset-end:1rem]">
          <li v-for="f in forFamilies" :key="f.title" class="flex items-center gap-4 px-4 py-3">
            <span class="flex w-15 shrink-0 justify-center" aria-hidden="true">
              <Medal v-if="f.piece === 'ribbon'" :place="1" />
              <NumberCard v-else-if="f.piece === 'number'" number="107" color="var(--dancer-1)" size="sm" />
              <span v-else-if="f.piece === 'favourite'" class="bg-blue-paper flex size-11 items-center justify-center rounded-full">
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
        <h2 class="text-section">For organisers</h2>
        <div class="space-y-3">
          <p class="text-base">
            <span class="font-semibold">Run the day without the paper.</span>
            Build the schedule, import your dancers and post results as they’re announced. It keeps every result on record for later. Free, for any competition.
          </p>
          <RouterLink
            :to="{ name: 'competitions.add' }"
            class="bg-blue-paper text-primary press inline-flex h-11 items-center gap-2 rounded-full px-4 text-base font-semibold"
          >
            <SquarePlus class="size-5" /> Add a competition
          </RouterLink>
        </div>
      </section>

      <section v-if="isWeb" class="space-y-3">
        <h2 class="text-section">Get the app</h2>
        <p class="text-muted-foreground text-callout">Install it on your phone, or just bookmark it in any browser.</p>
        <div class="flex flex-wrap gap-3">
          <a href="https://apps.apple.com/us/app/scotdance/id1386475626" target="_blank" rel="noopener" aria-label="Download on the App Store" class="press rounded-lg">
            <img src="/img/app-store.svg" alt="Download on the App Store" class="h-12" />
          </a>
          <a href="https://play.google.com/store/apps/details?id=info.mismith.scotdance" target="_blank" rel="noopener" aria-label="Get it on Google Play" class="press rounded-lg">
            <img src="/img/play-store.svg" alt="Get it on Google Play" class="h-12" />
          </a>
        </div>
      </section>

      <section id="faqs" class="scroll-mt-(--chrome-top) space-y-3">
        <h2 class="text-section">Questions and answers</h2>
        <ul class="rows-engraved -mx-4 [--inset:1rem] [--inset-end:1rem]">
          <li v-for="f in faqs" :id="`faq-${f.id}`" :key="f.id" class="scroll-mt-[calc(var(--chrome-top)+0.5rem)]">
            <button
              type="button"
              class="press-row focus-inset flex min-h-14 w-full items-center gap-3 py-3 pr-3 pl-4 text-left"
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
                <div v-if="f.id === 'worldwide'" class="space-y-3 pb-4">
                  <p>Yes, anywhere in the world. Any competition, in any country, can be added for free, and families anywhere can follow along.</p>
                  <p>
                    If you’d like to bring it to your country, city or town, please
                    <button v-if="crisp.available" type="button" class="text-primary font-semibold underline" @click="crisp.open()">get in touch</button><template v-else>get in touch</template>
                    for a hand getting your first competition set up.
                  </p>
                </div>
                <div v-else class="space-y-3 pb-4" v-html="f.a" />
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
