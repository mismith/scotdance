<template>
  <div class="md-spinnable" :class="{ 'md-left': mdLeft }">
    <slot />

    <mi-md-spinner v-if="mdSpinning" :diameter="25" :width="6" />
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

  .mi-md-spinner {
    margin-left: 8px;
  }

  &.md-left {
    .mi-md-spinner {
      order: -1;
      margin-right: 8px;
      margin-left: 0;
    }
  }
}
</style>
