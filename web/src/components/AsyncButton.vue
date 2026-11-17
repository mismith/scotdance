<script setup lang="ts">
import { LoaderCircle as Spinner } from '@lucide/vue'
import { useButtonAction, type ButtonAction } from '@/lib/buttonAction'
const props = defineProps<{
  busy?: boolean
  disabled?: boolean
  onClick?: ButtonAction | ButtonAction[]
}>()
const action = useButtonAction(props)
</script>
<template>
  <button
    class="relative [&[aria-busy=true]>.pending-label]:text-transparent [&[aria-busy=true]>.pending-label>*]:opacity-0"
    :disabled="action.disabled.value"
    :aria-busy="action.busy.value || undefined"
    @click="action.click"
  >
    <slot v-if="!action.busy.value" />
    <span v-else class="pending-label contents"><slot /></span>
    <span
      v-if="action.busy.value"
      class="pointer-events-none absolute inset-0 flex items-center justify-center [&>svg]:size-5 [&>svg]:animate-spin motion-reduce:[&>svg]:animate-none"
      aria-hidden="true"
      ><Spinner
    /></span>
  </button>
</template>
