<template>
  <Blades class="CompetitionResults alt">
    <Blade
      :active="!currentGroup"
      v-persist-scroll="`/competitions/${competitionId}/results`"
      class="xs12 md4 app-scroll"
    >
      <v-list v-if="groupedCategories.length" expand class="grouped">
        <v-list-group
          v-for="category in groupedCategories"
          :key="category[idKey]"
          :value="isCategoryExpanded(category, groupedCategories)"
          @input="handleCategoryExpanded(category[idKey], $event)"
        >
          <v-subheader slot="activator">
            <v-flex>{{ category.name }}</v-flex>
            <v-icon
              v-if="hasFavorites(findCategoryDancers(category, dancers))"
              color="secondary"
            >
              mdi-star
            </v-icon>
            <ResultsProgressIndicator
              :category="category"
              :groups="groups"
              :dances="dances"
              :results="results"
            />
          </v-subheader>

          <v-list>
            <ResultListItem
              v-for="group in category.$groups"
              :key="group[idKey]"
              :to="{ name: $route.name, params: { groupId: group[idKey] } }"
              :dancers="findPlacedDancers(group, callbacks, dancers, results)"
              :has-placeholder-dancers="isInProgress(group, dances, results)"
            >
              {{ group.name || group.$name }}
            </ResultListItem>
            <v-list-item v-if="!category.$groups.length" class="empty">
              <v-list-item-avatar>
                <v-icon>mdi-clear</v-icon>
              </v-list-item-avatar>
              No more info.
            </v-list-item>
          </v-list>
        </v-list-group>
      </v-list>
      <EmptyState
        v-else
        icon="mdi-clear"
        label="No results yet"
        description="Check back later"
      />
    </Blade>
    <Blade :active="currentGroup" class="xs12 md8">
      <div v-if="currentGroup" class="app-scroll-frame">
        <BladeToolbar
          :to="{ name: $route.name, params: { competitionId } }"
          :text="currentGroup.$name"
        >
          <v-menu offset-y left>
            <v-btn slot="activator" icon>
              <v-icon>mdi-more-vert</v-icon>
            </v-btn>
            <v-list>
              <v-list-item>
                <v-list-item-action>
                  <v-checkbox v-model="autoScrollResults" />
                </v-list-item-action>
                <v-list-item-content @click="autoScrollResults = !autoScrollResults">
                  <v-list-item-title>Scroll to new results</v-list-item-title>
                </v-list-item-content>
              </v-list-item>
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
              @input="handleDanceExpanded(dance[idKey], $event)"
            >
              <v-subheader slot="activator">{{ dance.$name }}</v-subheader>

              <PlacedDancerList
                :dance="dance"
                :dancers="dance.dancers"
                @dancer-click="$router.push({ name: 'competition.dancers', params: { dancerId: $event[idKey] }})"
                @dancer-added="handleDancerAdded"
              >
                <v-list-item v-if="!dance.dancers.length" class="empty">
                  <v-list-item-avatar>
                    <v-icon>mdi-clear</v-icon>
                  </v-list-item-avatar>
                  Results to be determined.
                </v-list-item>

                <v-divider v-if="currentGroup.sponsor && dance[idKey] === overall[idKey]" />
                <v-list-item
                  v-if="currentGroup.sponsor && dance[idKey] === overall[idKey]"
                  @click="showTrophy = true"
                >
                  <v-list-item-content>
                    <v-list-item-title>
                      {{ currentGroup.sponsor }}
                    </v-list-item-title>
                    <v-list-item-sub-title>
                      {{ currentGroup.trophy || '' }} Trophy Sponsor
                    </v-list-item-sub-title>
                  </v-list-item-content>
                </v-list-item>
              </PlacedDancerList>
            </v-list-group>
          </v-list>
        </div>

        <DialogCard v-model="showTrophy" :title="currentGroup.sponsor">
          <div class="pre-line">{{ currentGroup.trophy || '' }} Trophy Sponsor</div>
        </DialogCard>
      </div>
      <EmptyState
        v-else
        icon="mdi-touch-app"
        label="See results"
        description="Select an age group"
      />
    </Blade>
  </BladeS>
</template>

<script>
import ResultListItem from '@/components/ResultListItem.vue';
import PlacedDancerList from '@/components/PlacedDancerList.vue';
import ResultsProgressIndicator from '@/components/ResultsProgressIndicator.vue';
import BladeToolbar from '@/components/BladeToolbar.vue';
import { idKey } from '@/helpers/firebase';
import {
  findByIdKey,
  hasFavorites,
} from '@/helpers/competition';
import {
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
} from '@/helpers/router';

export default {
  name: 'CompetitionResults',
  props: {
    competitionId: String,
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
    autoScrollResults: {
      type: Boolean,
      default: true,
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

      if (hasOverall(this.currentGroup || {})) {
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
    findGroupDancers,
    findCategoryDancers,
    findPlacedDancers,

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
    BladeToolbar,
  },
};
</script>

<style lang="scss">
.CompetitionResults {
  .DancerListItem {
    .group {
      display: none;
    }
  }
}
</style>
