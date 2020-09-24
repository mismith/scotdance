<template>
  <v-btn
    icon
    text
    :color="dancer.$favorite && 'secondary'"
    @click.prevent.stop="toggleFavoriteDancer(dancer)"
    class="FavoriteDancerButton"
  >
    <v-icon>{{ dancer.$favorite ? mdiStar : mdiStarOutline }}</v-icon>
  </v-btn>
</template>

<script>
import { mapActions } from 'vuex';
import { mdiStar, mdiStarOutline } from '@mdi/js';

export default {
  name: 'FavoriteDancerButton',
  props: {
    dancer: Object,
  },
  data() {
    return {
      mdiStar,
      mdiStarOutline,
    };
  },
  methods: {
    ...mapActions([
      'toggleFavoriteDancer',
    ]),
  },
};
</script>
