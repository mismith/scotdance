<template>
  <swiper class="competition-dancers md-scroll-frame swiper-no-swiping alt">
    <swiper-slide>
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

        <div class="md-scroll">
          <md-list v-if="Object.keys(groupedDancers).length" class="md-list-cards">
            <md-list-item-cards
              v-for="(group, groupId) in groupedDancers"
              :key="groupId"
              md-expand
              :md-expanded="isGroupExpanded(groupId, Object.keys(groupedDancers))"
              @update:mdExpanded="handleGroupExpanded(groupId, $event)"
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
        md-icon="error"
        md-label="No dancers yet"
      />
    </swiper-slide>
    <swiper-slide>
      <div v-if="currentDancer" class="md-scroll-frame">
        <md-toolbar class="md-dense md-toolbar-nowrap">
          <md-button @click="$router.go(-1)" class="md-icon-button">
            <md-icon>chevron_left</md-icon>
          </md-button>
          <span>Dancers</span>
        </md-toolbar>

        <dancer-report
          :dancer="currentDancer"
          :dances="dances"
          :groups="groups"
          :results="results"
          class="md-scroll"
        />
      </div>
    </swiper-slide>
  </swiper>
</template>

<script>
import FuzzySearch from 'fuzzy-search';
import ArraySort from 'array-sort';
import groupBy from 'lodash.groupby';
import DancerListItem from '@/components/dancer-list-item';
import DancerReport from '@/components/dancer-report';
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
    filteredDancers() {
      // filter by search term
      const searchKeys = this.sortableBys.map(({ key, searchKey }) => searchKey || key);
      let filtered = (this.filterBy && this.dancers.length)
        ? new FuzzySearch(this.dancers, searchKeys).search(this.filterBy)
        : this.dancers;

      // filter by onlyFavorites, if necessary
      if (this.onlyFavorites) {
        filtered = filtered.filter(dancer => dancer.$favorite);
      }

      // sort by key
      if (this.sortBy) {
        ArraySort(filtered, [this.sortBy, '$number']);
      }

      return filtered;
    },
    groupedDancers() {
      return groupBy(this.filteredDancers, this.getSortGroup);
    },
  },
  watch: {
    currentDancer() {
      this.showRelevantSlide();
    },
  },
  methods: {
    hasFavorites,

    showRelevantSlide() {
      if (this.currentDancer) {
        this.$el.swiper.slideTo(1);
      } else {
        this.$el.swiper.slideTo(0);
      }
    },

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
  async mounted() {
    this.showRelevantSlide();
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
