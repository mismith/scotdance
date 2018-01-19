<template>
  <div class="md-spinnable">
    <slot />
    <md-progress-spinner v-if="mdSpinning" :md-diameter="25" md-mode="indeterminate" />
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
