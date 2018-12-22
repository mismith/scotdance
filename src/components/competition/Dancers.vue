<template>
  <blades class="competition-dancers alt">
    <blade :active="!currentDancer" class="md-small-size-100 md-size-50">
      <div v-if="dancers.length" class="app-scroll-frame">
        <md-toolbar>
          <search-field :filter-by.sync="filterBy" />
          <md-menu md-direction="bottom-end" @selected="sortBy">
            <md-button md-menu-trigger class="md-icon-button">
              <v-icon>filter_list</v-icon>
            </md-button>

            <md-menu-content>
              <md-menu-item
                v-for="by in sortableBys"
                :key="by.key"
                @click="sortBy = by.key"
                :class="{ active: sortBy === by.key }"
              >{{ by.name }}</md-menu-item>
            </md-menu-content>
          </md-menu>
          <md-button
            @click="onlyFavorites = !onlyFavorites"
            class="md-icon-button"
            :class="{ 'md-accent': onlyFavorites }"
          >
            <v-icon>{{ onlyFavorites ? 'star' : 'star_border' }}</v-icon>
          </md-button>
        </md-toolbar>

        <div
          v-persist-scroll="`/competitions/${competitionId}/dancers`"
          class="app-scroll-frame app-scroll"
        >
          <md-list v-if="groupIds.length" class="md-list-cards">
            <md-list-item-cards
              v-for="(group, groupId) in groupedDancers"
              :key="groupId"
              md-expand
              :md-expanded="isGroupExpanded(groupId, groupIds)"
              @toggled="handleGroupExpanded(groupId, $event)"
            >
              <md-subheader>
                {{ groupId || '?' }}
                <md-icon v-if="hasFavorites(group)" class="md-accent">star</md-icon>
              </md-subheader>

              <md-list slot="md-expand" class="md-double-line">
                <dancer-list-item
                  v-for="dancer in group"
                  :key="dancer[idKey]"
                  :dancer="dancer"
                  :to="{ name: $route.name, params: { competitionId, dancerId: dancer[idKey] } }"
                  :class="{ active: dancerId === dancer[idKey] }"
                />
              </md-list>
            </md-list-item-cards>
          </md-list>
          <div v-else-if="!onlyFavorites">
            <md-empty-state
              md-icon="error_outline"
              md-label="No dancers match"
            />
          </div>
          <div v-else-if="me">
            <md-empty-state
              md-icon="star_half"
              md-label="No favourite dancers"
            />
          </div>
          <div v-else>
            <md-empty-state
              md-icon="star_half"
              md-label="No favourite dancers"
              md-description="Login to highlight your favourites–making them much easier to find"
            />
          </div>
        </div>
      </div>
      <div v-else>
        <md-empty-state
          md-icon="clear"
          md-label="No dancers yet"
        />
      </div>
    </blade>
    <blade :active="currentDancer" class="md-small-size-100 md-size-50">
      <div v-if="currentDancer" class="app-scroll-frame">
        <md-toolbar class="md-dense md-toolbar-nowrap md-medium-hide">
          <md-button :to="{ name: $route.name, params: { competitionId } }" class="md-icon-button">
            <v-icon>chevron_left</v-icon>
          </md-button>
          <span>Dancers</span>
        </md-toolbar>

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
      <div v-else>
        <md-empty-state
          md-icon="touch_app"
          md-label="See dancer details"
          md-description="Select a dancer"
        />
      </div>
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
  .md-toolbar {
    flex-wrap: nowrap;
    padding-left: 16px;
    padding-right: 16px;

    .md-field {
      width: auto;
      flex: 1;
    }
    .search-field {
      margin-right: 8px;
    }
  }
}
</style>
