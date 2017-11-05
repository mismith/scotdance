<template>
  <div class="competition-dancers md-scroll-frame">
    <md-toolbar class="md-dense">
      <md-input-container md-clearable>
        <md-input v-model="filterBy" placeholder="Find dancers" />
      </md-input-container>
      <span style="display: inline-block; width: 12px;" />
      <md-input-container>
        <md-select v-model="sortBy" placeholder="Sort dancers">
          <md-option value="$group.$order">Age Group</md-option>
          <md-option value="firstName">First Name</md-option>
          <md-option value="lastName">Last Name</md-option>
          <md-option value="location">Location</md-option>
          <md-option value="number">Number</md-option>
        </md-select>
      </md-input-container>
      <!--<md-menu md-direction="bottom left">
        <md-button md-menu-trigger class="md-icon-button" style="margin-left: 12px; margin-right: 0;">
          <md-icon>more_vert</md-icon>
        </md-button>
        <md-menu-content>
          <md-menu-item>Expand All</md-menu-item>
          <md-menu-item>Collapse All</md-menu-item>
        </md-menu-content>
      </md-menu>-->
    </md-toolbar>
    <md-list class="md-scroll">
      <md-list-item
        v-for="bucket in bucketedDancers"
        :key="bucket[idKey]"
        md-expand-multiple
        :class="{'md-active': filterBy}"
      >
        <md-subheader>
          {{ bucket[idKey] }}
          <md-icon v-if="hasFavorites(bucket.dancers)" class="md-accent">star</md-icon>
        </md-subheader>
        <span class="badge">{{ bucket.dancers.length }}</span>
        <md-list-expand>
          <md-list class="md-double-line">
            <dancer-list-item v-for="dancer in bucket.dancers" :key="dancer[idKey]" :dancer="dancer" v-show="1" />
          </md-list>
        </md-list-expand>
      </md-list-item>

      <md-spinner md-indeterminate v-if="!loaded" style="margin: auto;" />
    </md-list>
  </div>
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
      sortBy: 'firstName',
    };
  },
  firebase() {
    return {
      // from DancersGroupsFavoritesMixin
      dancersRaw: this.competitionDataRef.child('dancers'),
      groupsRaw: this.competitionDataRef.child('groups'),
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
  > .md-toolbar {
    .md-input-container {
      width: auto;
      flex: 1;
    }
  }
}
</style>
