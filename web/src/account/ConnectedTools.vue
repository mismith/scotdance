<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ArrowUpRight, ExternalLink } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import Dialog from '@/components/Dialog.vue'
import { TOOLS, toolDate, type Audience, type ToolLink } from './tool-links'
const toolkitIcon = new URL('../../public/img/toolkit.png', import.meta.url).href
const props = defineProps<{
  load: () => Promise<{ tool: Audience; link: ToolLink }[]>
  signOut: (tool: Audience) => Promise<void>
}>()
const tools = ref<{ tool: Audience; link: ToolLink }[]>([])
const loading = ref(true)
const error = ref('')
const selected = ref<Audience | null>(null)
const busy = ref(false)
const actionError = ref('')
// Use the same source icons as ScotDance without copying its assets into Connect.
const icons: Partial<Record<Audience, string>> = {
  challenge: new URL('../../public/img/tools/challenge.svg', import.meta.url).href,
  binder: new URL('../../public/img/tools/binder.svg', import.meta.url).href,
  entries: new URL('../../public/img/tools/entries.svg', import.meta.url).href,
}
async function load() {
  error.value = ''
  try { tools.value = await props.load() }
  catch { error.value = 'Could not load connected tools.' }
  finally { loading.value = false }
}
function ask(tool: Audience) { actionError.value = ''; selected.value = tool }
async function signOut() {
  const tool = selected.value
  if (!tool || busy.value) return
  busy.value = true
  actionError.value = ''
  try {
    await props.signOut(tool)
    tools.value = tools.value.filter(item => item.tool !== tool)
    selected.value = null
  } catch (e) { actionError.value = e instanceof Error ? e.message : 'Please try again.' }
  finally { busy.value = false }
}
onMounted(load)
</script>
<template>
  <section class="space-y-2 pt-3" aria-labelledby="connected-tools-title">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 id="connected-tools-title" class="text-title">Connected tools</h2>
        <p class="text-sm text-muted-foreground">Tools you sign in to with your ScotDance.app account.</p>
      </div>
      <a href="https://toolkit.scotdance.app" target="_blank" rel="noopener noreferrer"
        class="focus-inset inline-flex min-h-11 shrink-0 items-center gap-3 rounded-full bg-foreground/5 px-3 py-1.5 ring-1 ring-foreground/10 transition-colors hover:bg-foreground/10">
        <img :src="toolkitIcon" alt="" class="size-7 rounded-md" />
        <span class="flex flex-col items-start -space-y-0.5">
          <span class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Explore the</span>
          <span class="text-base font-semibold text-foreground">ScotDance Toolkit<span class="text-primary" aria-hidden="true">.</span></span>
        </span>
        <ArrowUpRight class="size-4 text-muted-foreground" aria-label="Opens in a new tab" />
      </a>
    </div>
    <div v-if="loading" role="status" aria-label="Loading connected tools" aria-busy="true" class="space-y-3 py-2">
      <div v-for="n in 3" :key="n" aria-hidden="true" class="flex h-14 items-center gap-3 motion-safe:animate-pulse"><span class="size-10 rounded-xl bg-muted" /><span class="h-4 w-36 rounded bg-muted" /></div>
    </div>
    <p v-else-if="error" role="alert" class="text-sm text-destructive">{{ error }} <Button variant="plain" @click="load">Try again</Button></p>
    <ul v-else-if="tools.length" class="rows-engraved -mx-4 [--inset:4.25rem] [--inset-end:1rem]">
      <li v-for="{ tool, link } in tools" :key="tool" class="flex min-h-16 items-center gap-2 py-1 pr-2 pl-4">
        <a :href="`https://${TOOLS[tool].hostname}`" target="_blank" rel="noopener" class="press-row focus-inset flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-xl">
          <img :src="icons[tool]" alt="" class="size-10 shrink-0 rounded-[0.625rem]" />
          <span class="min-w-0 flex-1">
            <span class="text-primary flex items-center gap-1 text-base font-semibold"><span class="truncate">{{ TOOLS[tool].name }}</span><ExternalLink class="size-3.5 shrink-0" aria-label="Opens in a new tab" /></span>
            <span v-if="link.signedInAt" class="block truncate text-sm text-muted-foreground">Signed in {{ toolDate(link.signedInAt) }}</span>
          </span>
        </a>
        <Button variant="plain" class="shrink-0 text-destructive!" :aria-label="`Sign out of ${TOOLS[tool].name}`" @click="ask(tool)">Sign out</Button>
      </li>
    </ul>
    <p v-else class="py-3 text-sm text-muted-foreground">No connected tools yet.</p>
    <Dialog v-if="selected" :open="true" :closable="!busy" @close="!busy && (selected = null)">
      <div class="space-y-4">
        <h3 class="text-heading pr-10">Sign out of {{ TOOLS[selected].name }}?</h3>
        <p class="text-sm text-muted-foreground">You’ll be signed out on every device within an hour. Your data in {{ TOOLS[selected].name }} stays there. You can sign in again anytime.</p>
        <p v-if="actionError" role="alert" class="text-sm text-destructive">{{ actionError }}</p>
        <div class="flex justify-end gap-2"><Button variant="plain" :disabled="busy" @click="selected = null">Cancel</Button><Button variant="destructive" :busy="busy" @click="signOut">Sign out</Button></div>
      </div>
    </Dialog>
  </section>
</template>
