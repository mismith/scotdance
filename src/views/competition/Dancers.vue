<template>
  <Blades class="CompetitionDancers alt">
    <Blade :active="!currentDancer" class="col-md-6">
      <div v-if="dancers.length" class="app-scroll-frame">
        <v-toolbar class="flex-none">
          <SearchField v-model="filterBy" class="mr-2" />
          <v-menu @selected="sortBy">
            <template #activator="{ on }">
              <v-btn icon v-on="on">
                <v-icon>{{ mdiSort }}</v-icon>
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
            <v-icon>{{ onlyFavorites ? mdiStar : mdiStarOutline }}</v-icon>
          </v-btn>
        </v-toolbar>

        <div
          v-persist-scroll="`/competitions/${competitionId}/dancers`"
          class="app-scroll-frame app-scroll"
          ref="scroller"
        >
          <v-list v-if="groupIds.length" expand class="grouped">
            <v-list-group
              v-for="(group, groupId) in groupedDancers"
              :key="groupId"
              :id="`group-${groupId}`"
              :value="isGroupExpanded(groupId, groupIds)"
              @click="handleGroupExpanded(groupId)"
            >
              <template #activator>
                <v-subheader>
                  <div class="flex">{{ groupId || '?' }}</div>
                  <v-icon
                    v-if="!onlyFavorites && hasFavorites(group)"
                    color="secondary"
                  >
                    {{ mdiStar }}
                  </v-icon>
                  <v-icon
                    v-else-if="groupId === SUGGESTIONS_NAME"
                    color="secondary"
                  >
                    {{ mdiStarShooting }}
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
            :icon="mdiAlertCircleOutline"
            label="No dancers match"
          />
          <EmptyState
            v-else-if="me"
            :icon="mdiStarHalf"
            label="No favourite dancers"
          />
          <EmptyState
            v-else
            :icon="mdiStarHalf"
            label="No favourite dancers"
            description="Login to highlight your favourites–making them much easier to find"
          />
        </div>
      </div>
      <EmptyState
        v-else
        :icon="mdiClose"
        label="No dancers yet"
        description="Check back later"
      />

      <v-banner
        v-model="isShowingFavoriteDancerSuggestionsBanner"
        single-line
        v-ripple
        @click.native="handleFavoriteDancerSuggestionsBannerClick()"
        class="FavoriteDancerSuggestionsBanner secondary"
      >
        <strong>{{competitionBundle.favoriteDancerSuggestions.length}} favourite dancer suggestions</strong><br />
        <small>based on your previous selections</small>
        <template #actions>
          <v-btn icon @click.stop="handleFavoriteDancerSuggestionsBannerDismiss()">
            <v-icon>{{ mdiClose }}</v-icon>
          </v-btn>
        </template>
      </v-banner>
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
        :icon="mdiGestureTap"
        label="See dancer details"
        description="Select a dancer"
      />
    </Blade>
  </Blades>
</template>

<script>
import { mapState } from 'vuex';
import orderBy from 'lodash.orderby';
import groupBy from 'lodash.groupby';
import {
  mdiSort,
  mdiStar,
  mdiStarOutline,
  mdiStarHalf,
  mdiStarShooting,
  mdiAlertCircleOutline,
  mdiClose,
  mdiGestureTap,
} from '@mdi/js';
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

const SUGGESTIONS_NAME = 'Suggested Favourites';

export default {
  name: 'CompetitionDancers',
  inject: ['competitionBundle'],
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
      SUGGESTIONS_NAME,

      idKey,
      mdiSort,
      mdiStar,
      mdiStarOutline,
      mdiStarHalf,
      mdiStarShooting,
      mdiAlertCircleOutline,
      mdiClose,
      mdiGestureTap,

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
    ...mapState([
      'me',
    ]),

    currentDancer() {
      if (this.dancerId) {
        return this.dancers.find((dancer) => dancer[idKey] === this.dancerId);
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
        filtered = filtered.filter((dancer) => dancer && dancer.$favorite);
      }

      // sort by key
      if (this.sortBy) {
        filtered = orderBy(filtered, [this.sortBy, '$number']);
      }

      // group together
      let grouped = groupBy(filtered, this.getSortGroup);

      if (this.onlyFavorites && this.competitionBundle?.favoriteDancerSuggestions?.length) {
        grouped = {
          [SUGGESTIONS_NAME]: this.competitionBundle?.favoriteDancerSuggestions,
          ...grouped,
        };
      }

      return grouped;
    },
    groupIds() {
      return Object.keys(this.groupedDancers);
    },

    isShowingFavoriteDancerSuggestionsBanner: {
      get() {
        return this.competitionBundle?.favoriteDancerSuggestions?.length
          && !this.$store.getters.isViewed('favoriteDancerSuggestions', this.competitionId);
      },
      set(v) {
        this.$store.commit('setViewed', ['favoriteDancerSuggestions', this.competitionId, !v, 50]);
      },
    },
  },
  methods: {
    hasFavorites,

    isGroupExpanded(itemId, itemIds) {
      // searching, so expand all groups
      if (this.filterBy || (this.onlyFavorites && itemId !== SUGGESTIONS_NAME)) return true;

      return isExpanded(this.dancersExpandedGroups[this.sortBy], itemId, itemIds);
    },
    handleGroupExpanded(groupId, expanded = undefined) {
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

    handleFavoriteDancerSuggestionsBannerDismiss() {
      this.isShowingFavoriteDancerSuggestionsBanner = false;
    },
    async handleFavoriteDancerSuggestionsBannerClick() {
      this.handleFavoriteDancerSuggestionsBannerDismiss();
      this.onlyFavorites = true;
      this.handleGroupExpanded(SUGGESTIONS_NAME, true);
      await this.$nextTick();
      const element = document.getElementById(`group-${SUGGESTIONS_NAME}`);
      this.$scrollTo(element, { container: this.$refs.scroller });
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

<style lang="scss">
.FavoriteDancerSuggestionsBanner {
  .v-banner__actions {
    margin-left: 0 !important;
  }
}
</style>
