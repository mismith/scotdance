<template>
  <v-list expand class="ResultsList grouped">
    <v-list-group
      v-for="group in groups"
      :key="group[idKey]"
      :value="isGroupExpanded(group, groups)"
    >
      <template #activator>
        <v-subheader @click.stop="handleGroupExpanded(group[idKey], !isGroupExpanded(group, groups))">
          <div class="flex">{{ group.$name }}</div>
          <v-icon v-if="hasFavorites(findGroupDancers(group, dancers))" color="secondary">
            {{ mdiStar }}
          </v-icon>
          <v-icon v-if="results[group[idKey]]" color="primary">
            {{ isGroupInProgress(group, dances, results) ? mdiProgressCheck : mdiCheckCircle }}
          </v-icon>
        </v-subheader>
      </template>

      <v-list>
        <ResultListItem
          :dancers="findPlacedDancers(group, callbacks, dancers, results, false, true)"
          :to="{ name: $route.name, params: { groupId: group[idKey], danceId: callbacks[idKey] } }"
          :has-placeholder-dancers="hasPlaceholderDancers(group[idKey], callbacks[idKey], results, points)"
          :class="{ active: isActive(group, callbacks) }"
        >
          {{ callbacks.$name }}
        </ResultListItem>
        <v-divider v-if="findGroupDances(group, dances).length" inset />

        <ResultListItem
          v-for="dance in findGroupDances(group, dances)"
          :key="dance[idKey]"
          :dancers="findPlacedDancers(group, dance, dancers, results, false, true)"
          :to="{ name: $route.name, params: { groupId: group[idKey], danceId: dance[idKey] } }"
          :has-placeholder-dancers="hasPlaceholderDancers(group[idKey], dance[idKey], results, points)"
          :class="{ active: isActive(group, dance) }"
        >
          {{ dance.$name }}
        </ResultListItem>

        <v-divider v-if="hasOverall(group)" inset />
        <ResultListItem
          v-if="hasOverall(group)"
          :dancers="findPlacedDancers(group, overall, dancers, results, false, true)"
          :to="{ name: $route.name, params: { groupId: group[idKey], danceId: overall[idKey] } }"
          :has-placeholder-dancers="hasPlaceholderDancers(group[idKey], overall[idKey], results, points)"
          :class="{ active: isActive(group, overall) }"
        >
          {{ overall.$name }}
          <template #icon>
            <v-icon class="icon-trophy" />
          </template>
        </ResultListItem>
      </v-list>
    </v-list-group>
  </v-list>
</template>

<script>
import { mdiCheckCircle, mdiProgressCheck, mdiStar } from '@mdi/js';
import ResultListItem from '@/components/ResultListItem.vue';
import { idKey } from '@/helpers/firebase';
import { hasFavorites } from '@/helpers/competition';
import {
  overall,
  callbacks,
  hasPlaceholderDancers,
  isGroupInProgress,
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
  name: 'ResultsList',
  props: {
    groups: Array,
    dances: Array,
    dancers: Array,
    results: Object,
    points: Object,
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
      mdiCheckCircle,
      mdiProgressCheck,
      mdiStar,
      overall,
      callbacks,
    };
  },
  methods: {
    hasFavorites,
    hasPlaceholderDancers,
    isGroupInProgress,
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
      const itemIds = items.map((i) => i[idKey]);
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
