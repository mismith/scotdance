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
    <slot />
  </v-tooltip>
</template>

<script>
import { mdiInformationVariant } from '@mdi/js';

export default {
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
