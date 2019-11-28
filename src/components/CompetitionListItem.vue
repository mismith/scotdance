<template>
  <v-list-item
    :to="to"
    class="CompetitionListItem"
    :class="{ listed: competition.listed, published: competition.published }"
  >
    <v-list-item-avatar color="white">
      <img v-if="competition.image" :src="competition.image" role="presentation" />
      <v-icon v-else>mdi-calendar</v-icon>
    </v-list-item-avatar>

    <v-list-item-content>
      <v-list-item-title>{{ competition.name }}</v-list-item-title>
      <v-list-item-sub-title class="dot-divided">
        <span v-if="competition.date">{{ $moment(competition.date).format('MMM D, YYYY') }}</span>
        <span v-if="competition.location">{{ competition.location }}</span>
      </v-list-item-sub-title>
    </v-list-item-content>

    <slot />

    <v-list-item-action v-if="$store.getters.hasPermission(`competitions/${competition[idKey]}`)">
      <v-btn
        icon
        :to="{ name: 'competition.admin.info', params: { competitionId: competition[idKey] } }"
      >
        <v-icon>mdi-pencil</v-icon>
      </v-btn>
    </v-list-item-action>
  </v-list-item>
</template>

<script>
import { idKey } from '@/helpers/firebase';

export default {
  name: 'CompetitionListItem',
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
.CompetitionListItem {
  &:not(.listed) {
    background: repeating-linear-gradient(-45deg, transparent, transparent 5px, rgba(0, 0, 0, 0.1) 5px, rgba(0, 0, 0, 0.1) 10px);
  }
  &:not(.published) {
    opacity: 0.5;
  }
}
</style>
