<template>
  <v-list-item
    :to="to"
    class="CompetitionListItem"
    :class="{
      listed: competition.listed,
      published: competition.published,
      stripes: !competition.listed,
    }"
  >
    <v-list-item-avatar v-if="competition.image" color="white">
      <img :src="competition.image" alt="" />
    </v-list-item-avatar>

    <v-list-item-content>
      <v-list-item-title>{{ competition.name }}</v-list-item-title>
      <v-list-item-subtitle class="dot-divided">
        <span v-if="competition.date">{{ $moment(competition.date).format('MMM D, YYYY') }}</span>
        <span v-if="competition.location">{{ competition.location }}</span>
      </v-list-item-subtitle>
    </v-list-item-content>

    <slot />

    <v-list-item-action v-if="$store.getters.hasPermission(`competitions/${competition[idKey]}`)">
      <v-btn
        icon
        :to="{ name: 'competition.admin.info', params: { competitionId: competition[idKey] } }"
      >
        <v-icon>{{ mdiPencil }}</v-icon>
      </v-btn>
    </v-list-item-action>

    <slot name="append" />
  </v-list-item>
</template>

<script>
import { mdiPencil } from '@mdi/js';
import { idKey } from '@/helpers/firebase';

export default {
  name: 'CompetitionListItem',
  props: {
    competition: Object,
    to: Object,
  },
  data() {
    return {
      idKey,
      mdiPencil,
    };
  },
};
</script>

<style lang="scss">
.CompetitionListItem {
  &:not(.published) {
    opacity: 0.5;
  }
}
</style>
