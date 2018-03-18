<template>
  <md-list-item @click="$emit('click', $event)" class="competition-list-item">
    <md-icon>event</md-icon>

    <div class="md-list-item-text">
      <span>{{ competition.name }}</span>
      <p>
        <span v-if="competition.date">{{ moment(competition.date).format('MMM D, YYYY') }}</span>
        <span v-if="competition.location">{{ competition.location }}</span>
      </p>
    </div>

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
import moment from 'moment-mini';
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
    moment,

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
  p {
    > span {
      &:not(:last-child) {
        &::after {
          content: " •";
          margin: 0 0.25em;
        }
      }
    }
  }
}
</style>
