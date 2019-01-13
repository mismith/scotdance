<template>
  <blades class="competition-results alt">
    <blade
      :active="!currentGroup"
      v-persist-scroll="`/competitions/${competitionId}/results`"
      class="xs12 md4 app-scroll"
    >
      <v-list v-if="groupedCategories.length" expand class="grouped">
        <v-list-group
          v-for="category in groupedCategories"
          :key="category[idKey]"
          lazy
          :value="isCategoryExpanded(category, groupedCategories)"
          @input="handleCategoryExpanded(category[idKey], $event)"
        >
          <v-subheader slot="activator">
            <v-flex>{{ category.name }}</v-flex>
            <v-icon v-if="hasFavorites(findCategoryDancers(category, dancers))" color="secondary">
              star
            </v-icon>
            <results-progress-indicator
              :category="category"
              :groups="groups"
              :dances="dances"
              :results="results"
            />
          </v-subheader>

          <v-list>
            <result-list-item
              v-for="group in category.$groups"
              :key="group[idKey]"
              :to="{ name: $route.name, params: { groupId: group[idKey] } }"
              :dancers="findPlacedDancers(group, callbacks, dancers, results)"
              :has-placeholder-dancers="isInProgress(group, dances, results)"
            >
              {{ group.name }}
            </result-list-item>
            <v-list-tile v-if="!category.$groups.length" class="empty">
              <v-list-tile-avatar>
                <v-icon>clear</v-icon>
              </v-list-tile-avatar>
              No more info.
            </v-list-tile>
          </v-list>
        </v-list-group>
      </v-list>
      <empty-state
        v-else
        icon="clear"
        label="No results yet"
        description="Check back later"
      />
    </blade>
    <blade :active="currentGroup" class="xs12 md8">
      <div v-if="currentGroup" class="app-scroll-frame">
        <v-toolbar dense class="hidden-md-and-up">
          <v-btn flat icon :to="{ name: $route.name, params: { competitionId } }">
            <v-icon>chevron_left</v-icon>
          </v-btn>
          <span>
            {{ currentGroup.$name }}
          </span>
        </v-toolbar>

        <div
          id="results-detail"
          v-persist-scroll="`/competitions/${competitionId}/results/${groupId}`"
          class="app-scroll-frame app-scroll"
        >
          <v-list expand class="grouped">
            <v-list-group
              v-for="dance in groupedDancers"
              :key="dance.name"
              lazy
              :id="`dance-${dance[idKey]}`"
              :value="isDanceExpanded(dance, groupedDancers)"
              @input="handleDanceExpanded(dance[idKey], $event)"
            >
              <v-subheader slot="activator">{{ dance.$name }}</v-subheader>

              <placed-dancer-list
                :dance="dance"
                :dancers="dance.dancers"
                @dancer-click="$router.push({ name: 'competition.dancers', params: { dancerId: $event[idKey] }})"
              >
                <v-list-tile v-if="!dance.dancers.length" class="empty">
                  <v-list-tile-avatar>
                    <v-icon>clear</v-icon>
                  </v-list-tile-avatar>
                  Results to be determined.
                </v-list-tile>

                <v-divider v-if="currentGroup.sponsor && dance[idKey] === overall[idKey]" />
                <v-list-tile
                  v-if="currentGroup.sponsor && dance[idKey] === overall[idKey]"
                  @click="showTrophy = true"
                >
                  <v-list-tile-content>
                    <v-list-tile-title>
                      {{ currentGroup.sponsor }}
                    </v-list-tile-title>
                    <v-list-tile-sub-title>
                      {{ currentGroup.trophy || '' }} Trophy Sponsor
                    </v-list-tile-sub-title>
                  </v-list-tile-content>
                </v-list-tile>
              </placed-dancer-list>
            </v-list-group>
          </v-list>
        </div>

        <dialog-card v-model="showTrophy" :title="currentGroup.sponsor">
          <div class="pre-line">{{ currentGroup.trophy || '' }} Trophy Sponsor</div>
        </dialog-card>
      </div>
      <empty-state
        v-else
        icon="touch_app"
        label="See results"
        description="Select an age group"
      />
    </blade>
  </bladeS>
</template>

<script>
import ResultListItem from '@/components/utility/ResultListItem.vue';
import PlacedDancerList from '@/components/utility/PlacedDancerList.vue';
import ResultsProgressIndicator from '@/components/utility/ResultsProgressIndicator.vue';
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
  name: 'competition-results',
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
  },
  components: {
    ResultListItem,
    PlacedDancerList,
    ResultsProgressIndicator,
  },
};
</script>

<style lang="scss">
.competition-results {
  .dancer-list-item {
    .group {
      display: none;
    }
  }
}
</style>
