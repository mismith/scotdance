<template>
  <v-list-tile
    :to="to"
    class="competition-list-item"
    :class="{ listed: competition.listed, published: competition.published }"
  >
    <v-list-tile-avatar color="white">
      <img v-if="competition.image" :src="competition.image" role="presentation" />
      <v-icon v-else>event</v-icon>
    </v-list-tile-avatar>

    <v-list-tile-content>
      <v-list-tile-title>{{ competition.name }}</v-list-tile-title>
      <v-list-tile-sub-title class="dot-divided">
        <span v-if="competition.date">{{ $moment(competition.date).format('MMM D, YYYY') }}</span>
        <span v-if="competition.location">{{ competition.location }}</span>
      </v-list-tile-sub-title>
    </v-list-tile-content>

    <slot />

    <v-list-tile-action v-if="$store.getters.hasPermission(`competitions/${competition[idKey]}`)">
      <v-btn
        icon
        :to="{ name: 'competition.admin.info', params: { competitionId: competition[idKey] } }"
      >
        <v-icon>edit</v-icon>
      </v-btn>
    </v-list-tile-action>
  </v-list-tile>
</template>

<script>
import { idKey } from '@/helpers/firebase';

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
};
</script>

<style lang="scss">
.competition-list-item {
  &:not(.listed) {
    background: repeating-linear-gradient(-45deg, transparent, transparent 5px, rgba(0, 0, 0, 0.1) 5px, rgba(0, 0, 0, 0.1) 10px);
  }
  &:not(.published) {
    opacity: 0.5;
  }
}
</style>
