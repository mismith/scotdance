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
    <md-list class="md-double-line md-scroll">

      <div v-for="(dancer, i) in filteredDancers" :key="dancer[idKey]">
        <md-subheader v-if="getSortCategory(dancer) !== getSortCategory(filteredDancers[i - 1])">{{ getSortCategory(dancer) || 'Unknown' }}</md-subheader>
        <dancer-list-item :dancer="dancer" />
        <md-divider v-if="getSortCategory(dancer) !== getSortCategory(filteredDancers[i + 1])" />
      </div>

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
        ? new FuzzySearch(dancers, ['number', 'firstName', 'lastName', 'location', '$group.$order']).search(this.filterBy)
        : dancers;

      // sort by key
      if (this.sortBy) ArraySort(filtered, [this.sortBy, 'number']);

      return filtered;
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
    // padding-left: 16px;
    // padding-right: 16px;

    .md-input-container {
      width: auto;
      flex: 1;
    }
  }
}
</style>
