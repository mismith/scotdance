<template>
  <div class="CompetitionsList app-scroll-frame alt">
    <template v-if="loaded">
      <template v-if="competitions.length">
        <v-toolbar class="flex-none">
          <SearchField v-model="competitionsSearchFor" class="mr-2" />
          <v-menu v-model="isLocationFilterOpen" right offset-y :close-on-content-click="false" min-width="200" max-width="300" max-height="75vh">
            <template #activator="{ on, attrs }">
              <v-btn icon v-on="on" v-bind="attrs">
                <v-badge
                  :value="Boolean(competitionsLocationFilter.length)"
                  :content="competitionsLocationFilter.length"
                  color="secondary"
                  :offset-x="8"
                  :offset-y="8"
                >
                  <v-icon>{{ mdiEarth }}</v-icon>
                </v-badge>
              </v-btn>
            </template>

            <v-card>
              <v-subheader>Locations:</v-subheader>
              <v-treeview
                v-model="competitionsLocationFilter"
                :items="locationsItems"
                selection-color="primary"
                selectable
                open-all
                class="mr-3"
              />
              <v-card tile style="position: sticky; bottom: 0;">
                <v-divider />
                <v-card-actions>
                  <v-btn text @click="competitionsLocationFilter = []; isLocationFilterOpen = false;">Clear</v-btn>
                  <v-btn text color="primary" class="ml-auto" @click="isLocationFilterOpen = false">Done</v-btn>
                </v-card-actions>
              </v-card>
            </v-card>
          </v-menu>
        </v-toolbar>

        <div class="app-scroll-frame" style="position: relative;">
          <div
            v-persist-scroll="'/competitions'"
            class="app-scroll-frame app-scroll scroller"
            ref="scroller"
          >
            <v-timeline v-if="filteredTimelineCompetitions.length > 1" dense class="pr-3">
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
                  v-if="competition[idKey] === NOW_MARKER"
                  :key="`${competition[idKey]}-now`"
                  id="now-marker"
                  small
                  color="secondary"
                  class="now"
                  v-observe-visibility="handleNowVisibilityChange"
                >
                  <MarkerChip small>Now</MarkerChip>
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
            >
              <div v-if="competitionsLocationFilter.length">
                Try searching in <a @click="competitionsLocationFilter = []">all locations</a>
              </div>
            </EmptyState>
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
import groupBy from 'lodash.groupby';
import {
  mdiAlertCircleOutline,
  mdiChevronDown,
  mdiChevronUp,
  mdiClose,
  mdiEarth,
} from '@mdi/js';
import { idKey } from '@/helpers/firebase';
import { searchByKeys } from '@/helpers/competition';
import { submissionsFields } from '@/schemas/submissions';
import SearchField from '@/components/SearchField.vue';
import CompetitionTimelineItem from '@/components/CompetitionTimelineItem.vue';
import MarkerChip from '@/components/MarkerChip.vue';

const NOW_MARKER = '__NOW__';

export default {
  name: 'CompetitionsList',
  reactiveInject: {
    competitionsBundle: [
      'competitions',
      'competitionsRef',
    ],
  },
  localStorage: {
    competitionsSearchFor: {
      type: String,
      default: '',
    },
    competitionsLocationFilter: {
      type: Array,
      default: [],
    },
  },
  data() {
    return {
      NOW_MARKER,
      idKey,
      mdiAlertCircleOutline,
      mdiChevronDown,
      mdiChevronUp,
      mdiClose,
      mdiEarth,

      loaded: false,

      nowVisibility: 0,
      isLocationFilterOpen: false,
    };
  },
  computed: {
    locations() {
      const locations = Object.keys(groupBy(this.competitions || [], 'location') || {}).sort();
      return locations;
    },
    locationsItems() {
      const groups = this.locations?.map((location) => {
        const id = location.trim();
        const [, place, area] = id.match(/(.*?)\s*,\s*([A-Z][A-Z])$/i) || [undefined, id];
        return {
          id,
          area: area?.trim() || '',
          place: place?.trim() || '',
        };
      });
      const items = Object.entries(groupBy(groups, 'area') || {}).map(([area, group]) => ({
        id: area || group[0]?.id,
        name: area || group[0]?.place,
        children: area
          ? group.map(({ id, place }) => ({ id, name: place })).sort((a, b) => a.name.localeCompare(b.name))
          : undefined,
      }));
      return items.sort((a, b) => a.name.localeCompare(b.name));
    },
    searchKeys() {
      return submissionsFields.map(({ data }) => data);
    },
    filteredCompetitions() {
      let filtered = this.competitions;

      // filter by location(s)
      if (this.competitionsLocationFilter?.length) {
        filtered = filtered.filter(
          ({ location }) => this.competitionsLocationFilter.includes(location),
        );
      }

      // filter by search term
      if (this.competitionsSearchFor?.trim()) {
        filtered = searchByKeys(filtered, this.competitionsSearchFor.trim(), this.searchKeys);
      }

      return filtered;
    },
    filteredTimelineCompetitions() {
      let currentTimelineGroup;
      let firstPastEventIndex = -1;
      const filteredTimelineCompetitions = this.filteredCompetitions
        .map((competition, index) => {
          const $date = this.$moment(competition.date);
          let timelineGroup = $date.format('MMMM YYYY');
          if (timelineGroup !== currentTimelineGroup) {
            currentTimelineGroup = timelineGroup;
          } else {
            timelineGroup = undefined;
          }
          if (firstPastEventIndex < 0 && $date.isBefore()) {
            firstPastEventIndex = index;
          }

          return {
            ...competition,
            $timeline: timelineGroup,
          };
        });

      if (firstPastEventIndex >= 0) {
        filteredTimelineCompetitions.splice(firstPastEventIndex, 0, {
          [idKey]: NOW_MARKER,
        });
      } else {
        filteredTimelineCompetitions.push({
          [idKey]: NOW_MARKER,
        });
      }

      return filteredTimelineCompetitions;
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
    MarkerChip,
  },
};
</script>

<style lang="scss">
.CompetitionsList {
  .now-marker {
    opacity: 0.67;
    margin-left: 12px;
    margin-top: 32px;
    margin-bottom: 32px;
  }
}
</style>
