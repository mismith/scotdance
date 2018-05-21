<template>
  <swiper class="competition-results md-scroll-frame swiper-no-swiping alt">
    <swiper-slide>
      <div class="md-scroll">
        <md-list v-if="groups.length" class="md-list-cards">
          <md-list-item
            v-for="group in groups"
            :key="group[idKey]"
            md-expand
            :md-expanded="group[idKey] === groupId"
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
      <div v-if="currentGroup && currentDance" class="md-scroll-frame">
        <md-toolbar class="md-dense md-toolbar-nowrap">
          <md-button @click="$router.go(-1)" class="md-icon-button">
            <md-icon>chevron_left</md-icon>
          </md-button>
          <span>
            {{ currentGroup.$name }}
          </span>
        </md-toolbar>

        <div class="md-scroll">
          <md-subheader class="md-title">{{ currentDance.$name }}</md-subheader>

          <md-list class="md-list-cards">
            <md-list-item
              v-for="group in groupedDancers"
              :key="group.name"
              md-expand
              md-expanded
            >
              <md-subheader>{{ group.name }}</md-subheader>

              <md-list slot="md-expand" class="md-double-line">
                <dancer-list-item
                  v-for="(dancer, index) in group.dancers"
                  :key="dancer[idKey]"
                  :dancer="dancer"
                  :place="group.placed && (danceId !== callbacks[idKey] ? index + 1 : undefined)"
                  @click="$router.push({ name: 'competition.dancers', params: { dancerId: dancer[idKey] }})"
                />
                <md-list-item v-if="!group.dancers.length" class="empty">
                  <span v-if="group.placed">Results to be determined.</span>
                  <span v-else>No dancers found.</span>
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
  findGroupDancers,
  getGroupDanceResults,
  getPlacedDancers,
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
    currentDancers() {
      if (this.currentGroup) {
        return this.findGroupDancers(this.currentGroup)
          .sort((a, b) => a.$number.localeCompare(b.$number));
      }
      return [];
    },
    placedDancers() {
      let results = [];
      if (this.currentGroup && this.currentDance) {
        results = this.getGroupDanceResults(this.currentGroup, this.currentDance);
      }
      return this.getPlacedDancers(results);
    },
    unplacedDancers() {
      const placedDancerIds = this.placedDancers.map(dancer => dancer[idKey]);
      return this.currentDancers.filter(dancer => !placedDancerIds.includes(dancer[idKey]));
    },
    groupedDancers() {
      return [
        {
          name: 'Dancers',
          dancers: this.placedDancers,
          placed: true,
        },
        // {
        //   name: 'Other Dancers',
        //   dancers: this.unplacedDancers,
        // },
      ];
    },
  },
  watch: {
    currentDance() {
      this.showRelevantSlide();
    },
  },
  methods: {
    hasFavorites,
    findGroupDancers,
    getGroupDanceResults,
    getPlacedDancers,

    showRelevantSlide() {
      if (this.currentDance) {
        this.$el.swiper.slideTo(1);
      } else {
        this.$el.swiper.slideTo(0);
      }
    },

    handleGroupExpanded(groupId, expanded) {
      if (expanded) {
        this.$router.replace({
          params: {
            groupId,
          },
        });
      }
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
}
</style>
