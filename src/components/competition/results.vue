<template>
  <div class="competition-results blades md-scroll-frame alt">
    <transition :name="`slide-${currentGroup ? 'left' : 'right'}`">
      <div v-if="!currentGroup" class="blade md-scroll-frame md-scroll" key="list">
        <results-list
          v-if="groups.length"
          :groups="groups"
          :dances="dances"
          :dancers="dancers"
          :results="results"
        />
        <md-empty-state
          v-else
          md-icon="error"
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

        <div id="results-detail" class="md-scroll-frame md-scroll">
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
                <md-list-item v-if="currentGroup.sponsor && dance[idKey] === overall[idKey]">
                  <div class="md-list-item-text">
                    <div>{{ currentGroup.sponsor }}</div>
                    <div>{{ currentGroup.trophy || '' }} Trophy Sponsor</div>
                  </div>
                </md-list-item>
              </placed-dancer-list>
            </md-list-item-cards>
          </md-list>
        </div>
      </div>
    </transition>
  </div>
</template>

<script>
import ResultsList from '@/components/utility/results-list';
import PlacedDancerList from '@/components/utility/placed-dancer-list';
import {
  idKey,
} from '@/helpers/firebase';
import {
  overall,
  callbacks,
  findGroupDances,
  getPlacedDancers,
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
    groups: Array,
    dances: Array,
    results: Object,
  },
  localStorage: {
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
    };
  },
  computed: {
    currentGroup() {
      if (this.groupId) {
        return this.groups.find(group => group[idKey] === this.groupId);
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
        return this.dances.find(dance => dance[idKey] === this.danceId);
      }
      return null;
    },
    currentDances() {
      if (this.currentGroup) {
        return this.findGroupDances(this.currentGroup);
      }
      return [];
    },
    groupedDancers() {
      const groups = [
        callbacks,
        ...this.currentDances,
      ];

      if (hasOverall(this.currentGroup)) {
        groups.push(overall);
      }

      return groups.map((dance) => {
        const sortByNumber = dance[idKey] === callbacks[idKey];
        const dancers = this.getPlacedDancers(this.currentGroup, dance, sortByNumber);

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
            duration: 1,
          });
        }, 250);
      }
    },
  },
  methods: {
    findGroupDances,
    getPlacedDancers,

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
    ResultsList,
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
