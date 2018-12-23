<template>
  <div class="md-spunnable">
    <mi-md-spinner
      :diameter="25"
      :width="6"
      title="Saving..."
      :style="{ visibility: mdSpinning ? 'visible' : 'hidden' }"
    />
    <v-icon v-show="!mdSpinning" color="primary" title="Saved">check</v-icon>
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
  display: flex;
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
