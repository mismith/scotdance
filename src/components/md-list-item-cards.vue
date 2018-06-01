<template>
  <li class="md-list-item md-list-item-cards" :class="{
    'md-expand': mdExpand,
    'md-active': showContent,
  }">
    <div class="md-list-item-container">
      <div @click="showContent = !showContent" class="md-list-item-content">
        <slot />

        <md-button class="md-icon-button">
          <md-icon>chevron_right</md-icon>
        </md-button>
      </div>

      <div v-if="showContent" class="md-list-expand">
        <slot name="md-expand" />
      </div>
    </div>
  </li>
</template>

<script>
export default {
  name: 'md-list-item-cards',
  props: {
    mdExpand: Boolean,
    mdExpanded: Boolean,
  },
  data() {
    return {
      showContent: false,
    };
  },
  watch: {
    mdExpanded() {
      if (this.mdExpanded) {
        this.open();
      } else {
        this.close();
      }
    },
    showContent() {
      this.$emit('update:mdExpanded', this.showContent);
    },
  },
  methods: {
    open() {
      this.showContent = true;
    },
    close() {
      this.showContent = false;
    },
  },
  mounted() {
    if (this.mdExpanded) {
      this.open();
    }
  },
};
</script>

<style lang="scss">
@keyframes appear {
  0% {
    opacity: 0;
    transform: translate3d(0, -24px, 0);
  }
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

.md-list-item-cards {
  > .md-list-item-container {
    > .md-list-item-content {
      > .md-icon-button {
        margin-right: 0;

        .md-icon {
          transform: rotate(90deg);
          transition: transform 300ms;
        }
      }
    }

    > .md-list-expand {
      animation: appear 300ms;
    }
  }

  &.md-active {
    > .md-list-item-container {
      > .md-list-item-content {
        > .md-icon-button {
          .md-icon {
            transform: rotate(-90deg);
          }
        }
      }
    }
  }
  &:not(.md-active) {
    > .md-list-item-container {
      > .md-list-expand {
        display: none;
      }
    }
  }
  &:not(.md-expand) {
    > .md-list-item-container {
      > .md-list-item-content > .md-icon-button,
      > .md-list-expand {
        display: none;
      }
    }
  }
}
</style>
