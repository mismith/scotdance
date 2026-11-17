<script setup lang="ts">
defineProps<{ owners: { uid: string; name: string }[] }>()
function initials(name: string) {
  return name.trim().split(/\s+/).map(part => Array.from(part)[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?'
}
</script>
<template>
  <span v-if="owners.length > 1" class="flex shrink-0 -space-x-2" :aria-label="`Shared with ${owners.length} accounts`" :title="owners.map(owner => owner.name).join(', ')">
    <span v-for="(person, index) in owners.slice(0, 3)" :key="person.uid"
      class="border-background grid size-7 shrink-0 place-items-center rounded-full border-2 text-[10px] font-semibold"
      :class="index % 2 ? 'bg-stone-200 text-stone-700 dark:bg-stone-700 dark:text-stone-200' : 'bg-blue-paper text-primary'"
      aria-hidden="true">{{ initials(person.name) }}</span>
    <span v-if="owners.length > 3" class="bg-blue-paper text-primary border-background grid h-7 min-w-7 shrink-0 place-items-center rounded-full border-2 px-1 text-[10px] font-semibold" aria-hidden="true">+{{ owners.length - 3 }}</span>
  </span>
</template>
