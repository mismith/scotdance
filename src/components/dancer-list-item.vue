<template>
  <md-list-item>
    <md-avatar class="md-avatar-icon" :class="{'md-accent': isFavorite(dancer)}">
      <span>{{ dancer.number }}</span>
    </md-avatar>

    <div class="md-list-text-container">
      <span>{{ dancer.firstName }} {{ dancer.lastName }}</span>
      <p>{{ dancer.$groupName }} • {{ dancer.location }}</p>
    </div>

    <slot />

    <md-button @click="handleFavoriteToggle(dancer)" class="md-icon-button md-list-action">
      <md-icon>{{ isFavorite(dancer) ? 'star' : 'star_border' }}</md-icon>
    </md-button>
  </md-list-item>
</template>

<script>
import {
  idKey,
  db,
} from '@/helpers/firebase';

export default {
  name: 'dancer-list-item',
  props: {
    dancer: Object,
  },
  data() {
    return {
      idKey,
    };
  },
  firebase: {
    favorites: db.child('users:favorites').child('idu0').child('dancers'),
    groups: db.child('competitionsData').child('idc0').child('groups'),
  },
  methods: {
    isFavorite(dancer) {
      return this.favorites.find(favorite => favorite[idKey] === dancer[idKey]);
    },
    handleFavoriteToggle(dancer) {
      const toggled = this.isFavorite(dancer) ? null : false;
      return this.$firebaseRefs.favorites.child(dancer[idKey]).set(toggled);
    },
  },
};
</script>

<style lang="scss">

</style>
