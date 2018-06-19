<template>
  <div class="admin-results md-scroll-frame">
    <div class="md-layout blades admin-blades">
      <div class="md-layout-item md-size-33 blade admin-blade md-scroll alt">
        <results-list
          v-if="groups.length"
          :groups="groups"
          :dances="dances"
          :dancers="dancers"
          :results="results"
        />
        <md-empty-state
          v-else
          md-icon="error"
          md-label="No age groups found"
        />
      </div>
      <div class="md-layout-item md-size-33 blade admin-blade md-scroll">
        <md-list v-if="currentDance" class="md-double-line">
          <dancer-list-item
            v-for="dancer in currentDancers"
            :key="dancer[idKey]"
            :dancer="dancer"
            @click="placeDancer(dancer)"
            :class="{ placed: isPlaced(dancer, placedDancers) }"
          />
          <dancer-list-item
            v-if="currentDancers.length"
            :dancer="getPlaceholderDancer()"
            @click="placeDancer(getPlaceholderDancer())"
            class="placeholder"
          />

          <md-empty-state
            v-if="!currentDancers.length"
            md-icon="error"
            md-label="No dancers found"
          />
        </md-list>
        <md-empty-state
          v-else
          md-icon="timeline"
          md-label="Enter results"
          md-description="Select an age group and dance"
        />
      </div>
      <div class="md-layout-item md-size-33 blade admin-blade md-scroll">
        <placed-dancer-list
          v-if="currentDance && placedDancers.length"
          :admin="true"
          :dance="currentDance"
          :dancers="placedDancers"
          @dancer-click="placeDancer($event)"
          @dancer-toggle="handleTie($event[0], $event[1])"
        />
        <md-empty-state
          v-else
          md-icon="swap_vert"
          md-label="Order dancers"
          md-description="Select dancers in the order they placed"
        />
      </div>
    </div>
  </div>
</template>

<script>
import DancerListItem from '@/components/utility/dancer-list-item';
import ResultsList from '@/components/utility/results-list';
import PlacedDancerList from '@/components/utility/placed-dancer-list';
import {
  idKey,
} from '@/helpers/firebase';
import {
  findByIdKey,
  hasFavorites,
} from '@/helpers/competition';
import {
  overall,
  callbacks,
  getPlaceholderDancer,
  findGroupDancers,
  findPlacedDancers,
  getPlaceIndex,
  isPlaced,
} from '@/helpers/results';

export default {
  name: 'admin-results',
  props: {
    groupId: String,
    danceId: String,

    groups: Array,
    dances: Array,
    dancers: Array,
    results: Object,
  },
  data() {
    return {
      idKey,
      overall,
      callbacks,
    };
  },
  computed: {
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
        } else if (this.danceId === callbacks[idKey]) {
          return callbacks;
        }
        return findByIdKey(this.dances, this.danceId);
      }
      return null;
    },
    currentDancers() {
      if (this.currentGroup && this.currentDance) {
        if (this.currentDance[idKey] === callbacks[idKey]) {
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
  },
  methods: {
    hasFavorites,
    getPlaceholderDancer,
    isPlaced,

    save() {
      // emit changes (to be saved up the chain)
      this.$emit('change', {
        [`results/${this.groupId}/${this.danceId}`]: this.placedDancers.map((dancer) => {
          const dancerId = dancer[idKey];
          return `${dancerId}${dancer.$tie ? ':tie' : ''}`;
        }),
      });
    },
    handleTie(dancer, tie) {
      const placeIndex = getPlaceIndex(dancer, this.placedDancers);
      if (placeIndex >= 0) {
        this.placedDancers[placeIndex].$tie = tie;

        this.save();
      }
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
  },
  components: {
    DancerListItem,
    ResultsList,
    PlacedDancerList,
  },
};
</script>

<style lang="scss">
.admin-results {
  .result-list-item {
    &.selected {
      background-color: rgba(0, 0, 0, 0.12);
    }
  }
  .dancer-list-item {
    .group {
      display: none;
    }
    &.placed {
      opacity: 0.33;
    }
  }
}
</style>
