<template>
  <div class="Place" :class="{ 'primary--text': finalized }">
    <small v-if="!finalized" class="tbd">TBD</small>
    <div v-else>{{ place || '-' }}<small class="ordinal">{{ ordinal }}</small></div>
  </div>
</template>

<script>
import { getOrdinal } from '@/helpers/results';

export default {
  name: 'Place',
  props: {
    place: Number,
  },
  computed: {
    ordinal() {
      return getOrdinal(this.place);
    },
    finalized() {
      return Number.isInteger(this.place);
    },
  },
};
</script>

<style lang="scss">
.Place {
  display: flex;
  align-items: center;
  font-size: 2em;
  font-weight: bold;

  .tbd {
    font-size: 13.333px;
    font-weight: normal;
    text-transform: uppercase;
    margin-right: 12px;
  }
  .ordinal {
    display: inline-block;
    width: 20px; // aligns the ordinals despite varying character widths
    font-size: 0.5em;
    vertical-align: top;
  }
}
</style>
