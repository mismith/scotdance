<template>
  <swiper class="competition-results md-scroll-frame swiper-no-swiping alt">
    <swiper-slide>
      <div class="md-scroll">
        <md-list v-if="groups.length" class="md-list-cards">
          <md-list-item
            v-for="group in groups"
            :key="group[idKey]"
            md-expand
            :md-expanded="isGroupExpanded(group, groups)"
            @update:mdExpanded="handleGroupExpanded(group[idKey], $event)"
          >
            <md-subheader>
              {{ group.$name }}
              <md-icon v-if="hasFavorites(findGroupDancers(group))" class="md-accent">star</md-icon>
            </md-subheader>

            <results-list
              slot="md-expand"
              :group="group"
              :dances="dances"
              :dancers="dancers"
              :results="results"
            />
          </md-list-item>
        </md-list>
        <md-empty-state
          v-else
          md-icon="error"
          md-label="No results yet"
        />
      </div>
    </swiper-slide>
    <swiper-slide class="md-scroll-frame">
      <div v-if="currentGroup" class="md-scroll-frame">
        <md-toolbar class="md-dense md-toolbar-nowrap">
          <md-button @click="$router.go(-1)" class="md-icon-button">
            <md-icon>chevron_left</md-icon>
          </md-button>
          <span>
            {{ currentGroup.$name }}
          </span>
        </md-toolbar>

        <div id="results-detail" class="md-scroll">
          <md-list class="md-list-cards">
            <md-list-item
              v-for="dance in groupedDancers"
              :key="dance.name"
              :id="`dance-${dance[idKey]}`"
              md-expand
              :md-expanded="isDanceExpanded(dance, groupedDancers)"
              @update:mdExpanded="handleDanceExpanded(dance[idKey], $event)"
            >
              <md-subheader>{{ dance.$name }}</md-subheader>

              <md-list slot="md-expand" class="md-double-line">
                <dancer-list-item
                  v-for="(dancer, index) in dance.dancers"
                  :key="dancer[idKey]"
                  :dancer="dancer"
                  :place="index + 1"
                  @click="$router.push({ name: 'competition.dancers', params: { dancerId: dancer[idKey] }})"
                >
                  <span v-if="dance[idKey] === callbacks[idKey]" slot="icon" />
                  <md-icon v-if="dance[idKey] === overall[idKey]" slot="icon" class="icon-trophy md-primary" />
                </dancer-list-item>
                <md-list-item v-if="!dance.dancers.length" class="empty">
                  Results to be determined.
                </md-list-item>
              </md-list>
            </md-list-item>
          </md-list>
        </div>
      </div>
    </swiper-slide>
  </swiper>
</template>

<script>
import DancerListItem from '@/components/dancer-list-item';
import ResultsList from '@/components/results-list';
import {
  idKey,
} from '@/helpers/firebase';
import {
  hasFavorites,
} from '@/helpers/competition';
import {
  overall,
  callbacks,
  findGroupDances,
  findGroupDancers,
  getGroupDanceResults,
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
    expandedGroups: {
      type: Object,
      default: {},
    },
    expandedDances: {
      type: Object,
      default: {}, // { [groupId]: {}, ... }
    },
  },
  data() {
    return {
      idKey,
      overall,
      callbacks,
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
        const results = this.getGroupDanceResults(this.currentGroup, dance);
        const dancers = this.getPlacedDancers(results);

        return {
          ...dance,
          dancers,
        };
      });
    },
  },
  watch: {
    currentDance() {
      this.showRelevantSlide();
    },
  },
  methods: {
    hasFavorites,
    findGroupDances,
    findGroupDancers,
    getGroupDanceResults,
    getPlacedDancers,

    showRelevantSlide() {
      if (this.currentDance) {
        this.$el.swiper.slideTo(1);

        // scroll to currentDance
        setTimeout(() => {
          this.$scrollTo(`#dance-${this.currentDance[idKey]}`, 0, {
            container: '#results-detail',
          });
        }, 100);
      } else {
        this.$el.swiper.slideTo(0);
      }
    },

    isGroupExpanded(item, items) {
      const itemIds = items.map(i => i[idKey]);
      return isExpanded(this.expandedGroups, item[idKey], itemIds);
    },
    handleGroupExpanded(groupId, expanded) {
      this.expandedGroups = handleExpanded(this.expandedGroups, groupId, expanded);
      this.$localStorage.set('expandedGroups', this.expandedGroups);
    },

    isDanceExpanded(item, items) {
      const itemIds = items.map(i => i[idKey]);
      return isExpanded(this.expandedDances[this.groupId], item[idKey], itemIds, true);
    },
    handleDanceExpanded(danceId, expanded) {
      this.expandedDances[this.groupId] = handleExpanded(
        this.expandedDances[this.groupId],
        danceId,
        expanded,
      );
      this.$localStorage.set('expandedDances', this.expandedDances);
    },
  },
  async mounted() {
    this.showRelevantSlide();
  },
  components: {
    DancerListItem,
    ResultsList,
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
