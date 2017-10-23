<template>
  <md-boards ref="boards" :md-swipeable="mdSwipeable" class="md-swiper">
    <slot />
  </md-boards>
</template>

<script>
export default {
  name: 'md-swiper',
  props: {
    mdSwipeable: undefined,
  },
  methods: {
    prev() {
      this.$refs.boards.movePrevBoard();
    },
    next() {
      this.$refs.boards.moveNextBoard();
    },
  },
};
</script>

<style lang="scss">
.md-swiper {
  &.md-boards {
    .md-boards-content {
      flex: 1;

      .md-board {
        padding: 0;

        &.md-scroll-frame {
          height: auto;
          bottom: 0;
        }
        .md-scroll {
          bottom: 0;
        }
      }
    }
    .md-boards-navigation {
      display: none;
    }
  }
}
</style>
