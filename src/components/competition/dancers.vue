<template>
  <div class="competition-dancers md-scroll-frame">
    <md-toolbar class="md-dense">
      <md-input-container md-clearable>
        <md-input v-model="filterBy" placeholder="Find dancers" />
      </md-input-container>
      <span style="display: inline-block; width: 12px;" />
      <md-input-container>
        <md-select v-model="sortBy" placeholder="Sort dancers">
          <md-option value="number">Number</md-option>
          <md-option value="firstName">First Name</md-option>
          <md-option value="lastName">Last Name</md-option>
          <md-option value="location">Location</md-option>
          <md-option value="level">Level</md-option>
        </md-select>
      </md-input-container>
      <!--<md-button class="md-icon-button">
        <md-icon>more_vert</md-icon>
      </md-button>-->
    </md-toolbar>
    <md-list class="md-double-line md-scroll">
      <!--<md-subheader class="md-inset">Dancers</md-subheader>-->

      <dancer-list-item v-for="dancer in dancers" :key="dancer[idKey]" :dancer="dancer" />

      <md-spinner md-indeterminate v-if="!dancersLoaded" style="margin: auto;" />
    </md-list>
  </div>
</template>

<script>
import FuzzySearch from 'fuzzy-search';
import ArraySort from 'array-sort';
import DancerListItem from '@/components/dancer-list-item';
import {
  idKey,
  db,
} from '@/helpers/firebase';

export default {
  name: 'competition-dancers',
  data() {
    return {
      idKey,

      dancersLoaded: false,

      filterBy: undefined,
      sortBy: undefined,
    };
  },
  firebase: {
    dancersRaw: db.child('competitionsData').child('idc0').child('dancers'),
  },
  computed: {
    dancers() {
      const dancers = this.dancersRaw.map(dancer => ({
        ...dancer,
        number: `${dancer.number}`, // stringify this so ArraySort doesn't fail for Number-type
      }));

      // filter by search term
      const filtered = (this.filterBy ? new FuzzySearch(dancers, ['number', 'firstName', 'lastName', 'location', 'level']).search(this.filterBy) : dancers);

      // sort by key
      if (this.sortBy) ArraySort(filtered, this.sortBy);

      return filtered;
    },
  },
  created() {
    return this.$firebaseRefs.dancersRaw.once('value')
      .then(() => {
        this.dancersLoaded = true;
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
