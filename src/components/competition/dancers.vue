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
      <md-spinner md-indeterminate v-if="!dancersLoaded" style="margin: auto;" />
      <!--<md-subheader class="md-inset">Dancers</md-subheader>-->

      <md-list-item v-for="dancer in dancers" :key="dancer[idKey]" :class="{'md-primary': isFavorite(dancer)}">
        <md-avatar class="md-avatar-icon">
          <span>{{ dancer.number }}</span>
        </md-avatar>

        <div class="md-list-text-container">
          <span>{{ dancer.firstName }} {{ dancer.lastName }}</span>
          <p>{{ dancer.level }} • {{ dancer.location }}</p>
        </div>

        <md-button @click="handleFavoriteToggle(dancer)" class="md-icon-button md-list-action">
          <md-icon>{{ isFavorite(dancer) ? 'star' : 'star_border' }}</md-icon>
        </md-button>
      </md-list-item>
    </md-list>
  </div>
</template>

<script>
import FuzzySearch from 'fuzzy-search';
import ArraySort from 'array-sort';
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
    favoritesRaw: db.child('users:favorites').child('idu0').child('dancers'),
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
    favorites() {
      return this.favoritesRaw;
    },
  },
  methods: {
    isFavorite(dancer) {
      return this.favorites.find(favorite => favorite[idKey] === dancer[idKey]);
    },
    handleFavoriteToggle(dancer) {
      const toggled = this.isFavorite(dancer) ? null : false;
      return this.$firebaseRefs.favoritesRaw.child(dancer[idKey]).set(toggled);
    },
  },
  created() {
    return this.$firebaseRefs.dancersRaw.once('value')
      .then(() => {
        this.dancersLoaded = true;
      });
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
  > .md-list {
    .md-avatar {
      &.md-avatar-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #FFF;
      }
    }
  }
}
</style>
