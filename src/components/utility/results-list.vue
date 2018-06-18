<template>
  <md-list class="md-list-cards">
    <md-list-item-cards
      v-for="group in groups"
      :key="group[idKey]"
      md-expand
      :md-expanded="isGroupExpanded(group, groups)"
      @toggled="handleGroupExpanded(group[idKey], $event)"
      :class="{ highlighted: results[group[idKey]] }"
    >
      <md-subheader>
        <span>{{ group.$name }}</span>
        <md-icon v-if="hasFavorites(findGroupDancers(group))" class="md-accent">
          {{ hasFavorites(getPlacedDancers(group, callbacks)) ? 'star' : 'star_outline' }}
        </md-icon>
      </md-subheader>
      <md-list slot="md-expand" class="results-list">
        <result-list-item
          :dancers="getPlacedDancers(group, callbacks, true)"
          :to="{ params: { groupId: group[idKey], danceId: callbacks[idKey] } }"
          :class="{ active: isActive(group, callbacks) }"
        >
          {{ callbacks.$name }}
        </result-list-item>
        <md-divider class="md-inset" />

        <result-list-item
          v-for="dance in findGroupDances(group)"
          :key="dance[idKey]"
          :dancers="getPlacedDancers(group, dance)"
          :to="{ params: { groupId: group[idKey], danceId: dance[idKey] } }"
          :class="{ active: isActive(group, dance) }"
        >
          {{ dance.$name }}
        </result-list-item>

        <md-divider v-if="hasOverall(group)" class="md-inset" />
        <result-list-item
          v-if="hasOverall(group)"
          :dancers="getPlacedDancers(group, overall)"
          :to="{ params: { groupId: group[idKey], danceId: overall[idKey] } }"
          :class="{ active: isActive(group, overall) }"
        >
          {{ overall.$name }}
          <md-icon class="icon-trophy" slot="icon" />
        </result-list-item>
      </md-list>
    </md-list-item-cards>
  </md-list>
</template>

<script>
import ResultListItem from '@/components/utility/result-list-item';
import {
  idKey,
} from '@/helpers/firebase';
import {
  hasFavorites,
} from '@/helpers/competition';
import {
  overall,
  callbacks,
  findGroupDances,
  findGroupDancers,
  getPlacedDancers,
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
    findGroupDances,
    findGroupDancers,
    getPlacedDancers,
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
  .md-list {
    > div {
      position: relative;

      > .md-divider {
        bottom: auto;
        top: 0;
        z-index: 3;
      }
    }
  }
}
</style>
