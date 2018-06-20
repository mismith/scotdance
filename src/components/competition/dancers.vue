<template>
  <div class="competition-dancers blades md-scroll-frame alt">
    <transition :name="`slide-${currentDancer ? 'left' : 'right'}`">
      <div v-if="!currentDancer" class="blade md-scroll-frame" key="list">
        <div v-if="dancers.length" class="md-scroll-frame">
          <md-toolbar>
            <md-field md-clearable style="margin-left: 8px; margin-right: 8px;">
              <label for="filterBy">Search</label>
              <md-input v-model="filterBy" id="filterBy" />
            </md-field>
            <md-menu md-direction="bottom-end" @selected="sortBy">
              <md-button md-menu-trigger class="md-icon-button">
                <md-icon>filter_list</md-icon>
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
              <md-icon>{{ onlyFavorites ? 'star' : 'star_border' }}</md-icon>
            </md-button>
            <!--<md-menu md-align-trigger>
              <md-button
                md-menu-trigger
                class="md-icon-button"
                style="margin-left: 12px; margin-right: 0;"
              >
                <md-icon>more_vert</md-icon>
              </md-button>
              <md-menu-content>
                <md-menu-item>Expand All</md-menu-item>
                <md-menu-item>Collapse All</md-menu-item>
              </md-menu-content>
            </md-menu>-->
          </md-toolbar>

          <div v-persist-scroll="$route.fullPath" class="md-scroll-frame md-scroll">
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
                <!--<span class="badge">{{ group.length }}</span>-->

                <md-list slot="md-expand" class="md-double-line">
                  <dancer-list-item
                    v-for="dancer in group"
                    :key="dancer[idKey]"
                    :dancer="dancer"
                    @click="$router.push({ params: { dancerId: dancer[idKey] }})"
                    :class="{ active: dancerId === dancer[idKey] }"
                  />
                </md-list>
              </md-list-item-cards>
            </md-list>
            <md-empty-state
              v-else
              md-icon="error_outline"
              md-label="No dancers match"
            />
          </div>
        </div>
        <md-empty-state
          v-else
          md-icon="clear"
          md-label="No dancers yet"
        />
      </div>
      <div v-else class="blade md-scroll-frame" key="detail">
        <md-toolbar class="md-dense md-toolbar-nowrap">
          <md-button :to="{ name: $route.name }" class="md-icon-button">
            <md-icon>chevron_left</md-icon>
          </md-button>
          <span>Dancers</span>
        </md-toolbar>

        <div v-persist-scroll="$route.fullPath" class="md-scroll-frame md-scroll">
          <dancer-report
            :dancer="currentDancer"
            :dances="dances"
            :groups="groups"
            :results="results"
          />
        </div>
      </div>
    </transition>
  </div>
</template>

<script>
import Fuse from 'fuse.js';
import sortBy from 'lodash.sortby';
import groupBy from 'lodash.groupby';
import DancerListItem from '@/components/utility/dancer-list-item';
import DancerReport from '@/components/utility/dancer-report';
import {
  idKey,
} from '@/helpers/firebase';
import {
  hasFavorites,
} from '@/helpers/competition';
import {
  isExpanded,
  handleExpanded,
} from '@/helpers/router';

export default {
  name: 'competition-dancers',
  props: {
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
        const searchKeys = this.sortableBys.map(({ key, searchKey }) => searchKey || key);
        filtered = new Fuse(filtered, { keys: searchKeys }).search(this.filterBy);
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
      if (this.filterBy) return true;

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
    DancerListItem,
    DancerReport,
  },
};
</script>

<style lang="scss">
.competition-dancers {
  .md-toolbar {
    flex-wrap: nowrap;

    .md-field {
      width: auto;
      flex: 1;
    }
  }
}
</style>
