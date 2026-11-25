<script setup lang="ts">
// The public help article for AI assistants (ADR 0018): the documentation link both AI app directories ask for.
import AppBar from '@/components/nav/AppBar.vue'
import { useCrisp } from '@/composables/useCrisp'
import { assistantAddress, assistantListings } from '@/lib/assistants'
import { ChevronDown, ClipboardList, Copy, FileSpreadsheet, History, Image, Megaphone, Shuffle, Trophy } from '@lucide/vue'
import { ref } from 'vue'
import { RouterLink } from 'vue-router'

const crisp = useCrisp()
const address = assistantAddress()
const link = 'hover:text-foreground underline underline-offset-4'

// Each is a real job that takes an organiser an evening by hand: the assistant reads the paper, ScotDance.app gets the data
const ideas = [
  {
    icon: Image,
    ask: '“Here’s a photo of the scrutineer’s sheet. Enter the Premier 14 & Under 16 results.”',
    does: 'Reads every placing off the photo, reads them back to you, then posts them.',
  },
  {
    icon: Shuffle,
    ask: '“Draw every age group at random. Keep the reels in number order.”',
    does: 'A fresh dancing order for every dance in every age group, in one go.',
  },
  {
    icon: FileSpreadsheet,
    ask: '“Here are this year’s entries” (a spreadsheet, PDF or photo of the forms)',
    does: 'Turns it into an entry list you check and import, numbers and age groups included.',
  },
  {
    icon: ClipboardList,
    ask: '“Set up the age groups and dances from last year’s program.”',
    does: 'Categories, age bands, steps and trophies, read from the PDF and saved in order.',
  },
  {
    icon: Trophy,
    ask: '“Who’s still missing results, and which age groups have no callbacks yet?”',
    does: 'Checks every age group and dance so nothing is missed before the awards.',
  },
  {
    icon: Megaphone,
    ask: '“Add our competition from this poster.”',
    does: 'Date, venue and organisation read off the flyer and sent to ScotDance.app.',
  },
]

const showAddress = ref(false)
const copied = ref(false)
async function copy() {
  await navigator.clipboard?.writeText(address)
  copied.value = true
  setTimeout(() => (copied.value = false), 1600)
}
</script>

<template>
  <div class="flex flex-1 flex-col pb-[calc(var(--chrome-bottom)+1.5rem)]">
    <AppBar title="AI assistants" :fallback="{ to: { name: 'settings' }, label: 'Settings' }" />

    <main class="mx-auto w-full max-w-3xl space-y-8 px-4 pt-[calc(var(--chrome-top)+0.5rem)]">
      <header class="brand-panel rounded-3xl p-5">
        <div class="flex -space-x-2" aria-hidden="true">
          <span class="flex size-12 items-center justify-center rounded-full bg-white shadow-sm ring-2 ring-white/40">
            <img src="/img/assistants/claude.svg" alt="" class="size-7" />
          </span>
          <span class="flex size-12 items-center justify-center rounded-full bg-white shadow-sm ring-2 ring-white/40">
            <img src="/img/assistants/chatgpt.svg" alt="" class="size-7" />
          </span>
        </div>
        <h1 class="text-display mt-3 text-[1.5625rem] text-balance">Hand the paperwork to your AI.</h1>
        <p class="mt-2 text-base font-medium">
          Connect Claude or ChatGPT to the competitions you run. Show it a photo, a PDF or a spreadsheet, and it fills in
          ScotDance.app for you.
        </p>
        <div class="mt-4 flex flex-wrap gap-2">
          <a
            :href="assistantListings.claude"
            target="_blank"
            rel="noopener"
            class="bg-primary-foreground text-primary-fill press inline-flex h-12 items-center gap-2 rounded-full px-5 text-base font-semibold"
          >
            <img src="/img/assistants/claude.svg" alt="" class="size-5" /> Add to Claude
          </a>
          <a
            :href="assistantListings.chatgpt"
            target="_blank"
            rel="noopener"
            class="bg-primary-foreground text-primary-fill press inline-flex h-12 items-center gap-2 rounded-full px-5 text-base font-semibold"
          >
            <img src="/img/assistants/chatgpt.svg" alt="" class="size-5" /> Add to ChatGPT
          </a>
          <button
            type="button"
            class="press inline-flex h-12 items-center gap-2 rounded-full bg-white/15 px-5 text-base font-semibold"
            :aria-expanded="showAddress"
            aria-controls="connect-address"
            @click="showAddress = !showAddress"
          >
            Add to another AI app
            <ChevronDown
              :class="[
                'size-5 transition-transform duration-(--dur-slow) ease-snappy motion-reduce:transition-none',
                showAddress && 'rotate-180',
              ]"
            />
          </button>
        </div>
        <div
          id="connect-address"
          :inert="!showAddress"
          :class="[
            'grid transition-[grid-template-rows,opacity] duration-(--dur-slow) ease-snappy motion-reduce:transition-none',
            showAddress ? 'grid-rows-[1fr]' : 'grid-rows-[0fr] opacity-0',
          ]"
        >
          <div class="overflow-hidden">
            <div class="mt-4 space-y-3 rounded-2xl bg-black/15 p-4 text-base">
              <p>Add a custom connector (a remote MCP server) with this address:</p>
              <div class="flex items-center gap-2">
                <code class="min-w-0 flex-1 text-sm font-semibold break-all">{{ address }}</code>
                <button
                  type="button"
                  class="press inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-3 text-sm font-semibold"
                  @click="copy"
                >
                  <Copy class="size-4" /> {{ copied ? 'Copied' : 'Copy' }}
                </button>
              </div>
              <p class="text-sm opacity-80">Then sign in with your ScotDance.app account and press Allow.</p>
            </div>
          </div>
        </div>
        <p class="mt-3 text-sm opacity-80">
          In Claude or ChatGPT, look for <span class="font-semibold">ScotDance.app for Organisers</span>, then sign in with
          your ScotDance.app account and press Allow.
        </p>
      </header>

      <section id="ask" class="space-y-3">
        <h2 class="text-section">Things it does in minutes</h2>
        <ul class="rows-engraved -mx-4 [--inset:4.5rem] [--inset-end:1rem]">
          <li v-for="idea in ideas" :key="idea.ask" class="flex items-start gap-4 px-4 py-3">
            <span class="bg-blue-paper flex size-11 shrink-0 items-center justify-center rounded-full" aria-hidden="true">
              <component :is="idea.icon" class="text-primary size-5" />
            </span>
            <span>
              <span class="block text-base font-semibold">{{ idea.ask }}</span>
              <span class="text-muted-foreground text-callout">{{ idea.does }}</span>
            </span>
          </li>
        </ul>
        <p class="text-muted-foreground text-callout">
          Your AI reads the photo or file in the chat itself and sends ScotDance.app what it read. The file stays in
          your chat: judges’ sheets, photos and logos are still uploaded in the app.
        </p>
      </section>

      <section id="does" class="space-y-3">
        <h2 class="text-section">What it can and can’t do</h2>
        <div class="text-muted-foreground [&_:is(strong)]:text-foreground space-y-3 text-base leading-relaxed">
          <p>
            <strong>It sees and changes only what you can:</strong> the competitions and organisations you’re an admin
            of. It can change details, age groups, dances, trophy events, entries, staff, platforms, the schedule, draws
            and results, publish a competition, add one, or start an organisation.
          </p>
          <p>
            <strong>Changes are live at once.</strong> On a published competition they’re public, and results saved on
            the day send followers a push alert about a minute later.
          </p>
          <p>
            <strong>It can’t</strong> invite or remove admins: who runs a competition stays your call. It can’t delete a
            competition or an organisation, or link competitions, as those can’t be undone. And it can’t upload files,
            as AI apps don’t pass them on.
          </p>
        </div>
      </section>

      <section id="review" class="space-y-3">
        <h2 class="text-section">See what it changed</h2>
        <div class="flex items-start gap-4">
          <span class="bg-blue-paper flex size-11 shrink-0 items-center justify-center rounded-full" aria-hidden="true">
            <History class="text-primary size-5" />
          </span>
          <p class="text-muted-foreground text-base leading-relaxed">
            Ask it, or in <RouterLink :to="{ name: 'profile' }" :class="link">Account</RouterLink>, under AI assistants,
            tap one to see what it changed in the last 30 days, or Disconnect it. A connection ends after 60 days without
            use.
          </p>
        </div>
      </section>

      <section id="help" class="space-y-3">
        <h2 class="text-section">Help and privacy</h2>
        <p class="text-muted-foreground text-base leading-relaxed">
          <button v-if="crisp.available" type="button" :class="link" @click="crisp.open()">Chat with support</button>
          <template v-else>Chat from the app’s Help</template>, or email
          <a href="mailto:admin@scotdance.app" :class="link">admin@scotdance.app</a>. The assistant receives what it reads
          from your competitions, including dancers’ names and results:
          <RouterLink :to="{ name: 'policies', hash: '#ai' }" :class="link">privacy</RouterLink>.
        </p>
      </section>
    </main>
  </div>
</template>
