<template>
  <Blades class="CompetitionDancers alt">
    <Blade :active="!currentDancer" class="col-md-6">
      <div v-if="dancers.length" class="app-scroll-frame">
        <v-toolbar class="flex-none">
          <SearchField v-model="filterBy" class="mr-2" />
          <v-menu @selected="sortBy">
            <template #activator="{ on }">
              <v-btn icon v-on="on">
                <v-icon>mdi-sort</v-icon>
              </v-btn>
            </template>

            <v-list>
              <v-subheader>Sort by:</v-subheader>
              <v-list-item
                v-for="by in sortableBys"
                :key="by.key"
                :class="{ 'v-list-item--active': sortBy === by.key }"
                @click="sortBy = by.key"
              >
                {{ by.name }}
              </v-list-item>
            </v-list>
          </v-menu>
          <v-btn
            icon
            :class="{ 'secondary--text': onlyFavorites }"
            @click="onlyFavorites = !onlyFavorites"
          >
            <v-icon>mdi-star{{ onlyFavorites ? '' : '-outline' }}</v-icon>
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
              :value="isGroupExpanded(groupId, groupIds)"
              @input="handleGroupExpanded(groupId, $event)"
            >
              <template #activator>
                <v-subheader>
                  <div class="flex">{{ groupId || '?' }}</div>
                  <v-icon
                    v-if="!onlyFavorites && hasFavorites(group)"
                    color="secondary"
                  >
                    mdi-star
                  </v-icon>
                </v-subheader>
              </template>

              <v-list two-line>
                <DancerListItem
                  v-for="dancer in group"
                  :key="dancer[idKey]"
                  :dancer="dancer"
                  :to="{ name: $route.name, params: { competitionId, dancerId: dancer[idKey] } }"
                />
              </v-list>
            </v-list-group>
          </v-list>
          <EmptyState
            v-else-if="!onlyFavorites"
            icon="mdi-alert-circle-outline"
            label="No dancers match"
          />
          <EmptyState
            v-else-if="me"
            icon="mdi-star-half"
            label="No favourite dancers"
          />
          <EmptyState
            v-else
            icon="mdi-star-half"
            label="No favourite dancers"
            description="Login to highlight your favourites–making them much easier to find"
          />
        </div>
      </div>
      <EmptyState
        v-else
        icon="mdi-close"
        label="No dancers yet"
        description="Check back later"
      />
    </Blade>
    <Blade :active="currentDancer" class="col-md-6">
      <div v-if="currentDancer" class="app-scroll-frame">
        <BladeToolbar
          :to="{ name: $route.name, params: { competitionId } }"
          class="hidden-md-and-up"
        />

        <div
          v-persist-scroll="`/competitions/${competitionId}/dancers/${dancerId}`"
          class="app-scroll-frame app-scroll"
        >
          <DancerReport
            :dancer="currentDancer"
            :dancers="dancers"
            :dances="dances"
            :groups="groups"
            :results="results"
          />
        </div>
      </div>
      <EmptyState
        v-else
        icon="mdi-gesture-tap"
        label="See dancer details"
        description="Select a dancer"
      />
    </Blade>
  </Blades>
</template>

<script>
import orderBy from 'lodash.orderby';
import groupBy from 'lodash.groupby';
import SearchField from '@/components/SearchField.vue';
import DancerListItem from '@/components/DancerListItem.vue';
import DancerReport from '@/components/DancerReport.vue';
import BladeToolbar from '@/components/BladeToolbar.vue';
import { idKey } from '@/helpers/firebase';
import { searchByKeys, hasFavorites } from '@/helpers/competition';
import {
  isExpanded,
  handleExpanded,
} from '@/helpers/router';

export default {
  name: 'CompetitionDancers',
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
    searchKeys() {
      return this.sortableBys
        .map(({ key, searchKey }) => searchKey || key)
        .concat(['$name']);
    },
    groupedDancers() {
      let filtered = this.dancers;

      // filter by search term
      filtered = searchByKeys(filtered, this.filterBy, this.searchKeys);

      // filter by onlyFavorites, if necessary
      if (this.onlyFavorites) {
        filtered = filtered.filter(dancer => dancer && dancer.$favorite);
      }

      // sort by key
      if (this.sortBy) {
        filtered = orderBy(filtered, [this.sortBy, '$number']);
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
    BladeToolbar,
  },
};
</script>
