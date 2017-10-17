<template>
  <md-list-item>
    <md-avatar class="md-avatar-icon" :class="{'md-accent': dancer.$favorite}">
      <span>{{ dancer.number }}</span>
    </md-avatar>

    <div class="md-list-text-container">
      <span>{{ dancer.firstName }} {{ dancer.lastName }}</span>
      <p>{{ dancer.$group && dancer.$group.$name }} • {{ dancer.location }}</p>
    </div>

    <slot />

    <md-button @click="handleFavoriteToggle(dancer)" class="md-icon-button md-list-action">
      <md-icon :class="{'md-accent': dancer.$favorite}">{{ dancer.$favorite ? 'star' : 'star_border' }}</md-icon>
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
  firebase: {
    favorites: db.child('users:favorites').child('idu0').child('dancers'),
  },
  methods: {
    handleFavoriteToggle(dancer) {
      const toggled = dancer.$favorite ? null : true;
      return this.$firebaseRefs.favorites.child(dancer[idKey]).set(toggled);
    },
  },
};
</script>

<style lang="scss">

</style>
