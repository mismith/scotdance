<template>
  <swiper class="competition-dancers md-scroll-frame swiper-no-swiping">
    <swiper-slide>
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

      <div v-if="loaded" class="md-scroll">
        <md-list>
           <md-list-item
            v-for="bucket in bucketedDancers"
            :key="bucket[idKey]"
            md-expand
            :class="{'md-active': filterBy /* @TODO */}"
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
                @click="selected = { bucket, dancer }"
              />
            </md-list>
          </md-list-item>
        </md-list>
      </div>
      <md-progress-spinner v-else md-mode="indeterminate" style="margin: auto;" />
    </swiper-slide>
    <swiper-slide>
      <div v-if="selected" class="md-scroll-frame">
        <md-toolbar class="md-dense">
          <md-button @click="selected = null;" class="md-icon-button">
            <md-icon>chevron_left</md-icon>
          </md-button>
          <span>Dancers</span>
        </md-toolbar>
        <md-list class="md-double-line md-scroll">
          <div class="md-padding">
            <!--@TODO-->
            <div>Name: {{ selected.dancer.$name }}</div>
            <div>Location: {{ selected.dancer.location }}</div>
            <div>Age Group: {{ selected.dancer.$group && selected.dancer.$group.$name }}</div>
          </div>
        </md-list>
      </div>
    </swiper-slide>
  </swiper>
</template>

<script>
import FuzzySearch from 'fuzzy-search';
import ArraySort from 'array-sort';
import DancerListItem from '@/components/dancer-list-item';
import {
  idKey,
} from '@/helpers/firebase';
import {
  hasFavorites,
} from '@/helpers/competition';

export default {
  name: 'competition-dancers',
  props: {
    competitionDataRef: {
      type: Object,
      required: true,
    },
    dancers: Array,
    groups: Array,
  },
  data() {
    return {
      idKey,

      loaded: false,

      filterBy: undefined,
      sortBy: '$group.$order',

      selected: undefined,
    };
  },
  computed: {
    filteredDancers() {
      // filter by search term
      const filtered = this.filterBy
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
  },
  watch: {
    selected(selected) {
      if (selected) {
        this.$el.swiper.slideTo(1);
      } else {
        this.$el.swiper.slideTo(0);
      }
    },
  },
  methods: {
    hasFavorites,

    getSortCategory(dancer) {
      if (!dancer) return undefined;

      switch (this.sortBy) {
        case 'number': {
          return undefined;
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
    await this.competitionDataRef.once('value');
    this.loaded = true;
  },
  components: {
    DancerListItem,
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
