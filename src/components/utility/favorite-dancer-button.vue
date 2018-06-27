<template>
  <md-button
    @click.stop="toggleFavoriteDancer(dancer)"
    class="favorite-dancer-button md-icon-button"
  >
    <md-icon :class="{ 'md-accent': dancer.$favorite }">
      {{ dancer.$favorite ? 'star' : 'star_border' }}
    </md-icon>
  </md-button>
</template>

<script>
import {
  toggleFavoriteDancer,
} from '@/helpers/competition';

export default {
  name: 'favorite-dancer-button',
  props: {
    dancer: Object,
  },
  methods: {
    toggleFavoriteDancer,
  },
};
</script>

<style lang="scss">
.favorite-dancer-button {

}
</style>
