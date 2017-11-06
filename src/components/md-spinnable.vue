<template>
  <div class="md-spinnable">
    <slot />
    <md-spinner v-if="mdSpinning" :md-size="25" md-indeterminate />
  </div>
</template>

<script>
export default {
  name: 'md-spinnable',
  props: {
    mdSpinning: false,
  },
};
</script>

<style lang="scss">
.md-spinnable {
  display: inline-flex;
  align-items: center;
}
</style>
