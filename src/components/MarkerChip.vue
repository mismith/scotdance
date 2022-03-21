<template>
  <v-chip
    :small="small"
    :x-small="!small"
    disabled
    color="secondary"
    class="MarkerChip mb-1"
    :class="small ? undefined : 'px-2 ml-1'"
    style="opacity: 1;"
  >
    <slot>Today</slot>
  </v-chip>
</template>

<script>
export default {
  props: {
    small: {
      type: Boolean,
      required: false,
    },
  },
};
</script>
