<template>
  <div class="DancerReport">
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

        <v-list>
          <ResultListItem
            v-for="dance in findGroupDances(group, dances)"
            :key="dance[idKey]"
            :place="getPlace(dancer, group, dance)"
            :to="{ name: 'competition.results', params: { groupId: group[idKey], danceId: dance[idKey] } }"
          >
            <template #avatar />
            {{ dance.$name }}
          </ResultListItem>

          <v-divider v-if="hasOverall(group)" />
          <ResultListItem
            v-if="hasOverall(group)"
            :place="getPlace(dancer, group, overall)"
            :to="{ name: 'competition.results', params: { groupId: group[idKey], danceId: overall[idKey] } }"
          >
            <template #avatar />
            {{ overall.$name }}
          </ResultListItem>

          <v-list-item v-if="!findGroupDances(group, dances).length && !hasOverall(group)" class="empty">
            <v-list-item-avatar>
              <v-icon>mdi-close</v-icon>
            </v-list-item-avatar>
            <v-list-item-content>
              Results to be determined.
            </v-list-item-content>
          </v-list-item>
        </v-list>
      </v-list-group>
    </v-list>
  </div>
</template>

<script>
import FavoriteDancerButton from '@/components/FavoriteDancerButton.vue';
import ResultListItem from '@/components/ResultListItem.vue';
import { idKey } from '@/helpers/firebase';
import {
  overall,
  hasOverall,
  findGroupDances,
  findPlacedDancers,
  getPlace,
} from '@/helpers/results';

export default {
  name: 'DancerReport',
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
