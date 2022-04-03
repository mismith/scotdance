<template>
  <v-tooltip class="text-black" bottom :max-width="300" :open-on-hover="!isTouch">
    <template #activator="{ on }">
      <v-btn
        v-on="on"
        icon
        x-small
        outlined
        color="amber"
        class="ml-2"
        @click="(e) => isTouch && e.stopPropagation()"
      >
        <v-icon small>{{ mdiInformationVariant }}</v-icon>
      </v-btn>
    </template>
    <slot>
      <template v-if="tip === 'championship-points'">
        <strong>Championship Points</strong> highlight dancers who were placed by <em>at least one judge</em>—but whose combined score from <em>all judges</em> didn't result in an actual placing.
      </template>
      <template v-else-if="tip === 'placeholder-dancer'">
          A <strong>placeholder dancer</strong> is a temporary stand-in for a dancer whose number/info is missing, invalid, misheard, or is otherwise problematic for some reason.
      </template>
    </slot>
  </v-tooltip>
</template>

<script>
import { mdiInformationVariant } from '@mdi/js';

export default {
  props: {
    tip: {
      type: String,
      required: false,
    },
  },
  data() {
    const isTouchMediaQueryList = window.matchMedia('(hover: none), (pointer: coarse)');
    return {
      mdiInformationVariant,
      isTouchMediaQueryList,
      isTouchHandler: ({ matches }) => {
        this.isTouch = matches;
      },
      isTouch: isTouchMediaQueryList.matches,
    };
  },
  mounted() {
    this.isTouchMediaQueryList.addEventListener('change', this.isTouchHandler);
  },
  beforeDestroy() {
    this.isTouchMediaQueryList.removeEventListener('change', this.isTouchHandler);
  },
};
</script>
