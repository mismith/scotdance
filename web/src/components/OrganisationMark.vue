<script setup lang="ts">
import { ref, watch } from 'vue'
import { organisationMark, type Organisation } from '@/types/organisation'

// An organisation as a rounded square (people are circles): its logo on
// white, as logos are drawn, or its letters when there isn't one.
const props = withDefaults(
  defineProps<{
    organisation: Pick<Organisation, 'name' | 'shortName' | 'image'>
    size?: 'xs' | 'sm' | 'lg'
  }>(),
  { size: 'sm' },
)

const SIZE = {
  xs: 'size-7 rounded-lg text-[0.5625rem]',
  sm: 'size-10 rounded-xl text-[0.6875rem]',
  lg: 'size-16 rounded-2xl text-base',
}
// A little white around a logo, as it'd have on paper.
const PAD = { xs: 'p-0.5', sm: 'p-1', lg: 'p-1.5' }

const broken = ref(false)
watch(
  () => props.organisation.image,
  () => (broken.value = false),
)
</script>

<template>
  <img
    v-if="organisation.image && !broken"
    :src="organisation.image"
    alt=""
    :class="['shrink-0 bg-white object-contain ring-1 ring-black/5 dark:ring-white/10', SIZE[size], PAD[size]]"
    @error="broken = true"
  />
  <span
    v-else
    :class="['bg-blue-paper text-primary flex shrink-0 items-center justify-center font-bold tracking-[-0.02em]', SIZE[size]]"
    aria-hidden="true"
  >
    {{ organisationMark(organisation) }}
  </span>
</template>
