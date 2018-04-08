<template>
  <swiper class="competition-results md-scroll-frame swiper-no-swiping">
    <swiper-slide class="md-scroll-frame">
      <div v-if="loaded" class="md-scroll">
        <md-list v-if="groups.length" class="md-list-cards">
          <md-list-item
            v-for="group in groups"
            :key="group[idKey]"
            md-expand
          >
            <md-subheader>
              {{ group.$name }}
              <md-icon v-if="hasFavorites(findGroupDancers(group))" class="md-accent">star</md-icon>
            </md-subheader>

            <md-list slot="md-expand">
              <result-list-item
                v-for="dance in findGroupDances(group)"
                :key="dance[idKey]"
                :winner="getGroupDanceWinner(group, dance)"
                @click="$router.push({ name: 'competition.results', params: { groupId: group[idKey], danceId: dance[idKey] }})"
              >
                {{ dance.$name }}
              </result-list-item>

              <div v-if="group.$category && group.$category.name !== 'Primary'">
                <md-divider class="md-inset" />
                <result-list-item
                  :winner="getGroupDanceWinner(group, overall)"
                  @click="$router.push({ name: 'competition.results', params: { groupId: group[idKey], danceId: overall[idKey] }})"
                >
                  {{ overall.$name }}
                  <md-icon class="icon-trophy" slot="icon" />
                </result-list-item>
              </div>
            </md-list>
          </md-list-item>
        </md-list>
        <md-empty-state
          v-else
          md-icon="error"
          md-label="No results yet"
        />
      </div>
      <md-progress-spinner v-else md-mode="indeterminate" style="margin: auto;" />
    </swiper-slide>
    <swiper-slide class="md-scroll-frame">
      <div v-if="currentGroup && currentDance" class="md-scroll-frame">
        <md-toolbar class="md-dense md-toolbar-nowrap">
          <md-button @click="$router.push({ name: 'competition.results' })" class="md-icon-button">
            <md-icon>chevron_left</md-icon>
          </md-button>
          <span>
            {{ currentGroup.$name }}
          </span>
        </md-toolbar>
        <md-subheader class="md-title">{{ currentDance.$name }}</md-subheader>
        <md-list class="md-double-line md-scroll md-list-cards md-list-cards-non-expanding">
          <dancer-list-item
            v-for="(dancer, index) in placedDancers"
            :key="dancer[idKey]"
            :dancer="dancer"
            :place="index + 1"
          />
          <md-subheader v-if="!placedDancers.length">Results to be determined.</md-subheader>
        </md-list>
      </div>
    </swiper-slide>
  </swiper>
</template>

<script>
import DancerListItem from '@/components/dancer-list-item';
import ResultListItem from '@/components/result-list-item';
import {
  idKey,
} from '@/helpers/firebase';
import {
  hasFavorites,
} from '@/helpers/competition';
import {
  overall,
  findGroupDancers,
  findGroupDances,
  getGroupDanceResults,
  getPlacedDancers,
  getGroupDanceWinner,
} from '@/helpers/results';

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
  data() {
    return {
      idKey,
      overall,

      loaded: false,
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
        if (this.danceId === 'overall') {
          return overall;
        }
        return this.dances.find(dance => dance[idKey] === this.danceId);
      }
      return null;
    },

    placedDancers() {
      let results = [];
      if (this.currentGroup && this.currentDance) {
        results = this.getGroupDanceResults(this.currentGroup, this.currentDance);
      }
      return this.getPlacedDancers(results);
    },
  },
  watch: {
    currentDance(currentDance) {
      if (currentDance) {
        this.$el.swiper.slideTo(1);
      } else {
        this.$el.swiper.slideTo(0);
      }
    },
  },
  methods: {
    hasFavorites,
    findGroupDancers,
    findGroupDances,
    getGroupDanceResults,
    getPlacedDancers,
    getGroupDanceWinner,
  },
  async mounted() {
    await this.competitionDataRef.once('value');
    this.loaded = true;
  },
  components: {
    DancerListItem,
    ResultListItem,
  },
};
</script>

<style lang="scss">
.competition-results {
  background: #eee;

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
}
</style>
