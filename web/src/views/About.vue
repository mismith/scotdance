<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { CalendarDays, ChevronDown, GraduationCap, Heart, Link, Search, Star, Trophy, Users } from '@lucide/vue'
import AppBar from '@/components/nav/AppBar.vue'
import { useCrisp } from '@/composables/useCrisp'
import { PLATFORM } from '@/composables/useUpdate'
import { version } from '../../package.json'

// About ScotDance, organised by who it's for. The common questions keep
// their #faq-… links so older shared links still land on the right answer.
const crisp = useCrisp()
const isWeb = PLATFORM === 'web'
const platformLabel = PLATFORM === 'ios' ? 'iOS' : PLATFORM === 'android' ? 'Android' : 'Web'

const roles = [
  {
    icon: Heart,
    title: 'Parents',
    points: [
      'Follow your dancers and see their day on Home: platform, dancing order, placings',
      'Placings as soon as they’re posted, with an alert while the app is open',
      'Every competition they’ve danced at, in one place',
      'Link your dancer and add the tartan they dance in',
    ],
  },
  {
    icon: Star,
    title: 'Dancers',
    points: ['Your schedule and results, without the paper', 'Look back at every competition you’ve danced'],
  },
  {
    icon: GraduationCap,
    title: 'Teachers',
    points: ['Follow a whole class and see everyone at a glance', 'Who’s dancing next, and where'],
  },
  {
    icon: CalendarDays,
    title: 'Organisers',
    points: ['Publish dancers, schedule and results for free', 'Parents stop asking “when is she on?”'],
  },
]

const steps = [
  { icon: Search, title: 'Find your dancer', body: 'Search by name, or type the number on their card.' },
  { icon: Star, title: 'Tap Follow', body: 'Their day appears on Home, and in every competition they enter.' },
  { icon: Trophy, title: 'Watch it come in', body: 'Placings appear as they’re entered, with an alert while the app is open.' },
]

const faqs: { id: string; q: string; a?: string }[] = [
  {
    id: 'free',
    q: 'Does it cost anything?',
    a: 'No. ScotDance is free for families, dancers, teachers and organisers anywhere in the world, and there are no plans to change that.',
  },
  {
    id: 'results',
    q: 'Where do the results come from?',
    a: 'Organisers and scrutineers enter them at the competition. They appear here as soon as they’re entered, which can be a little after they’re announced.',
  },
  {
    id: 'worldwide',
    q: 'Can I use it in any country?',
  },
  {
    id: 'independence',
    q: 'Is ScotDance part of an association or governing body?',
    a: 'No. It’s independent, not-for-profit and run by a volunteer.',
  },
  {
    id: 'download',
    q: 'Do I need to install anything?',
    a: 'No. Everything works the same in a web browser at <a href="https://scotdance.app" class="text-primary underline">scotdance.app</a>. The App Store and Google Play apps are there if you’d like it on your home screen.',
  },
  {
    id: 'privacy',
    q: 'Is my information safe?',
    a: 'Yes. ScotDance collects very little about you, and doesn’t sell or share it. Competition information comes from organisers, much like a results sheet posted online. The <a href="/policies" class="text-primary underline">privacy and terms</a> page has the details.',
  },
]

const route = useRoute()
const router = useRouter()
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
function linkTo(id: string) {
  router.replace({ hash: `#faq-${id}` })
}
onMounted(() => applyHash(route.hash))
watch(() => route.hash, applyHash)
</script>

<template>
  <div class="flex flex-1 flex-col pb-[calc(var(--chrome-bottom)+1.5rem)]">
    <AppBar title="About ScotDance" :fallback="{ to: { name: 'more' }, label: 'More' }" />

    <main class="mx-auto w-full max-w-3xl space-y-8 px-4 pt-[calc(var(--chrome-top)+0.5rem)]">
      <header class="space-y-3">
        <img src="/img/touchicon.png" alt="" class="size-14 rounded-2xl shadow-sm" />
        <h1 class="text-display">Highland dance competitions, dancers and results, in one place.</h1>
        <p class="text-muted-foreground text-base">
          Free, independent and run by a volunteer since 2017.
        </p>
        <RouterLink
          :to="{ name: 'home' }"
          class="bg-primary text-primary-foreground inline-flex h-12 items-center gap-2 rounded-xl px-5 text-base font-bold"
        >
          <Users class="size-5" /> Go to your dancers
        </RouterLink>
      </header>

      <section class="space-y-3">
        <h2 class="text-title">Made for</h2>
        <div class="grid gap-3 sm:grid-cols-2">
          <article v-for="r in roles" :key="r.title" class="bg-card space-y-2 rounded-2xl border p-4 shadow-sm">
            <h3 class="text-heading flex items-center gap-2">
              <component :is="r.icon" class="text-primary size-5" /> {{ r.title }}
            </h3>
            <ul class="text-muted-foreground list-disc space-y-1 pl-5 text-[0.9375rem] marker:text-primary">
              <li v-for="p in r.points" :key="p">{{ p }}</li>
            </ul>
          </article>
        </div>
      </section>

      <section class="space-y-3">
        <h2 class="text-title">On competition day</h2>
        <ol class="space-y-2">
          <li v-for="(s, i) in steps" :key="s.title" class="bg-card flex items-start gap-3 rounded-2xl border p-4 shadow-sm">
            <span class="bg-primary text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-full text-base font-extrabold">
              {{ i + 1 }}
            </span>
            <span>
              <b class="block text-base">{{ s.title }}</b>
              <span class="text-muted-foreground text-[0.9375rem]">{{ s.body }}</span>
            </span>
          </li>
        </ol>
      </section>

      <section v-if="isWeb" class="bg-card space-y-3 rounded-2xl border p-4 text-center shadow-sm">
        <h2 class="text-heading">Get the app</h2>
        <p class="text-muted-foreground text-[0.9375rem]">Or keep using it here in your browser. It’s the same either way.</p>
        <div class="flex flex-wrap justify-center gap-3">
          <a href="https://apps.apple.com/us/app/scotdance/id1386475626" target="_blank" rel="noopener" aria-label="Download on the App Store">
            <img src="/img/app-store.svg" alt="Download on the App Store" class="h-11" />
          </a>
          <a href="https://play.google.com/store/apps/details?id=info.mismith.scotdance" target="_blank" rel="noopener" aria-label="Get it on Google Play">
            <img src="/img/play-store.svg" alt="Get it on Google Play" class="h-11" />
          </a>
        </div>
      </section>

      <section id="faqs" class="scroll-mt-(--chrome-top) space-y-3">
        <h2 class="text-title">Questions and answers</h2>
        <ul class="bg-card divide-y overflow-hidden rounded-2xl border shadow-sm">
          <li v-for="f in faqs" :id="`faq-${f.id}`" :key="f.id" class="scroll-mt-[calc(var(--chrome-top)+0.5rem)]">
            <div class="flex items-center">
              <button
                type="button"
                class="flex min-h-14 flex-1 items-center gap-3 py-3 pl-4 text-left"
                :aria-expanded="open.has(f.id)"
                :aria-controls="`faq-panel-${f.id}`"
                @click="toggle(f.id)"
              >
                <span class="flex-1 text-base font-bold">{{ f.q }}</span>
                <ChevronDown :class="['text-muted-foreground size-5 shrink-0 transition-transform', open.has(f.id) && 'rotate-180']" />
              </button>
              <button
                type="button"
                class="text-muted-foreground flex size-11 shrink-0 items-center justify-center"
                :aria-label="`Link to this answer`"
                @click="linkTo(f.id)"
              >
                <Link class="size-4" />
              </button>
            </div>
            <div v-if="open.has(f.id)" :id="`faq-panel-${f.id}`" class="text-muted-foreground px-4 pb-4 text-[0.9375rem] leading-relaxed">
              <template v-if="f.id === 'worldwide'">
                Yes, anywhere in the world. If there’s something that would help where you dance,
                <button v-if="crisp.available" type="button" class="text-primary font-bold underline" @click="crisp.open()">get in touch</button><template v-else>get in touch</template>.
              </template>
              <span v-else v-html="f.a" />
            </div>
          </li>
        </ul>
      </section>

      <footer class="text-muted-foreground space-y-2 pb-4 text-center text-sm">
        <p>
          Made by <a href="https://mismith.io" target="_blank" rel="noopener" class="text-primary font-bold">Murray Rowan</a>
          for the Highland dance community.
        </p>
        <p class="flex flex-wrap justify-center gap-x-3">
          <button v-if="crisp.available" type="button" class="text-primary font-bold" @click="crisp.open()">Help</button>
          <RouterLink :to="{ name: 'policies' }" class="text-primary font-bold">Privacy and terms</RouterLink>
          <a href="https://github.com/mismith/scotdance" target="_blank" rel="noopener" class="text-primary font-bold">Source code</a>
        </p>
        <p class="tabular-nums">{{ platformLabel }} · v{{ version }}</p>
      </footer>
    </main>
  </div>
</template>
