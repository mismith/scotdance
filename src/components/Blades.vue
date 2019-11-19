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
.Blades {
  position: relative;

  @media (min-width: 960px) {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  &.stacks {
    @media (max-width: 959px) {
      flex-direction: column;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }
  }
}
</style>
