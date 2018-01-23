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

      <div class="md-scroll">
        <md-list class="md-list">
           <md-list-item
            v-for="bucket in bucketedDancers"
            :key="bucket[idKey]"
            md-expand
            :class="{'md-active': filterBy}"
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
                @click="selected = {bucket, dancer}"
              />
            </md-list>
          </md-list-item>

          <md-progress-spinner md-mode="indeterminate" v-if="!loaded" style="margin: auto;" />
        </md-list>
      </div>
    </swiper-slide>
    <swiper-slide>
      <div class="md-scroll-frame">
        <md-toolbar class="md-dense">
          <md-button @click="selected = null;" class="md-icon-button">
            <md-icon>chevron_left</md-icon>
          </md-button>
          <span>All dancers</span>
        </md-toolbar>
        <md-list class="md-double-line md-scroll">
          <div v-if="selected" class="md-padding">
            <!--@TODO-->
            Name: {{ selected.dancer.firstName }} {{ selected.dancer.lastName }}<br />
            Age Group: {{ selected.bucket[idKey] }}<br />
          </div>
        </md-list>
      </div>
    </swiper-slide>
  </swiper>
</template>

<script>
import FuzzySearch from 'fuzzy-search';
import ArraySort from 'array-sort';
import DancersGroupsFavoritesMixin from '@/mixins/dancers-groups-favorites';
import DancerListItem from '@/components/dancer-list-item';
import {
  idKey,
} from '@/helpers/firebase';

export default {
  name: 'competition-dancers',
  mixins: [
    DancersGroupsFavoritesMixin,
  ],
  data() {
    return {
      idKey,

      loaded: false,

      filterBy: undefined,
      sortBy: '$group.$order',

      selected: undefined,
    };
  },
  firebase() {
    return {
      // from DancersGroupsFavoritesMixin
      dancersRaw: this.competitionDataRef.child('dancers'),
      groupsRaw: this.competitionDataRef.child('groups'),
      levels: this.competitionDataRef.child('levels'),
      favorites: this.userFavoritesRef.child('dancers'),
    };
  },
  computed: {
    filteredDancers() {
      const dancers = this.dancers.map(dancer => ({
        ...dancer,
        number: `${dancer.number}`, // stringify this so ArraySort doesn't fail for Number-type
      }));

      // filter by search term
      const filtered = this.filterBy
        ? new FuzzySearch(dancers, ['number', 'firstName', 'lastName', 'location', '$group.$name']).search(this.filterBy)
        : dancers;

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
        this.$el.swiper.slideNext();
      } else {
        this.$el.swiper.slidePrev();
      }
    },
  },
  methods: {
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
  created() {
    return Promise.all([
      this.$firebaseRefs.dancersRaw.once('value'),
      this.$firebaseRefs.groupsRaw.once('value'),
    ])
      .then(() => {
        this.loaded = true;
      });
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
