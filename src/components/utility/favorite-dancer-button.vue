<template>
  <md-button
    @click.prevent.stop="toggleFavoriteDancer(dancer)"
    class="favorite-dancer-button md-icon-button"
  >
    <md-icon :class="{ 'md-accent': dancer.$favorite }">
      {{ dancer.$favorite ? 'star' : 'star_border' }}
    </md-icon>
  </md-button>
</template>

<script>
import {
  mapActions,
} from 'vuex';

export default {
  name: 'favorite-dancer-button',
  props: {
    dancer: Object,
  },
  methods: {
    ...mapActions([
      'toggleFavoriteDancer',
    ]),
  },
};
</script>

<style lang="scss">
.favorite-dancer-button {

}
</style>
