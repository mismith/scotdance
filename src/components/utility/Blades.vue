<template>
  <div class="blades md-layout app-scroll-frame" :class="{ stacks: stacks }">
    <slot />
  </div>
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
  // extends: md-layout, app-scroll-frame
  flex-direction: row;
  flex-wrap: nowrap;
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
