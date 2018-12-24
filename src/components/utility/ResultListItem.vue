<template>
  <v-list-tile :to="to" class="result-list-item">
    <slot name="avatar">
      <v-list-tile-avatar
        :color="hasFavorites(dancers || []) ? 'secondary' : (hasResults ? 'primary' : 'grey')"
      >
        <v-icon v-if="hasResults">
          {{ hasPlaceholderDancers ? 'done_outline' : 'check' }}
        </v-icon>
        <small v-else>TBD</small>
      </v-list-tile-avatar>
    </slot>

    <v-list-tile-content>
      <v-list-tile-title><slot /></v-list-tile-title>
    </v-list-tile-content>

    <v-list-tile-action>
      <slot name="icon">
        <place v-if="place !== undefined" :place="place" />
        <v-icon v-else>chevron_right</v-icon>
      </slot>
    </v-list-tile-action>
  </v-list-tile>
</template>

<script>
import Place from '@/components/utility/Place.vue';
import { hasFavorites } from '@/helpers/competition';

export default {
  name: 'result-list-item',
  props: {
    dancers: Array, // [] -> TBD; [...] -> show checkmark;
    hasPlaceholderDancers: Boolean, // true -> show hollow checkmark
    place: Number, // undefined -> show chevron
    to: true,
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

<style lang="scss">
.result-list-item {

}
</style>
