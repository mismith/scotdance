<template>
  <md-list-item @click="$emit('click', $event)" class="dancer-list-item">
    <md-avatar class="md-avatar-icon" :class="{'md-accent': dancer.$favorite}">
      <span>{{ dancer.number }}</span>
    </md-avatar>

    <div class="md-list-item-text">
      <span>{{ dancer.$name }}</span>
      <p>{{ dancer.$group && dancer.$group.$name }} • {{ dancer.location }}</p>
    </div>

    <slot />

    <slot name="icon">
      <span v-if="place" class="place">{{ place }}<small class="ordinal">{{ getPlaceOrdinal(place) }}</small></span>
      <md-button v-else @click.stop="handleFavoriteToggle(dancer)" class="md-icon-button md-list-action">
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
    place: Number,
  },
  firebase: {
    favorites: db.child('users:favorites').child('idu0').child('dancers'), // @TODO
  },
  methods: {
    handleFavoriteToggle(dancer) {
      const toggled = dancer.$favorite ? null : true;
      return this.$firebaseRefs.favorites.child(dancer[idKey]).set(toggled);
    },
    getPlaceOrdinal(place) {
      switch (`${place}`) {
        case '1': {
          return 'st';
        }
        case '2': {
          return 'nd';
        }
        case '3': {
          return 'rd';
        }
        default: {
          return 'th';
        }
      }
    },
  },
};
</script>

<style lang="scss">
.dancer-list-item {
  .place {
    color: var(--md-theme-default-primary);
    font-size: 2em;
    font-weight: bold;

    .ordinal {
      display: inline-block;
      width: 20px; // aligns the ordinals despite varying character widths
      font-size: 0.5em;
      vertical-align: top;
    }
  }
}
</style>
