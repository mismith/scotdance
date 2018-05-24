<template>
  <md-list-item
    @click="$emit('click', $event)"
    class="competition-list-item"
    :class="{ published: competition.published }"
  >
    <md-icon>event</md-icon>

    <div class="md-list-item-text">
      <span>{{ competition.name }}</span>
      <p>
        <span v-if="competition.date">{{ moment(competition.date).format('MMM D, YYYY') }}</span>
        <span v-if="competition.location">{{ competition.location }}</span>
      </p>
    </div>

    <slot />

    <md-button
      v-if="me && me.admin"
      class="md-icon-button md-list-action"
      @click.stop="$router.push(`/competitions/${competition[idKey]}/admin`); $emit('admin-click', $event);"
    >
      <md-icon>settings</md-icon>
    </md-button>
  </md-list-item>
</template>

<script>
import moment from 'moment-mini';
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
  methods: {
    moment,
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
  &:not(.published) {
    opacity: 0.5;
  }
}
</style>
