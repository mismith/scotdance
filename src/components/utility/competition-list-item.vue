<template>
  <md-list-item
    :to="to"
    class="competition-list-item"
    :class="{ listed: competition.listed, published: competition.published }"
  >
    <md-icon>event</md-icon>

    <div class="md-list-item-text">
      <span>{{ competition.name }}</span>
      <p>
        <span v-if="competition.date">{{ $moment(competition.date).format('MMM D, YYYY') }}</span>
        <span v-if="competition.location">{{ competition.location }}</span>
      </p>
    </div>

    <slot />

    <md-button
      v-if="me && me.admin"
      :to="{ name: 'competition.admin', params: { competitionId: competition[idKey] } }"
      class="md-icon-button md-list-action"
    >
      <md-icon>settings</md-icon>
    </md-button>
  </md-list-item>
</template>

<script>
import {
  mapState,
} from 'vuex';
import {
  idKey,
} from '@/helpers/firebase';

export default {
  name: 'competition-list-item',
  props: {
    competition: Object,
    to: true,
  },
  data() {
    return {
      idKey,
    };
  },
  computed: {
    ...mapState([
      'me',
    ]),
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
  &:not(.listed) {
    background: repeating-linear-gradient(-45deg, transparent, transparent 5px, rgba(0, 0, 0, 0.1) 5px, rgba(0, 0, 0, 0.1) 10px);
  }
  &:not(.published) {
    opacity: 0.5;
  }
}
</style>
