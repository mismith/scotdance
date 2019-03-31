<template>
  <v-timeline-item
    :small="!competition.image"
    :large="competition.image"
    class="CompetitionTimelineItem"
  >
    <router-link
      slot="icon"
      v-if="competition.image"
      :to="{ name: 'competition.info', params: { competitionId: competition[idKey] } }"
    >
      <v-avatar color="white">
        <img :src="competition.image" role="presentation" />
      </v-avatar>
    </router-link>
    <router-link :to="{ name: 'competition.info', params: { competitionId: competition[idKey] } }">
      <div class="subheading">{{ competition.name }}</div>
      <div class="dot-divided dimmed">
        <span v-if="competition.date">{{ $moment(competition.date).format('MMM D, YYYY') }}</span>
        <span v-if="competition.location">{{ competition.location }}</span>
      </div>
    </router-link>

    <footer v-if="$store.getters.hasPermission(`competitions/${competition[idKey]}`)" class="my-3">
      <v-btn
        :to="{ name: 'competition.admin.info', params: { competitionId: competition[idKey] } }"
        :color="!competition.listed ? 'default' : (!competition.published ? 'secondary' : 'primary')"
        small
        class="ma-0"
      >
        <template v-if="!competition.listed">Unlisted</template>
        <template v-else-if="!competition.published">Unpublished</template>
        <template v-else>Administer</template>
      </v-btn>
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
};
</script>

<style lang="scss">
.CompetitionTimelineItem {
  a {
    color: inherit;
    text-decoration: inherit;
  }

  &:not(.listed) .v-btn.default {
    background: repeating-linear-gradient(-45deg, transparent, transparent 5px, rgba(0, 0, 0, 0.1) 5px, rgba(0, 0, 0, 0.1) 10px);
  }
}
</style>
