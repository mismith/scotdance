<template>
  <v-layout row class="blades app-scroll-frame" :class="{ stacks }">
    <slot />
  </v-layout>
</template>

<script>
export default {
  name: 'blades',
  props: {
    stacks: Boolean,
  },
};
</script>

<style lang="scss">
.blades {
  position: relative;

  @media (min-width: 960px) {
    overflow-x: auto;
  }

  &.stacks {
    @media (max-width: 959px) {
      flex-direction: column;
      overflow-y: auto;
    }
  }
}
</style>
