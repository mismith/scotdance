<template>
  <v-btn
    icon
    text
    :color="dancer.$favorite && 'secondary'"
    @click.prevent.stop="toggleFavoriteDancer(dancer)"
    class="FavoriteDancerButton"
  >
    <v-icon>{{ dancer.$favorite ? 'star' : 'star_border' }}</v-icon>
  </v-btn>
</template>

<script>
import { mapActions } from 'vuex';

export default {
  name: 'FavoriteDancerButton',
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
