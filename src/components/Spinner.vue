<template>
  <v-progress-circular v-bind="$props" indeterminate :color="color" class="Spinner" />
</template>

<script>
export default {
  name: 'Spinner',
  props: {
    size: {
      type: Number,
      default: 64,
    },
    width: {
      type: Number,
      default: 4,
    },
    color: {
      type: String,
      default: 'primary',
    },
  },
};
</script>

<style lang="scss">
.Spinner {
  display: inline-flex;
  margin: auto;
}
</style>
