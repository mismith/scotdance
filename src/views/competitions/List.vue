<template>
  <div class="CompetitionsList app-scroll-frame alt">
    <template v-if="loaded">
      <template v-if="competitions.length">
        <v-toolbar class="flex-none">
          <SearchField v-model="competitionsSearchFor" />
        </v-toolbar>

        <div class="app-scroll-frame" style="position: relative;">
          <div
            v-persist-scroll="'/competitions'"
            class="app-scroll-frame app-scroll scroller"
            ref="scroller"
          >
            <v-timeline v-if="filteredTimelineCompetitions.length" dense class="pr-3">
              <template v-for="competition in filteredTimelineCompetitions">
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
                  id="now-marker"
                  small
                  color="secondary"
                  class="now"
                  v-observe-visibility="handleNowVisibilityChange"
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
            <EmptyState
              v-else
              :icon="mdiAlertCircleOutline"
              label="No competitions match"
            />
          </div>

          <transition :name="`slide-y${nowVisibility > 0 ? '-reverse' : ''}-transition`">
            <v-btn
              v-if="nowVisibility"
              v-show="!competitionsSearchFor"
              :top="nowVisibility < 0"
              :bottom="nowVisibility > 0"
              left
              absolute
              small
              fab
              rounded
              color="accent"
              class="now-marker"
              @click="handleNowClick"
            >
              <v-icon>{{ nowVisibility > 0 ? mdiChevronDown : mdiChevronUp }}</v-icon>
            </v-btn>
          </transition>
        </div>
      </template>
      <div v-else class="app-scroll-frame">
        <EmptyState
          :icon="mdiClose"
          label="No competitions found"
        />
      </div>
    </template>
    <div v-else class="app-scroll-frame">
      <Spinner />
    </div>
  </div>
</template>

<script>
import {
  mdiAlertCircleOutline,
  mdiChevronDown,
  mdiChevronUp,
  mdiClose,
} from '@mdi/js';
import { idKey } from '@/helpers/firebase';
import { searchByKeys } from '@/helpers/competition';
import { submissionsFields } from '@/schemas/submissions';
import SearchField from '@/components/SearchField.vue';
import CompetitionTimelineItem from '@/components/CompetitionTimelineItem.vue';

export default {
  name: 'CompetitionsList',
  props: {
    competitions: Array,
    competitionsRef: Object,
  },
  localStorage: {
    competitionsSearchFor: {
      type: String,
      default: '',
    },
  },
  data() {
    return {
      idKey,
      mdiAlertCircleOutline,
      mdiChevronDown,
      mdiChevronUp,
      mdiClose,

      loaded: false,

      nowVisibility: 0,
    };
  },
  computed: {
    searchKeys() {
      return submissionsFields.map(({ data }) => data);
    },
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
        timelineCompetitions.splice(firstPastEventIndex, 0, {
          [idKey]: '__NOW__',
        });
      }

      return timelineCompetitions;
    },
    filteredTimelineCompetitions() {
      let filtered = this.timelineCompetitions;

      // filter by search term
      filtered = searchByKeys(filtered, this.competitionsSearchFor, this.searchKeys);

      return filtered;
    },
  },
  methods: {
    handleNowVisibilityChange(isVisible, { boundingClientRect: { top } }) {
      const direction = top < 100 ? -1 : 1;
      this.nowVisibility = isVisible ? 0 : direction;
    },
    handleNowClick() {
      const element = document.getElementById('now-marker');
      this.$scrollTo(element, {
        container: this.$refs.scroller,
        offset: -200,
      });
    },
  },
  async created() {
    await this.competitionsRef.once('value');

    this.loaded = true;
  },
  components: {
    SearchField,
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

  .now-marker {
    opacity: 0.67;
    margin-left: 12px;
    margin-top: 32px;
    margin-bottom: 32px;
  }
}
</style>
