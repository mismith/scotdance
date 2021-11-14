<template>
  <div class="CompetitionResults alt app-scroll-frame">
    <Blades v-if="!isTabDisabled">
      <Blade
        :active="!currentGroup"
        v-persist-scroll="`/competitions/${competitionId}/results`"
        class="col-md-4 app-scroll"
      >
        <v-list v-if="groupedCategories.length" expand class="grouped">
          <v-list-group
            v-for="category in groupedCategories"
            :key="category[idKey]"
            :value="isCategoryExpanded(category, groupedCategories)"
          >
            <template #activator>
              <v-subheader @click.stop="handleCategoryExpanded(category[idKey], !isCategoryExpanded(category, groupedCategories))">
                <div class="flex">{{ category.name }}</div>
                <v-icon
                  v-if="hasFavorites(findCategoryDancers(category, dancers))"
                  color="secondary"
                >
                  {{ mdiStar }}
                </v-icon>
                <ResultsProgressIndicator
                  :category="category"
                  :groups="groups"
                  :dances="dances"
                  :results="results"
                />
              </v-subheader>
            </template>

            <v-list>
              <ResultListItem
                v-for="group in category.$groups"
                :key="group[idKey]"
                :to="{ name: $route.name, params: { groupId: group[idKey] } }"
                :dancers="findPlacedDancers(group, callbacks, dancers, results, false, true)"
                :has-placeholder-dancers="isInProgress(group, dances, results)"
              >
                {{ group.name || group.$name }}
              </ResultListItem>
              <v-list-item v-if="!category.$groups.length" class="empty">
                <v-list-item-avatar>
                  <v-icon>{{ mdiClose }}</v-icon>
                </v-list-item-avatar>
                <v-list-item-content>
                  No more info.
                </v-list-item-content>
              </v-list-item>
            </v-list>
          </v-list-group>
        </v-list>
        <EmptyState
          v-else
          :icon="mdiClose"
          label="No results yet"
          description="Check back later"
        />
      </Blade>
      <Blade :active="currentGroup" class="col-md-8">
        <div v-if="currentGroup" class="app-scroll-frame">
          <BladeToolbar
            :to="{ name: $route.name, params: { competitionId } }"
            :text="currentGroup.$name"
          >
            <v-menu offset-y left>
              <template #activator="{ on }">
                <v-btn v-on="on" icon>
                  <v-icon>{{ mdiDotsVertical }}</v-icon>
                </v-btn>
              </template>

              <v-list flat>
                <v-list-item-group v-model="autoScrollResults">
                  <v-list-item :value="true" @click.stop>
                    <template #default="{ active }">
                      <v-list-item-avatar>
                        <v-icon>{{ mdiPanVertical }}</v-icon>
                      </v-list-item-avatar>
                      <v-list-item-content>
                        <v-list-item-title>Scroll to new results</v-list-item-title>
                      </v-list-item-content>
                      <v-list-item-action>
                        <v-switch :input-value="active" color="primary" />
                      </v-list-item-action>
                    </template>
                  </v-list-item>
                </v-list-item-group>
              </v-list>
            </v-menu>
          </BladeToolbar>

          <div
            id="results-detail"
            v-persist-scroll="`/competitions/${competitionId}/results/${groupId}`"
            class="app-scroll-frame app-scroll"
          >
            <v-list expand class="grouped">
              <v-list-group
                v-for="dance in groupedDancers"
                :key="dance.name"
                :id="`dance-${dance[idKey]}`"
                :value="isDanceExpanded(dance, groupedDancers)"
              >
                <template #activator>
                  <v-subheader @click.stop="handleDanceExpanded(dance[idKey], !isDanceExpanded(dance, groupedDancers))">
                    {{ dance.$name }}
                  </v-subheader>
                </template>

                <PlacedDancerList
                  :dance="dance"
                  :dancers="dance.dancers"
                  @dancer-click="$router.push({ name: 'competition.dancers', params: { dancerId: $event[idKey] }})"
                  @dancer-added="handleDancerAdded"
                >
                  <EmptyResults
                    v-if="!dance.dancers.length"
                    :groupId="currentGroup[idKey]"
                    :danceId="dance[idKey]"
                    :results="results"
                  />

                  <template v-if="currentSponsor && dance[idKey] === overall[idKey]">
                    <v-divider />
                    <v-list-item @click="setCurrentDialog(['staff', currentSponsor])">
                      <v-list-item-content>
                        <v-list-item-title>
                          {{ currentSponsor.$name }}
                        </v-list-item-title>
                        <v-list-item-subtitle>
                          {{ currentGroup.trophy || '' }} Trophy Sponsor
                        </v-list-item-subtitle>
                      </v-list-item-content>
                    </v-list-item>
                  </template>
                </PlacedDancerList>
              </v-list-group>
            </v-list>
          </div>
        </div>

        <EmptyState
          v-else
          :icon="mdiGestureTap"
          label="See results"
          description="Select an age group"
        />
      </Blade>
    </Blades>

    <EmptyState
      v-else
      :icon="mdiCardBulletedOffOutline"
      label="No results"
      description="Please see competition organizer for more information"
    />
  </div>
</template>

<script>
import { mapMutations } from 'vuex';
import {
  mdiStar,
  mdiCardBulletedOffOutline,
  mdiClose,
  mdiDotsVertical,
  mdiGestureTap,
  mdiPanVertical,
} from '@mdi/js';
import ResultListItem from '@/components/ResultListItem.vue';
import PlacedDancerList from '@/components/PlacedDancerList.vue';
import ResultsProgressIndicator from '@/components/ResultsProgressIndicator.vue';
import EmptyResults from '@/components/EmptyResults.vue';
import BladeToolbar from '@/components/BladeToolbar.vue';
import { pushidRegex, idKey } from '@/helpers/firebase';
import { findByIdKey, hasFavorites } from '@/helpers/competition';
import {
  all,
  overall,
  callbacks,
  isInProgress,
  findGroupDances,
  findGroupDancers,
  findCategoryDancers,
  findPlacedDancers,
  hasOverall,
} from '@/helpers/results';
import {
  isExpanded,
  handleExpanded,
  mapRouteParams,
} from '@/helpers/router';
import {
  isTabDisabled,
} from '@/helpers/tab';

export default {
  name: 'CompetitionResults',
  reactiveInject: {
    competitionBundle: [
      'competitionId',
      'dancers',
      'categories',
      'groups',
      'dances',
      'staff',
      'results',
    ],
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
    autoScrollResults: {
      type: Boolean,
      default: true,
    },
  },
  data() {
    return {
      idKey,
      mdiStar,
      mdiCardBulletedOffOutline,
      mdiClose,
      mdiDotsVertical,
      mdiGestureTap,
      mdiPanVertical,
      overall,
      callbacks,

      scrollTimeout: undefined,
    };
  },
  computed: {
    ...mapRouteParams([
      'groupId',
      'danceId',
    ]),

    isTabDisabled() {
      return isTabDisabled(this.results);
    },

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
        }
        if (this.danceId === callbacks[idKey]) {
          return callbacks;
        }
        return findByIdKey(this.dances, this.danceId);
      }
      return null;
    },
    currentSponsor() {
      const { sponsor: $name } = this.currentGroup || {};
      if (pushidRegex.test($name)) {
        const staff = this.staff.find((s) => s[idKey] === $name);
        if (staff) return staff;
      }
      return $name && { $name };
    },

    groupedCategories() {
      return this.categories.map((category) => ({
        ...category,
        $groups: this.groups.filter((group) => group.categoryId === category[idKey]),
      }));
    },
    groupedDancers() {
      const groups = [
        callbacks,
        ...(this.currentGroup ? findGroupDances(this.currentGroup, this.dances) : []),
      ];

      if (hasOverall(this.currentGroup || {})) {
        groups.push(overall);
      }

      return [
        {
          ...all,
          dancers: findGroupDancers(this.currentGroup, this.dancers),
        },
        ...groups.map((dance) => {
          const sortByNumber = dance[idKey] === callbacks[idKey];
          const dancers = findPlacedDancers(this.currentGroup, dance, this.dancers, this.results, sortByNumber);

          return {
            ...dance,
            dancers,
          };
        }),
      ];
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
    findGroupDancers,
    findCategoryDancers,
    findPlacedDancers,
    ...mapMutations([
      'setCurrentDialog',
    ]),

    isCategoryExpanded(item, items) {
      const itemIds = items.map((i) => i[idKey]);
      return isExpanded(this.resultsExpandedCategories, item[idKey], itemIds, true);
    },
    handleCategoryExpanded(categoryId, expanded) {
      this.resultsExpandedCategories = handleExpanded(this.resultsExpandedCategories, categoryId, expanded);
      this.$localStorage.set('resultsExpandedCategories', this.resultsExpandedCategories);
    },

    isDanceExpanded(item, items) {
      const itemIds = items.map((i) => i[idKey]);
      const expandByDefault = item[idKey] !== all[idKey];
      return isExpanded(
        this.resultsExpandedDances[this.groupId],
        item[idKey],
        itemIds,
        expandByDefault,
      );
    },
    handleDanceExpanded(danceId, expanded) {
      this.resultsExpandedDances = {
        ...this.resultsExpandedDances,
        [this.groupId]: handleExpanded(
          this.resultsExpandedDances[this.groupId],
          danceId,
          expanded,
        ),
      };
      this.$localStorage.set('resultsExpandedDances', this.resultsExpandedDances);
    },

    handleDancerAdded(dancer, el) {
      if (this.autoScrollResults) {
        const container = document.querySelector('#results-detail');
        this.$scrollAll(el, {
          container,
          offset: (el.offsetHeight - container.offsetHeight) / 2, // center vertically
        });
      }
    },
  },
  components: {
    ResultListItem,
    PlacedDancerList,
    ResultsProgressIndicator,
    EmptyResults,
    BladeToolbar,
  },
};
</script>

<style lang="scss">
.CompetitionResults {
  .DancerListItem {
    .group,
    .location::before {
      display: none;
    }
  }
}
</style>
