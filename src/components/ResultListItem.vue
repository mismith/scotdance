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
        <place v-if="place !== undefined" :place="place" />
        <v-icon v-else>{{ mdiChevronRight }}</v-icon>
      </slot>
    </v-list-item-action>
  </v-list-item>
</template>

<script>
import { mdiCheck, mdiCheckOutline, mdiChevronRight } from '@mdi/js';
import Place from '@/components/Place.vue';
import { hasFavorites } from '@/helpers/competition';

export default {
  name: 'ResultListItem',
  props: {
    dancers: Array, // [] -> TBD; [...] -> show checkmark;
    hasPlaceholderDancers: Boolean, // true -> show hollow checkmark
    place: Number, // undefined -> show chevron
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
  components: {
    Place,
  },
};
</script>
