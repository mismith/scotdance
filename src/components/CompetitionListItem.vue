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
      <v-list-item-title class="d-flex align-center">
        <span class="text-truncate">
          {{ competition.name }}
        </span>
        <MarkerChip v-if="this.$moment(competition.date).isSame(this.$moment(), 'day')" class="ml-2" />
      </v-list-item-title>
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
import MarkerChip from '@/components/MarkerChip.vue';
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
  components: {
    MarkerChip,
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
