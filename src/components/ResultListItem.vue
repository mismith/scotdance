<template>
  <v-list-item :to="to" class="ResultListItem">
    <slot name="avatar">
      <v-list-item-avatar
        :color="hasFavorites(dancers || []) ? 'secondary' : (hasResults ? 'primary' : 'grey')"
      >
        <v-icon v-if="hasResults">
          {{ hasPlaceholderDancers ? mdiCheckOutline : mdiCheck }}
        </v-icon>
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
import { mdiCheck, mdiCheckOutline, mdiChevronRight } from '@mdi/js';
import { hasFavorites } from '@/helpers/competition';

export default {
  name: 'ResultListItem',
  props: {
    dancers: {
      type: Array, // [] -> TBD; [...] -> show checkmark;
      default: () => [],
    },
    hasPlaceholderDancers: {
      type: Boolean, // true -> show hollow checkmark
      default: false,
    },
    to: Object,
  },
  data() {
    return {
      mdiCheck,
      mdiCheckOutline,
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
