<template>
  <swiper class="competition-dancers md-scroll-frame swiper-no-swiping alt">
    <swiper-slide>
      <div v-if="dancers.length" class="md-scroll-frame">
        <md-toolbar>
          <md-field md-clearable style="margin-left: 8px; margin-right: 8px;">
            <label for="filterBy">Search</label>
            <md-input v-model="filterBy" id="filterBy" />
          </md-field>
          <md-menu md-direction="bottom-end" md-align-trigger @selected="sortBy">
            <md-button md-menu-trigger class="md-icon-button">
              <md-icon>filter_list</md-icon>
            </md-button>

            <md-menu-content>
              <md-menu-item
                v-for="by in sortableBy"
                :key="by.key"
                @click="sortBy = by.key"
                :class="{ active: sortBy === by.key }"
              >{{ by.name }}</md-menu-item>
            </md-menu-content>
          </md-menu>
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

      sortableBy: [
        { key: '$group.$name', name: 'Age Group' },
        { key: 'number', name: 'Number' },
        { key: 'location', name: 'Location' },
        { key: 'firstName', name: 'First Name' },
        { key: 'lastName', name: 'Last Name' },
      ],
      sortBy: '$group.$name',
      filterBy: undefined,
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
        ? new FuzzySearch(this.dancers, this.sortableBy.map(({ key }) => key)).search(this.filterBy)
        : this.dancers;

      // sort by key
      if (this.sortBy) ArraySort(filtered, [this.sortBy, 'number']);

      return filtered;
    },
    bucketedDancers() {
      const buckets = {};
      this.filteredDancers.forEach((dancer) => {
        const bucket = this.getSortCategory(dancer) || '?';
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
      return !!this.filterBy || this.bucketedDancers.length <= 1;
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

      const sortableBy = this.sortableBy.find(({ key }) => key === this.sortBy);
      const fallback = sortableBy && sortableBy.name;
      switch (this.sortBy) {
        case 'number': {
          return fallback;
        }
        case 'firstName':
        case 'lastName': {
          // get first letter
          return (dancer[this.sortBy] || '')[0] || fallback;
        }
        case '$group.$name': {
          return (dancer.$group && dancer.$group.$name) || fallback;
        }
        default: {
          return dancer[this.sortBy] || fallback;
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
