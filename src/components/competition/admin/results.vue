<template>
  <div class="admin-results md-scroll-frame">
    <div class="md-layout admin-blades">
      <div class="md-layout-item md-size-33 admin-blade md-scroll">
        <md-list v-if="groups.length">
          <md-list-item
            v-for="group in groups"
            :key="group[idKey]"
            md-expand
            :md-expanded="isGroupExpanded(group, groups)"
            @update:mdExpanded="handleGroupExpanded(group[idKey], $event)"
          >
            <md-subheader>
              {{ group.$name }}
              <md-icon v-if="hasFavorites(findGroupDancers(group))" class="md-accent">star</md-icon>
            </md-subheader>

            <results-list
              slot="md-expand"
              :group="group"
              :dances="dances"
              :dancers="dancers"
              :results="results"
            />
          </md-list-item>
        </md-list>
        <md-empty-state
          v-else
          md-icon="error"
          md-label="No age groups found"
        />
      </div>
      <div class="md-layout-item md-size-33 admin-blade md-scroll">
        <md-list v-if="currentDance" class="md-double-line">
          <dancer-list-item
            v-for="dancer in currentDancers"
            :key="dancer[idKey]"
            :dancer="dancer"
            @click="placeDancer(dancer)"
            :class="{placed: isPlaced(dancer)}"
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
      <div class="md-layout-item md-size-33 admin-blade md-scroll">
        <md-list v-if="currentDance && placedDancers.length" class="md-double-line">
          <dancer-list-item
            v-for="(dancer, index) in placedDancers"
            :key="dancer[idKey]"
            :dancer="dancer"
            :place="index + 1"
            @click="placeDancer(dancer)"
          >
            <span v-if="currentDance[idKey] === callbacks[idKey]" slot="icon" />
            <md-icon v-if="currentDance[idKey] === overall[idKey]" slot="icon" class="icon-trophy md-primary" />
          </dancer-list-item>
        </md-list>
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
import DancerListItem from '@/components/dancer-list-item';
import ResultsList from '@/components/results-list';
import {
  idKey,
} from '@/helpers/firebase';
import {
  hasFavorites,
} from '@/helpers/competition';
import {
  overall,
  callbacks,
  findGroupDancers,
  getGroupDanceResults,
  getPlacedDancers,
} from '@/helpers/results';
import {
  isExpanded,
  handleExpanded,
} from '@/helpers/router';

export default {
  name: 'admin-results',
  props: {
    groupId: String,
    danceId: String,

    groups: Array,
    dances: Array,
    dancers: Array,
    results: Object,
    // unsavedChanges: Object,
  },
  localStorage: {
    expandedGroups: {
      type: Object,
      default: {},
    },
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
        return this.groups.find(group => group[idKey] === this.groupId);
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
        return this.dances.find(dance => dance[idKey] === this.danceId);
      }
      return null;
    },
    currentDancers() {
      if (this.currentGroup && this.currentDance) {
        if (this.currentDance[idKey] === callbacks[idKey]) {
          return this.findGroupDancers(this.currentGroup)
            .sort((a, b) => a.$number.localeCompare(b.$number));
        }
        const results = this.getGroupDanceResults(this.currentGroup, callbacks);
        return this.getPlacedDancers(results, true);
      }
      return [];
    },
    placedDancers() {
      if (this.currentGroup && this.currentDance) {
        const results = this.getGroupDanceResults(this.currentGroup, this.currentDance);
        return this.getPlacedDancers(results, this.currentDance[idKey] === callbacks[idKey]);
      }
      return [];
    },
  },
  methods: {
    hasFavorites,
    findGroupDancers,
    getGroupDanceResults,
    getPlacedDancers,

    isGroupExpanded(item, items) {
      const itemIds = items.map(i => i[idKey]);
      return isExpanded(this.expandedGroups, item[idKey], itemIds);
    },
    handleGroupExpanded(groupId, expanded) {
      this.expandedGroups = handleExpanded(this.expandedGroups, groupId, expanded);
      this.$localStorage.set('expandedGroups', this.expandedGroups);
    },

    placeDancer(dancer) {
      const placeIndex = this.getDancerPlaceIndex(dancer);
      if (placeIndex >= 0) {
        // remove
        this.placedDancers.splice(placeIndex, 1);
      } else {
        // add
        this.placedDancers.push(dancer);
      }

      // emit changes
      this.$emit('change', {
        [`results/${this.groupId}/${this.danceId}`]: this.placedDancers.map(d => d[idKey]),
      });
    },
    getDancerPlaceIndex(dancer) {
      return this.placedDancers.findIndex(d => d[idKey] === dancer[idKey]);
    },
    isPlaced(dancer) {
      return this.getDancerPlaceIndex(dancer) >= 0;
    },
  },
  components: {
    DancerListItem,
    ResultsList,
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
