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

        <v-list two-line>
          <ResultListItem
            v-for="dance in groupDances"
            :key="dance[idKey]"
            :to="{ name: 'competition.results', params: { groupId: group[idKey], danceId: dance[idKey] } }"
          >
            <template #avatar><span /></template>
            {{ dance.$name }}
            <template #icon>
              <v-icon v-if="isPointed(dance)" class="mr-3 my-3">{{ mdiCardsDiamond }}</v-icon>
              <Place v-else :place="getPlace(dancer, group, dance)" />
            </template>
          </ResultListItem>

          <v-divider v-if="hasOverall(group)" />
          <ResultListItem
            v-if="hasOverall(group)"
            :to="{ name: 'competition.results', params: { groupId: group[idKey], danceId: overall[idKey] } }"
          >
            <template #avatar><span /></template>
            {{ overall.$name }}
            <template #icon>
              <v-icon v-if="isPointed(overall)" class="mr-3 my-3">{{ mdiCardsDiamond }}</v-icon>
              <Place v-else :place="getPlace(dancer, group, overall)" />
            </template>
          </ResultListItem>

          <EmptyResults
            v-if="!groupDances.length && !hasOverall(group)"
            :groupId="group[idKey]"
            :danceId="overall[idKey]"
            :results="results"
          />
        </v-list>
      </v-list-group>
    </v-list>

    <footer v-if="featureFlagSearchDancers" class="mt-auto pa-4 pb-8 text-center">
      <p class="caption">This dancer may appear in other competitions. To track their progress:</p>
      <v-btn :to="{ name: 'dancers', query: { q: dancer.$name, s: dancer.$name } }" color="secondary">
        <v-icon class="mr-2">{{ mdiAccountSearch }}</v-icon>
        Search Dancers
      </v-btn>
    </footer>
  </div>
</template>

<script>
import {
  mdiAccountSearch,
  mdiCardsDiamond,
} from '@mdi/js';
import FavoriteDancerButton from '@/components/FavoriteDancerButton.vue';
import ResultListItem from '@/components/ResultListItem.vue';
import EmptyResults from '@/components/EmptyResults.vue';
import Place from '@/components/Place.vue';
import { idKey } from '@/helpers/firebase';
import {
  overall,
  hasOverall,
  findGroupDances,
  findPlacedDancers,
  getPlace,
  isDancerPointed,
} from '@/helpers/results';

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
      overall,
      hasOverall,
      mdiAccountSearch,
      mdiCardsDiamond,
    };
  },
  computed: {
    featureFlagSearchDancers() {
      return this.$store.getters.getFeatureFlag('search-dancers');
    },
    group() {
      return this.dancer && this.dancer.$group;
    },
    groupDances() {
      return findGroupDances(this.group, this.dances);
    },
  },
  methods: {
    getPlace(dancer, group, dance) {
      if (this.results?.[group?.[idKey]]?.[dance?.[idKey]]) {
        const placedDancers = findPlacedDancers(group, dance, this.dancers, this.results);
        return getPlace(dancer, placedDancers);
      }

      // no results yet
      return null;
    },
    isPointed(dance) {
      return isDancerPointed(this.points, this.group?.[idKey], dance?.[idKey], this.dancer?.[idKey]);
    },
  },
  components: {
    FavoriteDancerButton,
    ResultListItem,
    EmptyResults,
    Place,
  },
};
</script>
