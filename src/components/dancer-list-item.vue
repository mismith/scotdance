<template>
  <md-list-item @click="$emit('click', $event)" class="dancer-list-item">
    <md-avatar class="md-avatar-icon" :class="{'md-accent': dancer.$favorite}">
      <span>{{ dancer.number }}</span>
    </md-avatar>

    <div class="md-list-item-text">
      <span>{{ dancer.$name }}</span>
      <p>{{ dancer.$group.$name }} • {{ dancer.location }}</p>
    </div>

    <slot />

    <slot name="icon">
      <md-button @click.stop="handleFavoriteToggle(dancer)" class="md-icon-button md-list-action">
        <md-icon :class="{'md-accent': dancer.$favorite}">
          {{ dancer.$favorite ? 'star' : 'star_border' }}
        </md-icon>
      </md-button>
    </slot>
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
    favorites: db.child('users:favorites').child('idu0').child('dancers'), // @TODO
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
