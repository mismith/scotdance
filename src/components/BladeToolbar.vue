<template>
  <v-toolbar dense class="BladeToolbar flex-none">
    <v-btn :to="to" exact text icon>
      <v-icon>{{ mdiChevronLeft }}</v-icon>
    </v-btn>
    <div v-html="$sanitize(text || ($route.meta && $route.meta.title) || 'Back')" class="flex text-truncate" />

    <slot />
  </v-toolbar>
</template>

<script>
import { mdiChevronLeft } from '@mdi/js';

export default {
  name: 'BladeToolbar',
  props: {
    text: {
      type: String,
      required: false,
    },
    to: [String, Object],
  },
  data() {
    return {
      mdiChevronLeft,
    };
  },
};
</script>
