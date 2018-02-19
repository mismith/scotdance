<template>
  <md-list-item @click="$emit('click', $event)" class="competition-list-item">
    <md-icon>event</md-icon>

    <span class="md-list-item-text">{{ competition.name }}</span>

    <md-button
      v-if="$store.state.me"
      @click.stop="handleFavoriteToggle(competition)"
      class="md-icon-button md-list-action"
    >
      <md-icon :class="{'md-accent': competition.$favorite}">
        {{ competition.$favorite ? 'star' : 'star_border' }}
      </md-icon>
    </md-button>

    <slot />
  </md-list-item>
</template>

<script>
import {
  idKey,
  db,
} from '@/helpers/firebase';

export default {
  name: 'competition-list-item',
  props: {
    competition: Object,
  },
  methods: {
    handleFavoriteToggle(competition) {
      return db
        .child('users:favorites')
        .child(this.$store.state.me[idKey])
        .child('competitions')
        .child(competition[idKey])
        .set(competition.$favorite ? null : true);
    },
  },
};
</script>

<style lang="scss">
.competition-list-item {

}
</style>
