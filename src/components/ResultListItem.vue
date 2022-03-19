<template>
  <v-list-item :to="to" class="ResultListItem" :class="{ stripes: hasPlaceholderDancers }">
    <slot name="avatar">
      <v-list-item-avatar
        :color="hasFavorites(dancers || []) ? 'secondary' : (hasResults ? 'primary' : 'grey')"
      >
        <v-icon v-if="inProgress">{{ mdiProgressCheck }}</v-icon>
        <v-icon v-else-if="hasResults">{{ mdiCheck }}</v-icon>
        <small v-else>TBD</small>
      </v-list-item-avatar>
    </slot>

    <v-list-item-content>
      <v-list-item-title><slot /></v-list-item-title>
    </v-list-item-content>

    <v-list-item-action>
      <slot name="icon">
        <v-icon>{{ mdiChevronRight }}</v-icon>
      </slot>
    </v-list-item-action>
  </v-list-item>
</template>

<script>
import { mdiCheck, mdiProgressCheck, mdiChevronRight } from '@mdi/js';
import { hasFavorites } from '@/helpers/competition';

export default {
  name: 'ResultListItem',
  props: {
    dancers: {
      type: Array, // [] -> TBD; [...] -> show checkmark;
      default: () => [],
    },
    inProgress: {
      type: Boolean,
      required: false,
    },
    hasPlaceholderDancers: {
      type: Boolean,
      required: false,
    },
    to: Object,
  },
  data() {
    return {
      mdiCheck,
      mdiProgressCheck,
      mdiChevronRight,
    };
  },
  computed: {
    hasResults() {
      return this.dancers && this.dancers.length;
    },
  },
  methods: {
    hasFavorites,
  },
};
</script>
