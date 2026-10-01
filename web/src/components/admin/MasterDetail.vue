<script setup lang="ts">
// A list beside the selected item. From `md` both columns show, each
// scrolling on its own; on phones only one shows at a time (the item when
// one is chosen, else the list), like any other drill-down in the app.
defineProps<{
  /** An item is selected (or being added). */
  showDetail: boolean
  /** Give the item the whole width until very wide screens (results entry). */
  focusDetail?: boolean
}>()
</script>

<template>
  <div
    :class="[
      'md:grid md:h-full md:grid-cols-[minmax(17rem,24rem)_minmax(0,1fr)]',
      focusDetail && showDetail && 'md:max-2xl:grid-cols-1',
    ]"
  >
    <section
      :class="[
        'min-w-0 md:overflow-y-auto md:border-r',
        showDetail && 'max-md:hidden',
        focusDetail && showDetail && 'md:max-2xl:hidden',
      ]"
    >
      <slot name="list" />
    </section>
    <section :class="['bg-background min-w-0 md:overflow-y-auto', !showDetail && 'max-md:hidden']">
      <slot v-if="showDetail" name="detail" />
      <slot v-else name="empty" />
    </section>
  </div>
</template>
