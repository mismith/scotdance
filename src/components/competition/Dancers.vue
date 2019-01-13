<template>
  <blades class="competition-dancers alt">
    <blade :active="!currentDancer" class="xs12 md6">
      <div v-if="dancers.length" class="app-scroll-frame">
        <v-toolbar dense>
          <search-field v-model="filterBy" class="flex mr-2" />
          <v-menu @selected="sortBy">
            <v-btn icon slot="activator">
              <v-icon>filter_list</v-icon>
            </v-btn>

            <v-list>
              <v-list-tile
                v-for="by in sortableBys"
                :key="by.key"
                @click="sortBy = by.key"
                :class="{ 'primary--text': sortBy === by.key }"
              >
                {{ by.name }}
              </v-list-tile>
            </v-list>
          </v-menu>
          <v-btn
            icon
            :class="{ 'secondary--text': onlyFavorites }"
            @click="onlyFavorites = !onlyFavorites"
          >
            <v-icon>{{ onlyFavorites ? 'star' : 'star_border' }}</v-icon>
          </v-btn>
        </v-toolbar>

        <div
          v-persist-scroll="`/competitions/${competitionId}/dancers`"
          class="app-scroll-frame app-scroll"
        >
          <v-list v-if="groupIds.length" expand class="grouped">
            <v-list-group
              v-for="(group, groupId) in groupedDancers"
              :key="groupId"
              lazy
              :value="isGroupExpanded(groupId, groupIds)"
              @input="handleGroupExpanded(groupId, $event)"
            >
              <v-subheader slot="activator">
                <v-flex>{{ groupId || '?' }}</v-flex>
                <v-icon v-if="!onlyFavorites && hasFavorites(group)" color="secondary">star</v-icon>
              </v-subheader>

              <v-list two-line>
                <dancer-list-item
                  v-for="dancer in group"
                  :key="dancer[idKey]"
                  :dancer="dancer"
                  :to="{ name: $route.name, params: { competitionId, dancerId: dancer[idKey] } }"
                />
              </v-list>
            </v-list-group>
          </v-list>
          <empty-state
            v-else-if="!onlyFavorites"
            icon="error_outline"
            label="No dancers match"
          />
          <empty-state
            v-else-if="me"
            icon="star_half"
            label="No favourite dancers"
          />
          <empty-state
            v-else
            icon="star_half"
            label="No favourite dancers"
            description="Login to highlight your favourites–making them much easier to find"
          />
        </div>
      </div>
      <empty-state
        v-else
        icon="clear"
        label="No dancers yet"
        description="Check back later"
      />
    </blade>
    <blade :active="currentDancer" class="xs12 md6">
      <div v-if="currentDancer" class="app-scroll-frame">
        <v-toolbar dense class="hidden-md-and-up">
          <v-btn flat icon :to="{ name: $route.name, params: { competitionId } }">
            <v-icon>chevron_left</v-icon>
          </v-btn>
          <span>Dancers</span>
        </v-toolbar>

        <div
          v-persist-scroll="`/competitions/${competitionId}/dancers/${dancerId}`"
          class="app-scroll-frame app-scroll"
        >
          <dancer-report
            :dancer="currentDancer"
            :dancers="dancers"
            :dances="dances"
            :groups="groups"
            :results="results"
          />
        </div>
      </div>
      <empty-state
        v-else
        icon="touch_app"
        label="See dancer details"
        description="Select a dancer"
      />
    </blade>
  </blades>
</template>

<script>
import Fuse from 'fuse.js';
import sortBy from 'lodash.sortby';
import groupBy from 'lodash.groupby';
import SearchField from '@/components/utility/SearchField.vue';
import DancerListItem from '@/components/utility/DancerListItem.vue';
import DancerReport from '@/components/utility/DancerReport.vue';
import { idKey } from '@/helpers/firebase';
import { hasFavorites } from '@/helpers/competition';
import {
  isExpanded,
  handleExpanded,
} from '@/helpers/router';

export default {
  name: 'competition-dancers',
  props: {
    competitionId: String,
    dancerId: String,
    competitionDataRef: {
      type: Object,
      required: true,
    },
    dancers: Array,
    dances: Array,
    groups: Array,
    results: Object,
  },
  localStorage: {
    filterBy: {
      type: String,
      default: '',
    },
    sortBy: {
      type: String,
      default: '$group.$order',
    },
    dancersExpandedGroups: {
      type: Object,
      default: {}, // { [sortBy]: {}, ... }
    },
  },
  data() {
    return {
      idKey,

      sortableBys: [
        { key: '$group.$order', name: 'Age Group', searchKey: '$group.$name' },
        { key: '$number', name: 'Number', searchKey: 'number' },
        { key: 'location', name: 'Location' },
        { key: 'firstName', name: 'First Name' },
        { key: 'lastName', name: 'Last Name' },
      ],
      onlyFavorites: false,
    };
  },
  computed: {
    currentDancer() {
      if (this.dancerId) {
        return this.dancers.find(dancer => dancer[idKey] === this.dancerId);
      }
      return null;
    },

    sortableBy() {
      return this.sortableBys.find(({ key }) => key === this.sortBy);
    },
    groupedDancers() {
      let filtered = this.dancers;

      // filter by search term
      if (this.filterBy && filtered.length) {
        const searchKeys = this.sortableBys.map(({ key, searchKey }) => searchKey || key).concat(['$name']);
        filtered = new Fuse(filtered, {
          keys: searchKeys,
          threshold: 0.33,
        }).search(this.filterBy);
      }

      // filter by onlyFavorites, if necessary
      if (this.onlyFavorites) {
        filtered = filtered.filter(dancer => dancer && dancer.$favorite);
      }

      // sort by key
      if (this.sortBy) {
        filtered = sortBy(filtered, [this.sortBy, '$number']);
      }

      // group together
      const grouped = groupBy(filtered, this.getSortGroup);

      return grouped;
    },
    groupIds() {
      return Object.keys(this.groupedDancers);
    },
  },
  methods: {
    hasFavorites,

    isGroupExpanded(itemId, itemIds) {
      // searching, so expand all groups
      if (this.filterBy || this.onlyFavorites) return true;

      return isExpanded(this.dancersExpandedGroups[this.sortBy], itemId, itemIds);
    },
    handleGroupExpanded(groupId, expanded) {
      this.dancersExpandedGroups[this.sortBy] = handleExpanded(
        this.dancersExpandedGroups[this.sortBy],
        groupId,
        expanded,
      );
      this.$localStorage.set('dancersExpandedGroups', this.dancersExpandedGroups);
    },

    getSortGroup(dancer) {
      if (!dancer) return undefined;

      const fallback = this.sortableBy && this.sortableBy.name;
      switch (this.sortBy) {
        case '$number': {
          return fallback;
        }
        case 'firstName':
        case 'lastName': {
          // get first letter
          return (dancer[this.sortBy] || '')[0] || fallback;
        }
        case '$group.$order': {
          return (dancer.$group && dancer.$group.$name) || fallback;
        }
        default: {
          return dancer[this.sortBy] || fallback;
        }
      }
    },
  },
  components: {
    SearchField,
    DancerListItem,
    DancerReport,
  },
};
</script>

<style lang="scss">
.competition-dancers {
  .search-field {
    .v-input__control {
      min-height: 36px !important;

      .v-input__slot {
        margin: 0;
      }
    }
  }
}
</style>
