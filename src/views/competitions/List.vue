<template>
  <div class="CompetitionsList app-scroll-frame alt">
    <div
      v-if="loaded"
      v-persist-scroll="'/competitions'"
      class="app-scroll-frame app-scroll"
    >

      <v-timeline dense class="mx-3">
        <template v-for="competition in timelineCompetitions">
          <v-timeline-item
            v-if="competition.$timeline"
            :key="competition[idKey]"
            hide-dot
            class="mt-4"
          >
            <span class="dimmed caption text-uppercase">{{ competition.$timeline }}</span>
          </v-timeline-item>

          <CompetitionTimelineItem :key="competition[idKey]" :competition="competition" />
        </template>
      </v-timeline>

      <div v-if="!competitions.length">
        <EmptyState
          icon="clear"
          label="No competitions found"
        />
      </div>
    </div>
    <div v-else class="app-scroll-frame">
      <Spinner />
    </div>
  </div>
</template>

<script>
import CompetitionTimelineItem from '@/components/CompetitionTimelineItem.vue';
import { idKey } from '@/helpers/firebase';

export default {
  name: 'CompetitionsList',
  props: {
    competitions: Array,
    competitionsRef: Object,
  },
  data() {
    return {
      idKey,

      loaded: false,
    };
  },
  computed: {
    timelineCompetitions() {
      let currentTimelineGroup;
      return this.competitions
        .map((competition) => {
          const $date = this.$moment(competition.date);
          let timelineGroup = $date.format('MMMM YYYY');
          if (timelineGroup !== currentTimelineGroup) {
            currentTimelineGroup = timelineGroup;
          } else {
            timelineGroup = undefined;
          }

          return {
            ...competition,
            $timeline: timelineGroup,
          };
        });
    },
  },
  async created() {
    await this.competitionsRef.once('value');

    this.loaded = true;
  },
  components: {
    CompetitionTimelineItem,
  },
};
</script>
