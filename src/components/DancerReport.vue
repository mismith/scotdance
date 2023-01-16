<template>
  <div class="DancerReport app-scroll-frame app-scroll">
    <header>
      <v-subheader class="title">
        <div class="flex">{{ dancer.$name }}</div>
        <FavoriteDancerButton :dancer="dancer" />
      </v-subheader>
      <div class="pa-4">
        <div class="number">#{{ dancer.number }}</div>
        <div class="group">{{ dancer.$group && dancer.$group.$name }}</div>
        <div class="location">{{ dancer.location }}</div>
      </div>
    </header>

    <v-list v-if="group" expand class="grouped">
      <v-list-group :value="true">
        <template #activator>
          <v-subheader>Results</v-subheader>
        </template>

        <DancerReportResults
          :dancer="dancer"
          :dancers="dancers"
          :dances="dances"
          :groups="groups"
          :results="results"
          :points="points"
        />
      </v-list-group>
    </v-list>

    <footer v-if="featureFlagSearchDancers" class="mt-auto pa-4 pb-8 text-center">
      <p class="caption">This dancer may appear in other competitions. To track their progress:</p>
      <v-btn :to="{ name: 'dancers', query: { q: dancer.$name, s: dancer.$name } }" color="primary">
        <v-icon class="mr-2">{{ mdiAccountSearch }}</v-icon>
        Search Dancers
      </v-btn>
    </footer>
  </div>
</template>

<script>
import {
  mdiAccountSearch,
} from '@mdi/js';
import FavoriteDancerButton from '@/components/FavoriteDancerButton.vue';
import { idKey } from '@/helpers/firebase';
import DancerReportResults from './DancerReportResults.vue';

export default {
  name: 'DancerReport',
  reactiveInject: {
    competitionBundle: [
      'dancers',
      'dances',
      'groups',
      'results',
      'points',
    ],
  },
  props: {
    dancer: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      idKey,
      mdiAccountSearch,
    };
  },
  computed: {
    featureFlagSearchDancers() {
      return this.$store.getters.getFeatureFlag('search-dancers');
    },
    group() {
      return this.dancer && this.dancer.$group;
    },
  },
  components: {
    FavoriteDancerButton,
    DancerReportResults,
  },
};
</script>
