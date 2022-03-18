<template>
  <v-tooltip class="text-black" bottom :max-width="300" :open-on-hover="!isTouch">
    <template #activator="{ on }">
      <v-btn v-on="on" icon x-small outlined color="amber" class="ml-2" @click.stop>
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
    return {
      mdiInformationVariant,
      isTouch: window.matchMedia('(hover: none), (pointer: coarse)').matches,
    };
  },
};
</script>
