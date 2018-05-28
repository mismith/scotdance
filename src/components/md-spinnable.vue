<template>
  <div class="md-spinnable" :class="{ 'md-left': mdLeft }">
    <slot />

    <md-progress-spinner v-if="mdSpinning" :md-diameter="25" md-mode="indeterminate" />
  </div>
</template>

<script>
export default {
  name: 'md-spinnable',
  props: {
    mdSpinning: false,
    mdLeft: Boolean,
  },
};
</script>

<style lang="scss">
.md-spinnable {
  display: inline-flex;
  align-items: center;

  .md-progress-spinner {
    margin-left: 8px;
  }

  &.md-left {
    .md-progress-spinner {
      order: -1;
      margin-right: 8px;
      margin-left: 0;
    }
  }
}
</style>
