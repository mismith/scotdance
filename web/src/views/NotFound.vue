<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { CircleSlash, Home } from '@lucide/vue'

const props = defineProps<{
  title?: string
  description?: string
}>()

const route = useRoute()

const heading = computed(() => props.title ?? 'Page not found')
const message = computed(() => {
  if (props.description) return props.description
  return `We couldn't find anything at ${route.fullPath}.`
})
</script>

<template>
  <main class="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center p-4">
    <div class="flex flex-col items-center gap-4 py-16 text-center">
      <CircleSlash class="text-muted-foreground size-16" />
      <div class="space-y-1">
        <h2 class="text-lg font-semibold">{{ heading }}</h2>
        <p class="text-muted-foreground text-sm">{{ message }}</p>
      </div>
      <RouterLink
        :to="{ name: 'home' }"
        class="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium hover:opacity-90"
      >
        <Home class="size-4" />
        Go home
      </RouterLink>
    </div>
  </main>
</template>
