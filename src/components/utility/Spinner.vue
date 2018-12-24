<template>
  <v-progress-circular v-bind="$props" indeterminate color="primary" class="spinner" />
</template>

<script>
export default {
  name: 'spinner',
  props: {
    size: {
      type: Number,
      default: 64,
    },
    width: {
      type: Number,
      default: 4,
    },
  },
};
</script>

<style lang="scss">
.spinner {
  display: inline-flex;
  margin: auto;
}
</style>
