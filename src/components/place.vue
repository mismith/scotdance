<template>
  <div class="place" :class="{ finalized }">
    <md-icon v-if="!finalized" style="margin-right: 16px;">access_time</md-icon>
    <div v-else>{{ place || '-' }}<small class="ordinal">{{ ordinal }}</small></div>
  </div>
</template>

<script>
export default {
  name: 'place',
  props: {
    place: Number,
  },
  computed: {
    ordinal() {
      switch (`${this.place}`) {
        case '0': {
          return '';
        }
        case '1': {
          return 'st';
        }
        case '2': {
          return 'nd';
        }
        case '3': {
          return 'rd';
        }
        default: {
          return 'th';
        }
      }
    },
    finalized() {
      return Number.isInteger(this.place);
    },
  },
};
</script>

<style lang="scss">
.place {
  display: flex;
  align-items: center;
  font-size: 2em;
  font-weight: bold;

  .ordinal {
    display: inline-block;
    width: 20px; // aligns the ordinals despite varying character widths
    font-size: 0.5em;
    vertical-align: top;
  }

  &.finalized {
    color: var(--md-theme-default-primary);
  }
}
</style>
