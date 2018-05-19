<template>
  <swiper class="competition-dancers md-scroll-frame swiper-no-swiping alt">
    <swiper-slide>
      <div v-if="dancers.length" class="md-scroll-frame">
        <md-toolbar class="md-dense">
          <md-field md-clearable>
            <label for="filterBy">Search</label>
            <md-input v-model="filterBy" id="filterBy" />
          </md-field>
          <span style="display: inline-block; width: 12px;" />
          <md-field>
            <label for="sortBy">Sort by</label>
            <md-select v-model="sortBy" id="sortBy">
              <md-option value="$group.$order">Age Group</md-option>
              <md-option value="firstName">First Name</md-option>
              <md-option value="lastName">Last Name</md-option>
              <md-option value="location">Location</md-option>
              <md-option value="number">Number</md-option>
            </md-select>
          </md-field>
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
          <md-list v-if="bucketedDancers.length" class="md-list-cards">
             <md-list-item
              v-for="bucket in bucketedDancers"
              :key="bucket[idKey]"
              md-expand
              :md-expanded="forceExpanded"
            >
              <md-subheader>
                {{ bucket[idKey] }}
                <md-icon v-if="hasFavorites(bucket.dancers)" class="md-accent">star</md-icon>
              </md-subheader>
              <span class="badge">{{ bucket.dancers.length }}</span>

              <md-list slot="md-expand" class="md-double-line">
                <dancer-list-item
                  v-for="dancer in bucket.dancers"
                  :key="dancer[idKey]"
                  :dancer="dancer"
                  @click="$router.push({ name: 'competition.dancers', params: { dancerId: dancer[idKey] }})"
                />
              </md-list>
            </md-list-item>
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
import DancerListItem from '@/components/dancer-list-item';
import DancerReport from '@/components/dancer-report';
import {
  idKey,
} from '@/helpers/firebase';
import {
  hasFavorites,
} from '@/helpers/competition';

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
  data() {
    return {
      idKey,

      filterBy: undefined,
      sortBy: '$group.$order',
    };
  },
  computed: {
    currentDancer() {
      if (this.dancerId) {
        return this.dancers.find(dancer => dancer[idKey] === this.dancerId);
      }
      return null;
    },

    filteredDancers() {
      // filter by search term
      const filtered = this.filterBy && this.dancers.length
        ? new FuzzySearch(this.dancers, ['number', 'firstName', 'lastName', 'location', '$group.$name']).search(this.filterBy)
        : this.dancers;

      // sort by key
      if (this.sortBy) ArraySort(filtered, [this.sortBy, 'number']);

      return filtered;
    },
    bucketedDancers() {
      const buckets = {};
      this.filteredDancers.forEach((dancer) => {
        const bucket = this.getSortCategory(dancer);
        buckets[bucket] = buckets[bucket] || [];
        buckets[bucket].push(dancer);
      });
      return Object.entries(buckets)
        .map(([bucket, dancers]) => ({
          [idKey]: bucket,
          dancers,
        }));
    },
    forceExpanded() {
      return !!this.filterBy || this.sortBy === 'number';
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

    getSortCategory(dancer) {
      if (!dancer) return undefined;

      switch (this.sortBy) {
        case 'number': {
          return 'Number';
        }
        case 'firstName':
        case 'lastName': {
          return dancer[this.sortBy][0];
        }
        case '$group.$order': {
          return dancer.$group && dancer.$group.$name;
        }
        default: {
          return dancer[this.sortBy];
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
    .md-field {
      width: auto;
      flex: 1;
    }
  }
}
</style>
