<template>
  <div class="dancer-report">
    <header>
      <v-subheader class="title">
        <v-flex>{{ dancer.$name }}</v-flex>
        <favorite-dancer-button :dancer="dancer" />
      </v-subheader>
      <div class="pa-3">
        <div class="number">#{{ dancer.number }}</div>
        <div class="group">{{ dancer.$group && dancer.$group.$name }}</div>
        <div class="location">{{ dancer.location }}</div>
      </div>
    </header>
    <v-list v-if="group" expand class="grouped">
      <v-list-group :value="true">
        <v-subheader slot="activator">Results</v-subheader>

        <v-list>
          <result-list-item
            v-for="dance in findGroupDances(group, dances)"
            :key="dance[idKey]"
            :place="getPlace(dancer, group, dance)"
            :to="{ name: 'competition.results', params: { groupId: group[idKey], danceId: dance[idKey] } }"
          >
            <span slot="avatar" />
            {{ dance.$name }}
          </result-list-item>

          <v-divider v-if="hasOverall(group)" />
          <result-list-item
             v-if="hasOverall(group)"
            :place="getPlace(dancer, group, overall)"
            :to="{ name: 'competition.results', params: { groupId: group[idKey], danceId: overall[idKey] } }"
          >
            <span slot="avatar" />
            {{ overall.$name }}
          </result-list-item>

          <v-list-tile v-if="!findGroupDances(group, dances).length && !hasOverall(group)" class="empty">
            <v-list-tile-avatar>
              <v-icon>clear</v-icon>
            </v-list-tile-avatar>
            Results to be determined.
          </v-list-tile>
        </v-list>
      </v-list-group>
    </v-list>
  </div>
</template>

<script>
import FavoriteDancerButton from '@/components/utility/FavoriteDancerButton.vue';
import ResultListItem from '@/components/utility/ResultListItem.vue';
import { idKey } from '@/helpers/firebase';
import {
  overall,
  hasOverall,
  findGroupDances,
  findPlacedDancers,
  getPlace,
} from '@/helpers/results';

export default {
  name: 'dancer-report',
  props: {
    dancer: Object,
    dancers: Array,
    dances: Array,
    groups: Array,
    results: Object,
  },
  data() {
    return {
      idKey,
      overall,
      hasOverall,
    };
  },
  computed: {
    group() {
      return this.dancer && this.dancer.$group;
    },
  },
  methods: {
    findGroupDances,

    getPlace(dancer, group, dance) {
      if (this.results[group[idKey]] && this.results[group[idKey]][dance[idKey]]) {
        const placedDancers = findPlacedDancers(group, dance, this.dancers, this.results);
        return getPlace(dancer, placedDancers);
      }

      // no results yet
      return null;
    },
  },
  components: {
    FavoriteDancerButton,
    ResultListItem,
  },
};
</script>

<style lang="scss">
.dancer-report {

}
</style>
