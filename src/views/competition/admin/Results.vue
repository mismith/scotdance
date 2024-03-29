<template>
  <Blades class="CompetitionAdminResults" stacks>
    <Blade id="blade-groups" :active="!currentDance" class="col-md-4 app-scroll alt">
      <ResultsList
        v-if="groups.length"
        :groups="groups"
        :dances="dances"
        :dancers="dancers"
        :results="results"
        :points="points"
      />
      <EmptyState
        v-else
        :icon="mdiAlert"
        label="No age groups found"
      >
        <router-link :to="{ name: 'competition.admin.tab', params: { tab: 'groups' } }">
          <span class="subtitle-1">Add or import some first &rsaquo;</span>
        </router-link>
      </EmptyState>

      <v-spacer v-if="groups.length" />
      <v-toolbar class="flex-none">
        <v-switch
          :input-value="isTabDisabled"
          label="Hide results tab"
          hide-details
          :readonly="!hasNoExistingTabData && !isTabDisabled"
          @click="handleTabDisable"
          @change="handleTabDisable"
        />
      </v-toolbar>
    </Blade>
    <Blade id="blade-dancers" :active="currentDance" class="col-md-4 app-scroll-frame">
      <template v-if="currentDance">
        <v-tabs fixed-tabs class="flex-none">
          <v-tab :to="{ params: { tabId: null } }">Placings</v-tab>
          <v-tab :to="{ params: { tabId: 'points' } }">
            Points
            <HelpTip tip="championship-points" />
          </v-tab>
        </v-tabs>
        <v-divider />
        <v-tabs-items :value="tabId" class="app-scroll-frame">
          <v-tab-item value="placings" class="app-scroll-frame app-scroll">
            <v-list v-if="currentDancers.length" two-line>
              <DancerListItem
                v-for="dancer in currentDancers"
                :key="dancer[idKey]"
                :dancer="dancer"
                :disabled="isPointed(dancer)"
                :class="{ dimmed: isPlaced(dancer, placedDancers) || isPointed(dancer) }"
                @click="placeDancer(dancer)"
              >
                <template #favorite>
                  <v-icon v-if="isPointed(dancer)">{{ mdiCardsDiamond }}</v-icon>
                  <span v-else />
                </template>
              </DancerListItem>
              <DancerListItem
                :dancer="getPlaceholderDancer()"
                @click="placeDancer(getPlaceholderDancer())"
                class="placeholder"
              >
                <template #favorite>
                  <span />
                </template>
              </DancerListItem>
            </v-list>
            <EmptyState
              v-else-if="currentDance === callbacks"
              :icon="mdiAlert"
              label="No dancers found"
            >
              <router-link :to="{ name: 'competition.admin.tab', params: { tab: 'dancers' } }">
                <span class="subtitle-1">Add dancers with this age group first &rsaquo;</span>
              </router-link>
            </EmptyState>
            <EmptyState
              v-else
              :icon="mdiAlert"
              label="No dancers to place"
            >
              <router-link :to="{ name: 'competition.admin.results', params: { groupId, danceId: callbacks[idKey] } }">
                <span class="subtitle-1">Make sure enter callbacks first &rsaquo;</span>
              </router-link>
            </EmptyState>
          </v-tab-item>
          <v-tab-item value="points" class="app-scroll-frame app-scroll">
            <v-list v-if="currentDancers.length" two-line>
              <DancerListItem
                v-for="dancer in currentDancers"
                :key="dancer[idKey]"
                :dancer="dancer"
                :disabled="isPlaced(dancer, placedDancers)"
                :class="{ dimmed: isPlaced(dancer, placedDancers) || isPointed(dancer) }"
                @click="pointDancer(dancer)"
              >
                <template #favorite>
                  <v-icon v-if="isPointed(dancer)">{{ mdiCardsDiamond }}</v-icon>
                  <v-icon v-else-if="!isPlaced(dancer, placedDancers)">{{ mdiCardsDiamondOutline }}</v-icon>
                  <span v-else />
                </template>
              </DancerListItem>
              <DancerListItem
                :dancer="getPlaceholderDancer()"
                @click="pointDancer(getPlaceholderDancer())"
                class="placeholder"
              >
                <template #favorite>
                  <span />
                </template>
              </DancerListItem>
            </v-list>
            <EmptyState
              v-else-if="currentDance === callbacks"
              :icon="mdiAlert"
              label="No dancers found"
            >
              <router-link :to="{ name: 'competition.admin.tab', params: { tab: 'dancers' } }">
                <span class="subtitle-1">Add dancers with this age group first &rsaquo;</span>
              </router-link>
            </EmptyState>
            <EmptyState
              v-else
              :icon="mdiAlert"
              label="No dancers to place"
            >
              <router-link :to="{ name: 'competition.admin.results', params: { groupId, danceId: callbacks[idKey] } }">
                <span class="subtitle-1">Make sure enter callbacks first &rsaquo;</span>
              </router-link>
            </EmptyState>
          </v-tab-item>
        </v-tabs-items>
      </template>
      <EmptyState
        v-else
        :icon="mdiGestureTap"
        label="Enter results"
        description="Select an age group and dance"
      />
    </Blade>
    <Blade class="col-md-4 app-scroll">
      <template v-if="tabId === 'placings'">
        <PlacedDancerList
          v-if="currentDance && placedDancers.length"
          admin
          :dance="currentDance"
          :dancers="placedDancers"
          @dancer-click="placeDancer($event)"
          @dancer-toggle="handleTie($event[0], $event[1])"
          @dancer-reorder="handleDrag($event)"
        />
        <EmptyState
          v-else
          :icon="mdiViewSplitVertical"
          label="Order dancers"
          description="Select dancers in the order placed"
        />

        <v-toolbar v-if="currentGroup && currentDance && !placedDancers.length" class="flex-none">
          <v-switch
            v-model="currentDanceHasExplicitlyEmptyResults"
            :label="`No ${currentDance === callbacks ? 'callbacks' : 'dancers placed'}`"
            hide-details
          />
        </v-toolbar>
      </template>
      <template v-else-if="tabId === 'points'">
        <PlacedDancerList
          v-if="currentDance && pointedDancers.length"
          admin="nodrag"
          :dance="currentDance"
          :dancers="pointedDancers"
          @dancer-click="pointDancer($event)"
        />
        <EmptyState
          v-else
          :icon="mdiCardsDiamondOutline"
          label="Championship Points"
          description="Select dancers who didn't quite place"
        />
      </template>
    </Blade>

    <DialogCard
      :value="confirmDisable"
      title="Hide results tab"
      text="Are you sure you want to permanently delete all existing results data, and publicly hide the Results tab for this competition?"
      cancel-label="No"
      submit-label="Yes"
      @cancel="confirmDisable.reject()"
      @submit="confirmDisable.resolve()"
    />
  </Blades>
</template>

<script>
import {
  mdiAlert,
  mdiGestureTap,
  mdiViewSplitVertical,
  mdiCardsDiamond,
  mdiCardsDiamondOutline,
  mdiInformationVariant,
} from '@mdi/js';
import DancerListItem from '@/components/DancerListItem.vue';
import ResultsList from '@/components/admin/ResultsList.vue';
import PlacedDancerList from '@/components/PlacedDancerList.vue';
import HelpTip from '@/components/HelpTip.vue';

import { idKey } from '@/helpers/firebase';
import { findByIdKey } from '@/helpers/competition';
import { hasNoExistingTabData, isTabDisabled, handleTabDisable } from '@/helpers/tab';
import {
  overall,
  callbacks,
  getPlaceholderDancer,
  findGroupDancers,
  findPointedDancers,
  findPlacedDancers,
  getPlaceIndex,
  isPlaced,
  hasExplicitlyEmptyResults,
} from '@/helpers/results';
import { mapRouteParams } from '@/helpers/router';

export default {
  name: 'CompetitionAdminResults',
  reactiveInject: {
    competitionBundle: [
      'groups',
      'dances',
      'dancers',
      'results',
      'points',
    ],
  },
  data() {
    return {
      idKey,
      mdiAlert,
      mdiGestureTap,
      mdiViewSplitVertical,
      mdiCardsDiamond,
      mdiCardsDiamondOutline,
      mdiInformationVariant,
      overall,
      callbacks,

      confirmDisable: undefined,
    };
  },
  computed: {
    ...mapRouteParams([
      'groupId',
      'danceId',
    ]),

    tabId() {
      return this.$route.params.tabId || 'placings';
    },

    hasNoExistingTabData() {
      return hasNoExistingTabData(this.results);
    },
    isTabDisabled() {
      return isTabDisabled(this.results);
    },

    currentGroup() {
      if (this.groupId) {
        return findByIdKey(this.groups, this.groupId);
      }
      return null;
    },
    currentDance() {
      if (this.danceId) {
        if (this.danceId === overall[idKey]) {
          return overall;
        }
        if (this.danceId === callbacks[idKey]) {
          return callbacks;
        }
        return findByIdKey(this.dances, this.danceId);
      }
      return null;
    },
    isActualDance() {
      return ![overall, callbacks].some(({ [idKey]: id }) => id === this.danceId);
    },
    currentDancers() {
      if (this.currentGroup && this.currentDance) {
        if (this.currentDance[idKey] === callbacks[idKey] || this.tabId === 'points') {
          return findGroupDancers(this.currentGroup, this.dancers);
        }
        return findPlacedDancers(this.currentGroup, callbacks, this.dancers, this.results, true);
      }
      return [];
    },
    placedDancers() {
      if (this.currentGroup && this.currentDance) {
        const sortByNumber = this.currentDance[idKey] === callbacks[idKey];
        return findPlacedDancers(this.currentGroup, this.currentDance, this.dancers, this.results, sortByNumber);
      }
      return [];
    },
    pointedDancers() {
      if (this.groupId && this.danceId) {
        return findPointedDancers(this.points?.[this.groupId]?.[this.danceId], this.dancers);
      }
      return [];
    },
    currentDanceHasExplicitlyEmptyResults: {
      get() {
        return hasExplicitlyEmptyResults(this.groupId, this.danceId, this.results);
      },
      set(isExplicitlyEmpty) {
        this.save(isExplicitlyEmpty ? false : null);
      },
    },
  },
  watch: {
    currentDance: {
      async handler(currentDance) {
        await this.$nextTick();
        const id = currentDance ? 'dancers' : 'groups';
        const element = document.getElementById(`blade-${id}`);
        this.$scrollTo(element, { container: this.$el });
      },
      immediate: true,
    },
  },
  methods: {
    getPlaceholderDancer,
    isPlaced,

    save(set = undefined) {
      // emit changes (to be saved up the chain)
      const value = set !== undefined ? set : this.placedDancers.map((dancer) => {
        const dancerId = dancer[idKey];
        return `${dancerId}${dancer.$tie ? ':tie' : ''}`;
      });
      this.$emit('change', {
        [`results/${this.groupId}/${this.danceId}`]: value,
      });
    },
    handleTie(dancer, tie) {
      const placeIndex = getPlaceIndex(dancer, this.placedDancers);
      if (placeIndex >= 0) {
        this.placedDancers[placeIndex].$tie = tie;

        this.save();
      }
    },
    handleDrag({ oldIndex, newIndex }) {
      this.placedDancers.splice(newIndex, 0, this.placedDancers.splice(oldIndex, 1)[0]);

      // can't be tied if at top of list
      if (newIndex === 0 || oldIndex === 0) {
        this.placedDancers[0].$tie = false;
      }

      this.save();
    },
    placeDancer(dancer) {
      const placeIndex = getPlaceIndex(dancer, this.placedDancers);
      if (placeIndex >= 0) {
        // remove
        this.placedDancers.splice(placeIndex, 1);
      } else {
        // add
        this.placedDancers.push(dancer);
      }

      this.save();
    },

    getPointedDancerIds(judgeId = 'combined') {
      return this.points?.[this.groupId]?.[this.danceId]?.[judgeId] || [];
    },
    isPointed(dancer, judgeId = 'combined') {
      return this.getPointedDancerIds(judgeId).includes(dancer[idKey]);
    },
    pointDancer(dancer, judgeId = 'combined') {
      const pointedDancerIds = this.getPointedDancerIds(judgeId);
      const pointIndex = pointedDancerIds.indexOf(dancer[idKey]);
      if (pointIndex >= 0) {
        // remove
        pointedDancerIds.splice(pointIndex, 1);
      } else {
        // add
        pointedDancerIds.push(`${dancer[idKey]}`);
      }

      this.$emit('change', {
        [`points/${this.groupId}/${this.danceId}/${judgeId}`]: pointedDancerIds,
      });
    },

    async handleTabDisable() {
      await handleTabDisable('results', this);
    },
  },
  components: {
    DancerListItem,
    ResultsList,
    PlacedDancerList,
    HelpTip,
  },
};
</script>

<style lang="scss">
.CompetitionAdminResults {
  .v-tabs-items {
    background-color: transparent;
  }

  .ResultListItem {
    &.selected {
      background-color: rgba(0, 0, 0, 0.12);
    }
  }
  .DancerListItem {
    .group,
    .location::before {
      display: none;
    }
    &.dimmed {
      opacity: 0.33;
    }
  }
}
</style>
