<template>
  <v-col class="Blade app-scroll-frame" :class="{ 'blade-active': active }">
    <slot />
  </v-col>
</template>

<script>
export default {
  name: 'Blade',
  props: {
    active: Boolean,
  },
};
</script>

<style lang="scss">
@import '~vuetify/src/styles/settings/_index';

.Blades {
  @media (max-width: 959px) {
    &:not(.stacks) {
      .Blade {
        transition: all 300ms;
        transform: translate3d(-100%, 0, 0);
        opacity: 0;
        z-index: 0;

        + .Blade {
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
      .Blade {
        height: auto;

        + .Blade {
          border-top: solid 6px transparent;
        }
      }
    }
  }
  @media (min-width: 960px) {
    .Blade {
      flex-shrink: 0;

      + .Blade {
        border-left: solid 6px transparent;
      }
    }
  }

  .Blade + .Blade {
    border-color: map-get($material-theme, 'dividers');

    .theme--dark & {
      border-color: map-get($material-dark, 'dividers');
    }
  }
}
</style>
