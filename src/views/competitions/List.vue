<template>
  <div class="CompetitionsList app-scroll-frame alt">
    <div
      v-if="loaded"
      v-persist-scroll="'/competitions'"
      class="app-scroll-frame app-scroll"
    >

      <v-timeline dense class="mx-4">
        <template v-for="competition in timelineCompetitions">
          <v-timeline-item
            v-if="competition.$timeline"
            :key="competition[idKey]"
            hide-dot
            class="mt-6"
          >
            <span class="dimmed caption text-uppercase">{{ competition.$timeline }}</span>
          </v-timeline-item>

          <v-timeline-item
            v-if="competition[idKey] === '__NOW__'"
            :key="competition[idKey]"
            small
            color="secondary"
            class="now"
          >
            <v-chip color="secondary" small disabled style="opacity: 1;">Now</v-chip>
          </v-timeline-item>
          <CompetitionTimelineItem
            v-else
            :key="competition[idKey]"
            :competition="competition"
          />
        </template>
      </v-timeline>

      <div v-if="!competitions.length">
        <EmptyState
          icon="mdi-close"
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
      let firstPastEventIndex = -1;
      const timelineCompetitions = this.competitions
        .map((competition, index) => {
          const $date = this.$moment(competition.date);
          let timelineGroup = $date.format('MMMM YYYY');
          if (timelineGroup !== currentTimelineGroup) {
            currentTimelineGroup = timelineGroup;
          } else {
            timelineGroup = undefined;
          }
          if (firstPastEventIndex <= 0 && $date.isBefore()) {
            firstPastEventIndex = index;
          }

          return {
            ...competition,
            $timeline: timelineGroup,
          };
        });

      if (firstPastEventIndex >= 0) {
        timelineCompetitions.splice(firstPastEventIndex - 1, 0, {
          [idKey]: '__NOW__',
        });
      }

      return timelineCompetitions;
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

<style lang="scss">
@keyframes blink {
  0% { opacity: 100%; }
  100% { opacity: 0%; }
}
.CompetitionsList {
  .v-timeline-item.now {
    .v-timeline-item__dot {
      .v-timeline-item__inner-dot {
        animation: blink 1s infinite alternate;
      }
    }
  }
}
</style>
