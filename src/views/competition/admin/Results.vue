<template>
  <Blades class="AdminResults" :stacks="true">
    <Blade id="blade-groups" :active="!currentDance" class="xs12 md4 app-scroll alt">
      <ResultsList
        v-if="groups.length"
        :groups="groups"
        :dances="dances"
        :dancers="dancers"
        :results="results"
      />
      <EmptyState
        v-else
        icon="warning"
        label="No age groups found"
      >
        <router-link :to="{ name: 'competition.admin.tab', params: { tab: 'groups' } }">
          <span class="subheading">Add or import some first &rsaquo;</span>
        </router-link>
      </EmptyState>
    </Blade>
    <Blade id="blade-dancers" :active="currentDance" class="xs12 md4 app-scroll">
      <v-list v-if="currentDance" two-line>
        <DancerListItem
          v-for="dancer in currentDancers"
          :key="dancer[idKey]"
          :dancer="dancer"
          @click="placeDancer(dancer)"
          :class="{ placed: isPlaced(dancer, placedDancers) }"
        />
        <DancerListItem
          v-if="currentDancers.length"
          :dancer="getPlaceholderDancer()"
          @click="placeDancer(getPlaceholderDancer())"
          class="placeholder"
        />

        <EmptyState
          v-if="!currentDancers.length && currentDance === callbacks"
          icon="warning"
          label="No dancers found"
        >
          <router-link :to="{ name: 'competition.admin.tab', params: { tab: 'dancers' } }">
            <span class="subheading">Add dancers with this age group first &rsaquo;</span>
          </router-link>
        </EmptyState>
        <EmptyState
          v-if="!currentDancers.length && currentDance !== callbacks"
          icon="warning"
          label="No dancers to place"
        >
          <router-link :to="{ name: 'competition.admin.results', params: { groupId, danceId: callbacks[idKey] } }">
            <span class="subheading">Make sure enter callbacks first &rsaquo;</span>
          </router-link>
        </EmptyState>
      </v-list>
      <EmptyState
        v-else
        icon="touch_app"
        label="Enter results"
        description="Select an age group and dance"
      />
    </Blade>
    <Blade class="xs12 md4 app-scroll">
      <PlacedDancerList
        v-if="currentDance && placedDancers.length"
        :admin="true"
        :dance="currentDance"
        :dancers="placedDancers"
        @dancer-click="placeDancer($event)"
        @dancer-toggle="handleTie($event[0], $event[1])"
        @dancer-reorder="handleDrag($event)"
      />
      <EmptyState
        v-else
        icon="vertical_split"
        label="Order dancers"
        description="Select dancers in the order placed"
      />
    </Blade>
  </Blades>
</template>

<script>
import DancerListItem from '@/components/DancerListItem.vue';
import ResultsList from '@/components/admin/ResultsList.vue';
import PlacedDancerList from '@/components/PlacedDancerList.vue';
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
  name: 'AdminResults',
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
.AdminResults {
  .ResultListItem {
    &.selected {
      background-color: rgba(0, 0, 0, 0.12);
    }
  }
  .DancerListItem {
    .group {
      display: none;
    }
    &.placed {
      opacity: 0.33;
    }
  }
}
</style>