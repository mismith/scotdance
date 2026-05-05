<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import { CircleSlash, Home } from 'lucide-vue-next';

const props = defineProps<{
  title?: string;
  description?: string;
}>();

const route = useRoute();

const heading = computed(() => props.title ?? 'Page not found');
const message = computed(() => {
  if (props.description) return props.description;
  return `We couldn't find anything at ${route.fullPath}.`;
});
</script>

<template>
  <main class="flex-1 max-w-3xl w-full mx-auto p-4 flex items-center justify-center">
    <div class="flex flex-col items-center text-center gap-4 py-16">
      <CircleSlash class="size-16 text-muted-foreground" />
      <div class="space-y-1">
        <h2 class="text-lg font-semibold">{{ heading }}</h2>
        <p class="text-sm text-muted-foreground">{{ message }}</p>
      </div>
      <RouterLink
        :to="{ name: 'home' }"
        class="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
      >
        <Home class="size-4" />
        Go home
      </RouterLink>
    </div>
  </main>
</template>
