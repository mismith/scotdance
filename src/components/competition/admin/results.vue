<template>
  <div class="admin-results md-scroll-frame">
    <div class="md-layout admin-blades">
      <div class="md-layout-item md-size-33 admin-blade md-scroll">
        <md-subheader>Groups / Dances</md-subheader>
        <md-list>
          <md-list-item
            v-for="group in groups"
            :key="group[idKey]"
            md-expand
          >
            <md-subheader>
              {{ group.$name }}
            </md-subheader>

            <md-list slot="md-expand">
              <result-list-item
                v-for="dance in findGroupDances(group)"
                :key="dance[idKey]"
                :winner="getGroupDanceWinner(group, dance)"
                @click="selected = { group, dance }"
                :class="{selected: selected && selected.group === group && selected.dance === dance}"
              >
                {{ dance.$name }}
                <span slot="icon" />
              </result-list-item>

              <div v-if="group.$category.name !== 'Primary'">
                <md-divider class="md-inset" />
                <result-list-item
                  :winner="getGroupDanceWinner(group, overall)"
                  @click="selected = { group, dance: overall }"
                  :class="{selected: selected && selected.group === group && selected.dance === overall}"
                >
                  {{ overall.$name }}
                  <md-icon class="icon-trophy" slot="icon" />
                </result-list-item>
              </div>
            </md-list>
          </md-list-item>
        </md-list>
      </div>
      <div class="md-layout-item md-size-33 admin-blade md-scroll">
        <md-subheader>
          {{ selected && selected.group ? selected.group.$name : '' }}
          {{ selected && selected.dance ? selected.dance.$name : '' }}
          Dancers
        </md-subheader>
        <md-list v-if="selected">
          <dancer-list-item
            v-for="dancer in findGroupDancers(selected.group)"
            :key="dancer[idKey]"
            :dancer="dancer"
            @click="placeDancer(dancer)"
            :class="{placed: isPlaced(dancer)}"
          />
        </md-list>
      </div>
      <div class="md-layout-item md-size-33 admin-blade md-scroll">
        <md-subheader>Placings</md-subheader>
        <md-list v-if="selected">
          <dancer-list-item
            v-for="(dancer, index) in placedDancers"
            :key="dancer[idKey]"
            :dancer="dancer"
            :place="index + 1"
            @click="placeDancer(dancer)"
          />
        </md-list>
      </div>
    </div>
  </div>
</template>

<script>
import DancerListItem from '@/components/dancer-list-item';
import ResultListItem from '@/components/result-list-item';
import {
  idKey,
} from '@/helpers/firebase';
import {
  overall,
  findGroupDancers,
  findGroupDances,
  getGroupDanceResults,
  getPlacedDancers,
  getGroupDanceWinner,
} from '@/helpers/results';

export default {
  name: 'admin-results',
  props: {
    groups: Array,
    dances: Array,
    dancers: Array,
    results: Object,
    // unsavedChanges: Object,
  },
  data() {
    return {
      idKey,
      overall,

      selected: undefined,

      placedDancers: [],
    };
  },
  watch: {
    selected() {
      // @TODO:
      // if (Object.keys(this.unsavedChanges).length) {
      //   confirm('Are you sure?');
      // }

      // reset placed dancers on group/dance change
      let results = [];
      if (this.selected) {
        results = this.getGroupDanceResults(this.selected.group, this.selected.dance);
      }

      this.$set(this, 'placedDancers', this.getPlacedDancers(results));
    },
  },
  methods: {
    findGroupDancers,
    findGroupDances,
    getGroupDanceResults,
    getPlacedDancers,
    getGroupDanceWinner,

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
      const unsavedChanges = {};
      if (this.selected && this.selected.group && this.selected.dance) {
        const groupId = this.selected.group[idKey];
        const danceId = this.selected.dance[idKey];

        // set placed dancers in order
        unsavedChanges[`results/${groupId}/${danceId}`] = this.placedDancers.map(d => d[idKey]);
      }
      this.$emit('change', unsavedChanges);
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
    ResultListItem,
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
    &.placed {
      opacity: 0.33;
    }
  }
}
</style>
