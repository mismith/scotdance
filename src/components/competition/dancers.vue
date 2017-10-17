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
      <!--<md-button class="md-icon-button">
        <md-icon>more_vert</md-icon>
      </md-button>-->
    </md-toolbar>
    <md-list class="md-scroll">
      <md-list-item
        v-for="bucket in bucketedDancers"
        :key="bucket[idKey]"
        md-expand-multiple
        :class="{'md-active': filterBy}"
      >
        <md-subheader>{{ bucket[idKey] }}</md-subheader>
        <span class="badge">{{ bucket.dancers.length }}</span>
        <md-list-expand>
          <md-list class="md-double-line">
            <dancer-list-item v-for="dancer in bucket.dancers" :dancer="dancer" v-show="1" />
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
import DancersGroupsMixin from '@/mixins/dancers-groups';
import DancerListItem from '@/components/dancer-list-item';
import {
  idKey,
} from '@/helpers/firebase';

export default {
  name: 'competition-dancers',
  mixins: [
    DancersGroupsMixin,
  ],
  data() {
    return {
      idKey,

      loaded: false,

      filterBy: undefined,
      sortBy: '$group.$order',
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
  .md-list-item {
    .badge {
      line-height: 1.2;
      background-color: rgba(0,0,0,.2);
      color: #FFF;
      font-size: .85em;
      padding: 2px 6px;
      margin-right: 12px;
      border-radius: 10px;
      opacity: 1;
      transition: opacity 300ms;
    }
    .md-subheader {
      flex-grow: 1;

      ~ .md-list-expand-indicator {
        flex: 0;
      }
    }
    &:not(.md-active) {
      .badge {
        opacity: 0;
      }
    }
  }
}
</style>
