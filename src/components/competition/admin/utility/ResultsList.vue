<template>
  <v-list expand class="results-list grouped">
    <v-list-group
      v-for="group in groups"
      :key="group[idKey]"
      lazy
      :value="isGroupExpanded(group, groups)"
      @input="handleGroupExpanded(group[idKey], $event)"
    >
      <v-subheader slot="activator">
        <v-flex>{{ group.$name }}</v-flex>
        <v-icon v-if="hasFavorites(findGroupDancers(group, dancers))" color="secondary">
          star
        </v-icon>
        <v-icon v-if="results[group[idKey]]" color="primary" class="summary-icon">
          {{ isInProgress(group, dances, results) ? 'check_circle_outline' : 'check_circle' }}
        </v-icon>
      </v-subheader>
      <v-list class="results-list">
        <result-list-item
          :dancers="findPlacedDancers(group, callbacks, dancers, results, true)"
          :has-placeholder-dancers="hasPlaceholderDancers(group[idKey], callbacks[idKey], results)"
          :to="{ name: $route.name, params: { groupId: group[idKey], danceId: callbacks[idKey] } }"
          :class="{ active: isActive(group, callbacks) }"
        >
          {{ callbacks.$name }}
        </result-list-item>
        <v-divider v-if="findGroupDances(group, dances).length" inset />

        <result-list-item
          v-for="dance in findGroupDances(group, dances)"
          :key="dance[idKey]"
          :dancers="findPlacedDancers(group, dance, dancers, results)"
          :has-placeholder-dancers="hasPlaceholderDancers(group[idKey], dance[idKey], results)"
          :to="{ name: $route.name, params: { groupId: group[idKey], danceId: dance[idKey] } }"
          :class="{ active: isActive(group, dance) }"
        >
          {{ dance.$name }}
        </result-list-item>

        <v-divider v-if="hasOverall(group)" inset />
        <result-list-item
          v-if="hasOverall(group)"
          :dancers="findPlacedDancers(group, overall, dancers, results)"
          :has-placeholder-dancers="hasPlaceholderDancers(group[idKey], overall[idKey], results)"
          :to="{ name: $route.name, params: { groupId: group[idKey], danceId: overall[idKey] } }"
          :class="{ active: isActive(group, overall) }"
        >
          {{ overall.$name }}
          <v-icon class="icon-trophy" slot="icon" />
        </result-list-item>
      </v-list>
    </v-list-group>
  </v-list>
</template>

<script>
import ResultListItem from '@/components/utility/ResultListItem.vue';
import { idKey } from '@/helpers/firebase';
import { hasFavorites } from '@/helpers/competition';
import {
  overall,
  callbacks,
  hasPlaceholderDancers,
  isInProgress,
  findGroupDances,
  findGroupDancers,
  findPlacedDancers,
  hasOverall,
} from '@/helpers/results';
import {
  isExpanded,
  handleExpanded,
} from '@/helpers/router';

export default {
  name: 'results-list',
  props: {
    groups: Array,
    dances: Array,
    dancers: Array,
    results: Object,
  },
  localStorage: {
    resultsExpandedGroups: {
      type: Object,
      default: {},
    },
  },
  data() {
    return {
      idKey,
      overall,
      callbacks,
    };
  },
  methods: {
    hasFavorites,
    hasPlaceholderDancers,
    isInProgress,
    findGroupDances,
    findGroupDancers,
    findPlacedDancers,
    hasOverall,

    isActive(group, dance) {
      const {
        groupId,
        danceId,
      } = this.$route.params;

      return groupId === group[idKey] && danceId === dance[idKey];
    },

    isGroupExpanded(item, items) {
      const itemIds = items.map(i => i[idKey]);
      return isExpanded(this.resultsExpandedGroups, item[idKey], itemIds);
    },
    handleGroupExpanded(groupId, expanded) {
      this.resultsExpandedGroups = handleExpanded(this.resultsExpandedGroups, groupId, expanded);
      this.$localStorage.set('resultsExpandedGroups', this.resultsExpandedGroups);
    },
  },
  components: {
    ResultListItem,
  },
};
</script>

<style lang="scss">
.results-list {

}
</style>
