<script setup lang="ts">
import { LoaderCircle } from '@lucide/vue'
import LogoMark from './LogoMark.vue'
defineProps<{ busy?: boolean }>()
</script>
<template>
  <!-- ADR 0015: the same branded sign-in control across ScotDance tools. -->
  <button type="button" :disabled="busy" :aria-busy="busy || undefined"
    class="press-fill relative inline-flex h-[52px] max-w-full items-center gap-[14px] rounded-full bg-[#1a6fd0] py-2 pr-[26px] pl-[10px] text-base font-bold tracking-normal text-[#fff] disabled:opacity-70">
    <LogoMark class="size-8 shrink-0 text-[#fff]" aria-hidden="true" />
    <span>Sign in with ScotDance.app</span>
    <LoaderCircle v-if="busy" class="absolute right-2 size-4 animate-spin" aria-hidden="true" />
  </button>
</template>
