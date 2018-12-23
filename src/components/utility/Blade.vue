<template>
  <v-flex class="blade app-scroll-frame" :class="{ 'blade-active': active }">
    <slot />
  </v-flex>
</template>

<script>
export default {
  name: 'blade',
  props: {
    active: Boolean,
  },
};
</script>

<style lang="scss">
.blades {
  @media (max-width: 959px) {
    &:not(.stacks) {
      .blade {
        transition: all 300ms;
        transform: translate3d(-100%, 0, 0);
        opacity: 0;
        z-index: 0;

        + .blade {
          transform: translate3d(100%, 0, 0);
          // @HACK to avoid post-animation flicker on iOS
          // this essentially causes `position: absolute` on the incoming blade—e.g. to allow stacking
          // but without altering the scroll position (which gums up the persist-scroll directive)
          margin-left: -100% !important;
        }

        &.blade-active {
          transform: translate3d(0, 0, 0);
          opacity: 1;
          z-index: 1;
        }
      }
    }
    &.stacks {
      .blade {
        flex: 1 0 auto;

        + .blade {
          border-top: solid 6px #ccc;
        }
      }
    }
  }
  @media (min-width: 960px) {
    .blade {
      flex-shrink: 0;

      .md-medium-hide {
        display: none !important; // @HACK to fix vue-material not setting this as important, so md-toolbar overrides it
      }

      + .blade {
        border-left: solid 6px #ccc;
      }
    }
  }
}
</style>
