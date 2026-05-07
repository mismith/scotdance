<script setup lang="ts">
defineProps<{
  open: boolean
  openClass?: string
}>()

const baseClasses =
  'overflow-hidden [interpolate-size:allow-keywords] h-0 transition-[height] supports-[height:calc-size(auto,size)]:h-0'

const expandedClasses =
  'h-auto supports-[height:calc-size(auto,size)]:h-[calc-size(auto,size)]'
</script>

<template>
  <div
    :inert="!open"
    :class="[baseClasses, open && expandedClasses, open && openClass]"
  >
    <slot />
  </div>
</template>
