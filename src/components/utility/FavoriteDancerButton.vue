<template>
  <v-btn
    icon
    flat
    :color="dancer.$favorite && 'secondary'"
    @click.prevent.stop="toggleFavoriteDancer(dancer)"
    class="favorite-dancer-button"
  >
    <v-icon>{{ dancer.$favorite ? 'star' : 'star_border' }}</v-icon>
  </v-btn>
</template>

<script>
import { mapActions } from 'vuex';

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
