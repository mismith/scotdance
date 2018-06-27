<template>
  <div class="competition-results blades md-scroll-frame alt">
    <transition :name="`slide-${currentGroup ? 'left' : 'right'}`">
      <div
        v-if="!currentGroup"
        v-persist-scroll="$route.fullPath"
        class="blade md-scroll-frame md-scroll"
        key="list"
      >
        <md-list v-if="groupedCategories.length" class="md-list-cards">
          <md-list-item-cards
            v-for="category in groupedCategories"
            :key="category[idKey]"
            md-expand
            :md-expanded="isCategoryExpanded(category, groupedCategories)"
            @toggled="handleCategoryExpanded(category[idKey], $event)"
          >
            <md-subheader>
              <span>{{ category.name }}</span>
              <md-icon v-if="hasFavorites(dancers.filter(dancer => dancer.$group.categoryId === category[idKey]))" class="md-accent">
                star
              </md-icon>
              <md-icon v-if="checkCategoryGroups(category, group => results[group[idKey]])" class="md-primary summary-icon">
                {{ checkCategoryGroups(category, group => !results[group[idKey]] || isInProgress(group, dances, results)) ? 'check_circle_outline' : 'check_circle' }}
              </md-icon>
              <!-- <md-icon v-if="results[group[idKey]]" class="md-primary" style="margin-left: auto; margin-right: -16px;">
                {{ isInProgress(group, dances, results) ? 'check_circle_outline' : 'check_circle' }}
              </md-icon> -->
            </md-subheader>

            <md-list slot="md-expand">
              <result-list-item
                v-for="group in category.$groups"
                :key="group[idKey]"
                :to="{ params: { groupId: group[idKey] } }"
                :dancers="findPlacedDancers(group, callbacks, dancers, results)"
                :has-placeholder-dancers="isInProgress(group, dances, results)"
              >
                {{ group.name }}
                <md-icon v-if="checkCategoryGroups(category, group => results[group[idKey]])" class="md-primary summary-icon">
                  {{ checkCategoryGroups(category, group => !results[group[idKey]] || isInProgress(group, dances, results)) ? 'check_circle_outline' : 'check_circle' }}
                </md-icon>
              </result-list-item>
            </md-list>
          </md-list-item-cards>
        </md-list>
        <md-empty-state
          v-else
          md-icon="clear"
          md-label="No results yet"
        />
      </div>
      <div v-else class="blade md-scroll-frame" key="detail">
        <md-toolbar class="md-dense md-toolbar-nowrap">
          <md-button :to="{ name: $route.name }" class="md-icon-button">
            <md-icon>chevron_left</md-icon>
          </md-button>
          <span>
            {{ currentGroup.$name }}
          </span>
        </md-toolbar>

        <div id="results-detail" v-persist-scroll="$route.fullPath" class="md-scroll-frame md-scroll">
          <md-list class="md-list-cards">
            <md-list-item-cards
              v-for="dance in groupedDancers"
              :key="dance.name"
              :id="`dance-${dance[idKey]}`"
              md-expand
              :md-expanded="isDanceExpanded(dance, groupedDancers)"
              @toggled="handleDanceExpanded(dance[idKey], $event)"
            >
              <md-subheader>{{ dance.$name }}</md-subheader>

              <placed-dancer-list
                slot="md-expand"
                :dance="dance"
                :dancers="dance.dancers"
                @dancer-click="$router.push({ name: 'competition.dancers', params: { dancerId: $event[idKey] }})"
              >
                <md-list-item v-if="!dance.dancers.length" class="empty">
                  Results to be determined.
                </md-list-item>

                <md-divider v-if="currentGroup.sponsor && dance[idKey] === overall[idKey]" />
                <md-list-item
                  v-if="currentGroup.sponsor && dance[idKey] === overall[idKey]"
                  @click="showTrophy = true"
                >
                  <div class="md-list-item-text">
                    <div>{{ currentGroup.sponsor }}</div>
                    <div>{{ currentGroup.trophy || '' }} Trophy Sponsor</div>
                  </div>
                </md-list-item>
              </placed-dancer-list>
            </md-list-item-cards>
          </md-list>

          <md-dialog :md-active.sync="showTrophy" :md-fullscreen="false" class="trophy-dialog">
            <header>
              <md-subheader class="md-title">{{ currentGroup.sponsor }}</md-subheader>
              <div class="md-padding pre-line">{{ currentGroup.trophy || '' }} Trophy Sponsor</div>
            </header>
            <md-dialog-actions>
              <md-button @click="showTrophy = false" class="md-primary">Done</md-button>
            </md-dialog-actions>
          </md-dialog>
        </div>
      </div>
    </transition>
  </div>
</template>

<script>
import ResultListItem from '@/components/utility/result-list-item';
import PlacedDancerList from '@/components/utility/placed-dancer-list';
import {
  idKey,
} from '@/helpers/firebase';
import {
  findByIdKey,
  hasFavorites,
} from '@/helpers/competition';
import {
  overall,
  callbacks,
  isInProgress,
  findGroupDances,
  findPlacedDancers,
  hasOverall,
} from '@/helpers/results';
import {
  isExpanded,
  handleExpanded,
} from '@/helpers/router';

export default {
  name: 'competition-results',
  props: {
    groupId: String,
    danceId: String,
    competitionDataRef: {
      type: Object,
      required: true,
    },
    dancers: Array,
    categories: Array,
    groups: Array,
    dances: Array,
    results: Object,
  },
  localStorage: {
    resultsExpandedCategories: {
      type: Object,
      default: {},
    },
    resultsExpandedDances: {
      type: Object,
      default: {}, // { [groupId]: {}, ... }
    },
  },
  data() {
    return {
      idKey,
      overall,
      callbacks,

      scrollTimeout: undefined,
      showTrophy: false,
    };
  },
  computed: {
    currentGroup() {
      if (this.groupId) {
        return findByIdKey(this.groups, this.groupId);
      }
      return null;
    },
    currentDance() {
      if (this.danceId) {
        if (this.danceId === overall[idKey]) {
          return overall;
        } else if (this.danceId === callbacks[idKey]) {
          return callbacks;
        }
        return findByIdKey(this.dances, this.danceId);
      }
      return null;
    },

    groupedCategories() {
      return this.categories.map(category => ({
        ...category,
        $groups: this.groups.filter(group => group.categoryId === category[idKey]),
      }));
    },
    groupedDancers() {
      const groups = [
        callbacks,
        ...(this.currentGroup ? findGroupDances(this.currentGroup, this.dances) : []),
      ];

      if (hasOverall(this.currentGroup)) {
        groups.push(overall);
      }

      return groups.map((dance) => {
        const sortByNumber = dance[idKey] === callbacks[idKey];
        const dancers = findPlacedDancers(this.currentGroup, dance, this.dancers, this.results, sortByNumber);

        return {
          ...dance,
          dancers,
        };
      });
    },
  },
  watch: {
    currentDance(currentDance) {
      if (currentDance) {
        // scroll to currentDance
        if (this.scrollTimeout) clearTimeout(this.scrollTimeout);
        this.scrollTimeout = setTimeout(() => {
          this.$scrollAll(`#dance-${this.currentDance[idKey]}`, {
            container: '#results-detail',
          });
        }, 250);
      }
    },
  },
  methods: {
    hasFavorites,
    isInProgress,
    findPlacedDancers,

    checkCategoryGroups(category, check = () => {}) {
      return this.groups
        .filter(group => group.categoryId === category[idKey])
        .some(check);
    },

    isCategoryExpanded(item, items) {
      const itemIds = items.map(i => i[idKey]);
      return isExpanded(this.resultsExpandedCategories, item[idKey], itemIds, true);
    },
    handleCategoryExpanded(categoryId, expanded) {
      this.resultsExpandedCategories = handleExpanded(this.resultsExpandedCategories, categoryId, expanded);
      this.$localStorage.set('resultsExpandedCategories', this.resultsExpandedCategories);
    },

    isDanceExpanded(item, items) {
      const itemIds = items.map(i => i[idKey]);
      return isExpanded(this.resultsExpandedDances[this.groupId], item[idKey], itemIds, true);
    },
    handleDanceExpanded(danceId, expanded) {
      this.resultsExpandedDances[this.groupId] = handleExpanded(
        this.resultsExpandedDances[this.groupId],
        danceId,
        expanded,
      );
      this.$localStorage.set('resultsExpandedDances', this.resultsExpandedDances);
    },
  },
  components: {
    ResultListItem,
    PlacedDancerList,
  },
};
</script>

<style lang="scss">
.competition-results {
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
  .dancer-list-item {
    .group {
      display: none;
    }
  }
}
</style>
