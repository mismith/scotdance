<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import { LoaderCircle } from '@lucide/vue'

// One button, one shape: a capsule. One `primary` per view; the rest are
// `tonal` (blue-tinted), `secondary` (paper), `plain` (text only) or
// `destructive`. Busy keeps the label (so the width holds) and adds a
// spinner; it stays at full strength rather than looking disabled. A `to`
// renders a RouterLink, an `href` a plain link, otherwise a <button>.
const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'tonal' | 'secondary' | 'plain' | 'destructive'
    size?: 'sm' | 'md' | 'lg'
    /** Fill the row. */
    block?: boolean
    to?: RouteLocationRaw
    href?: string
    type?: 'button' | 'submit' | 'reset'
    busy?: boolean
    disabled?: boolean
    /** Replace the default router navigation. */
    replace?: boolean
  }>(),
  { variant: 'secondary', size: 'md', type: 'button', to: undefined, href: undefined },
)

const SIZE = {
  // 36px to the eye, 44px to the finger.
  sm: 'relative h-9 gap-1.5 px-3.5 text-callout [&_svg]:size-4 after:absolute after:-inset-1',
  md: 'h-11 gap-1.5 px-4 text-callout [&_svg]:size-4',
  lg: 'h-12 gap-2 px-6 text-base [&_svg]:size-5',
}
const VARIANT = {
  primary: 'bg-primary-fill text-primary-foreground press-fill proximity shadow-[0_1px_2px_rgb(10_40_90/0.22)]',
  tonal: 'bg-blue-paper text-primary press',
  secondary: 'surface text-foreground press',
  plain: 'text-primary press-row',
  destructive: 'bg-destructive-fill text-destructive-foreground press-fill',
}

const inactive = computed(() => props.disabled || props.busy)
const classes = computed(() => [
  'inline-flex shrink-0 items-center justify-center rounded-full font-semibold whitespace-nowrap select-none',
  'disabled:opacity-(--disabled-opacity) [&[aria-disabled]:not([aria-busy])]:opacity-(--disabled-opacity) aria-disabled:pointer-events-none',
  SIZE[props.size],
  VARIANT[props.variant],
  props.block && 'w-full',
])
</script>

<template>
  <RouterLink
    v-if="to"
    v-proximity="variant === 'primary'"
    :to="to"
    :replace="replace"
    :class="classes"
    :aria-disabled="inactive || undefined"
    :tabindex="inactive ? -1 : undefined"
  >
    <slot />
  </RouterLink>
  <a
    v-else-if="href"
    v-proximity="variant === 'primary'"
    :href="href"
    :class="classes"
    :aria-disabled="inactive || undefined"
  >
    <slot />
  </a>
  <button
    v-else
    v-proximity="variant === 'primary'"
    :type="type"
    :disabled="disabled"
    :aria-busy="busy || undefined"
    :aria-disabled="busy || undefined"
    :class="classes"
  >
    <LoaderCircle v-if="busy" class="animate-spin motion-reduce:animate-none" aria-hidden="true" />
    <slot />
  </button>
</template>
