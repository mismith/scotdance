<script setup lang="ts">
// A list beside the selected item. From `md` both columns show, each
// scrolling on its own; on phones only one shows at a time (the item when
// one is chosen, else the list), like any other drill-down in the app.
// `single`: just the list, the full width (nothing in it to choose yet).
defineProps<{
  /** An item is selected (or being added). */
  showDetail: boolean
  single?: boolean
}>()
</script>

<template>
  <div :class="['md:h-full', !single && 'md:grid md:grid-cols-[minmax(17rem,24rem)_minmax(0,1fr)]']">
    <section :class="['min-w-0 md:h-full md:overflow-y-auto', !single && 'md:border-r', showDetail && 'max-md:hidden']">
      <slot name="list" />
    </section>
    <section v-if="!single" :class="['bg-background min-w-0 md:overflow-y-auto', !showDetail && 'max-md:hidden']">
      <slot v-if="showDetail" name="detail" />
      <slot v-else name="empty" />
    </section>
  </div>
</template>
