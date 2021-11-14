<template>
  <v-row no-gutters class="Blades app-scroll-frame" :class="{ stacks }">
    <slot />
  </v-row>
</template>

<script>
export default {
  name: 'Blades',
  props: {
    stacks: Boolean,
  },
};
</script>

<style lang="scss">
.Blades.app-scroll-frame { // double selector for extra specificity to ensure overflow-x takes effect
  position: relative;

  @media (min-width: 960px) {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  &.stacks {
    @media (max-width: 959px) {
      display: block;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }
  }
}
</style>
