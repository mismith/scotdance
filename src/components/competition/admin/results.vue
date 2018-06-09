<template>
  <div class="admin-results md-scroll-frame">
    <div class="md-layout admin-blades">
      <div class="md-layout-item md-size-33 admin-blade md-scroll-frame md-scroll">
        <md-list v-if="groups.length">
          <md-list-item
            v-for="group in groups"
            :key="group[idKey]"
            md-expand
            :md-expanded="isGroupExpanded(group, groups)"
            @update:mdExpanded="handleGroupExpanded(group[idKey], $event)"
            :class="{ highlighted: results[group[idKey]] }"
          >
            <md-subheader>
              <span>{{ group.$name }}</span>
              <md-icon v-if="hasFavorites(findGroupDancers(group))" class="md-accent">
                {{ hasFavorites(getPlacedDancers(group, callbacks)) ? 'star' : 'star_outline' }}
              </md-icon>
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
      <div class="md-layout-item md-size-33 admin-blade md-scroll-frame md-scroll">
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
      <div class="md-layout-item md-size-33 admin-blade md-scroll-frame md-scroll">
        <md-list v-if="currentDance && placedDancers.length" class="md-double-line">
          <dancer-list-item
            v-for="(dancer, index) in placedDancers"
            :key="dancer[idKey]"
            :dancer="dancer"
            :place="getPlace(dancer, placedDancers)"
            @click="placeDancer(dancer)"
          >
            <md-switch
              v-if="index && currentDance[idKey] !== callbacks[idKey]"
              v-model="dancer.$tie"
              @change="handleTie(dancer, $event)"
            />
            <span v-if="currentDance[idKey] === callbacks[idKey]" slot="icon" />
            <md-icon
              v-if="currentDance[idKey] === overall[idKey] && placedDancers.length <= 1"
              slot="icon"
              class="icon-trophy md-primary"
            />
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
import DancerListItem from '@/components/utility/dancer-list-item';
import ResultsList from '@/components/utility/results-list';
import {
  idKey,
} from '@/helpers/firebase';
import {
  hasFavorites,
} from '@/helpers/competition';
import {
  overall,
  callbacks,
  getPlaceholderDancer,
  findGroupDancers,
  getPlacedDancers,
  getPlaceIndex,
  isPlaced,
  getPlace,
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
  },
  localStorage: {
    adminResultsExpandedGroups: {
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
          return this.findGroupDancers(this.currentGroup);
        }
        return this.getPlacedDancers(this.currentGroup, callbacks, true);
      }
      return [];
    },
    placedDancers() {
      if (this.currentGroup && this.currentDance) {
        const sortByNumber = this.currentDance[idKey] === callbacks[idKey];
        return this.getPlacedDancers(this.currentGroup, this.currentDance, sortByNumber);
      }
      return [];
    },
  },
  methods: {
    hasFavorites,
    getPlaceholderDancer,
    findGroupDancers,
    getPlacedDancers,
    isPlaced,
    getPlace,

    isGroupExpanded(item, items) {
      const itemIds = items.map(i => i[idKey]);
      return isExpanded(this.adminResultsExpandedGroups, item[idKey], itemIds);
    },
    handleGroupExpanded(groupId, expanded) {
      this.adminResultsExpandedGroups = handleExpanded(this.adminResultsExpandedGroups, groupId, expanded);
      this.$localStorage.set('adminResultsExpandedGroups', this.adminResultsExpandedGroups);
    },

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
