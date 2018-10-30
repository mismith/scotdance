<template>
  <blades class="admin-results" :stacks="true">
    <blade id="blade-groups" :active="!currentDance" class="md-small-size-100 md-size-33 md-scroll alt">
      <results-list
        v-if="groups.length"
        :groups="groups"
        :dances="dances"
        :dancers="dancers"
        :results="results"
      />
      <div v-else>
        <md-empty-state
          md-icon="clear"
          md-label="No age groups found"
        />
      </div>
    </blade>
    <blade id="blade-dancers" :active="currentDance" class="md-small-size-100 md-size-33 md-scroll">
      <md-list v-if="currentDance">
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

        <div v-if="!currentDancers.length">
          <md-empty-state
            md-icon="clear"
            md-label="No dancers found"
          />
        </div>
      </md-list>
      <div v-else>
        <md-empty-state
          md-icon="touch_app"
          md-label="Enter results"
          md-description="Select an age group and dance"
        />
      </div>
    </blade>
    <blade class="md-small-size-100 md-size-33 md-scroll">
      <placed-dancer-list
        v-if="currentDance && placedDancers.length"
        :admin="true"
        :dance="currentDance"
        :dancers="placedDancers"
        @dancer-click="placeDancer($event)"
        @dancer-toggle="handleTie($event[0], $event[1])"
        @dancer-reorder="handleDrag($event)"
      />
      <div v-else>
        <md-empty-state
          md-icon="vertical_split"
          md-label="Order dancers"
          md-description="Select dancers in the order placed"
        />
      </div>
    </blade>
  </blades>
</template>

<script>
import DancerListItem from '@/components/utility/DancerListItem.vue';
import ResultsList from '@/components/competition/admin/utility/ResultsList.vue';
import PlacedDancerList from '@/components/utility/PlacedDancerList.vue';
import { idKey } from '@/helpers/firebase';
import { findByIdKey } from '@/helpers/competition';
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
  .placed-dancer-list {
    .favorite-dancer-button {
      display: none;
    }
  }
}
</style>
