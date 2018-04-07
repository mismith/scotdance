<template>
  <div class="md-spunnable">
    <md-progress-spinner
      :md-diameter="25"
      md-mode="indeterminate"
      title="Saving..."
      :style="{ visibility: mdSpinning ? 'visible' : 'hidden' }"
    />
    <md-icon v-show="!mdSpinning" class="md-primary" title="Saved">check</md-icon>
  </div>
</template>

<script>
export default {
  name: 'md-spunnable',
  props: {
    mdSpinning: false,
  },
};
</script>

<style lang="scss">
.md-spunnable {
  position: relative;

  .md-icon {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
  }
}
</style>
