<template>
  <v-timeline-item
    :small="!competition.image"
    :large="competition.image"
    class="CompetitionTimelineItem"
    :class="{ now }"
  >
    <template #icon>
      <router-link
        v-if="competition.image"
        :to="{ name: 'competition.info', params: { competitionId: competition[idKey] } }"
      >
        <v-avatar color="white">
          <img :src="competition.image" role="presentation" />
        </v-avatar>
      </router-link>
    </template>
    <router-link :to="{ name: 'competition.info', params: { competitionId: competition[idKey] } }">
      <div class="subtitle-1">{{ competition.name }}</div>
      <div class="dot-divided dimmed">
        <span v-if="competition.date">{{ $moment(competition.date).format('MMM D, YYYY') }}</span>
        <span v-if="competition.location">{{ competition.location }}</span>
      </div>
    </router-link>

    <footer v-if="$store.getters.hasPermission(`competitions/${competition[idKey]}`)" class="my-4">
      <v-btn
        :to="{ name: 'competition.admin.info', params: { competitionId: competition[idKey] } }"
        color="primary"
        small
        class="ma-0"
      >
        Administer
      </v-btn>
      <v-chip v-if="!competition.listed" small disabled class="stripes black--text ml-4">
        Unlisted
      </v-chip>
      <v-chip v-else-if="!competition.published" small disabled class="stripes black--text ml-4">
        Unpublished
      </v-chip>
    </footer>
  </v-timeline-item>
</template>

<script>
import { idKey } from '@/helpers/firebase';

export default {
  name: 'CompetitionTimelineItem',
  props: {
    competition: Object,
  },
  data() {
    return {
      idKey,
    };
  },
  computed: {
    now() {
      return this.competition.date && this.$moment(this.competition.date).isSame(this.$moment(), 'day');
    },
  },
};
</script>

<style lang="scss">
.CompetitionTimelineItem {
  .v-application & a {
    color: inherit;
    text-decoration: inherit;
  }
}
</style>
