<template>
  <div class="md-layout admin-results">
    <div class="md-layout-item md-scroll">
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
              @click="selected = { group, dance }"
              :class="{selected: selected && selected.group === group && selected.dance === dance}"
            >
              {{ dance.name }}

              <span slot="icon" />
            </result-list-item>

            <div v-if="group.$level.name !== 'Primary'">
              <md-divider class="md-inset" />
              <result-list-item
                @click="selected = { group, dance: overall }"
              :class="{selected: selected && selected.group === group && selected.dance === overall}"
              >
                Overall
                <md-icon class="icon-trophy" slot="icon" />
              </result-list-item>
            </div>
          </md-list>
        </md-list-item>
      </md-list>
    </div>
    <div class="md-layout-item md-scroll">
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
        >
          <span slot="icon" />
        </dancer-list-item>
      </md-list>
    </div>
    <div class="md-layout-item md-scroll placed-dancers">
      <md-subheader>Placings</md-subheader>
      <md-list v-if="selected">
        <dancer-list-item
          v-for="dancer in placedDancers"
          :key="dancer[idKey]"
          :dancer="dancer"
          @click="placeDancer(dancer)"
        >
          <span slot="icon" class="place">{{ getDancerPlaceIndex(dancer) + 1 }}</span>
        </dancer-list-item>
      </md-list>
    </div>
  </div>
</template>

<script>
import DancerListItem from '@/components/dancer-list-item';
import ResultListItem from '@/components/result-list-item';
import {
  idKey,
} from '@/helpers/firebase';

export default {
  name: 'admin-results',
  props: {
    groups: Array,
    dances: Array,
    dancers: Array,
    placings: Object,
    // unsavedChanges: Object,
  },
  data() {
    return {
      idKey,

      selected: undefined,

      placedDancers: [],
      overall: {
        [idKey]: 'overall',
      },
    };
  },
  watch: {
    selected(selected) {
      // @TODO: 
      // if (Object.keys(this.unsavedChanges).length) {
      //   confirm('Are you sure?');
      // }

      // reset/empty placed dancers on group/dance change
      let placings = [];
      if (selected && selected.group && selected.dance) {
        const groupId = selected.group[idKey];
        const danceId = selected.dance[idKey];

        if (this.placings && this.placings[groupId] && this.placings[groupId][danceId]) {
          placings = this.placings[groupId][danceId];
        }
      }

      // transform ranked dancerIds into ordered array of dancers
      const placedDancers = placings.map(dancerId => this.dancers.find(dancer => dancer[idKey] === dancerId));
      this.$set(this, 'placedDancers', placedDancers);
    },
  },
  methods: {
    findGroupDancers(group) {
      return this.dancers.filter(dancer => dancer.groupId === group[idKey]);
    },
    findGroupDances(group) {
      return this.dances.filter(dance => dance.groupIds && dance.groupIds[group[idKey]]);
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
      const unsavedChanges = {};
      if (this.selected && this.selected.group && this.selected.dance) {
        const groupId = this.selected.group[idKey];
        const danceId = this.selected.dance[idKey];

        // set placed dancers in order
        unsavedChanges[`results/${groupId}/${danceId}`] = this.placedDancers.map(dancer => dancer[idKey]);
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
  height: 100%;

  .md-layout-item {
    &:not(:last-child) {
      border-right: solid 6px #ccc;
    }
  }
  .result-list-item {
    &.selected {
      .md-avatar {
        background-color: var(--md-theme-default-primary);
      }
    }
  }
  .dancer-list-item {
    &.placed {
      opacity: 0.33;
    }
  }
  .placed-dancers {
    .place {
      color: var(--md-theme-default-primary);
      font-size: 2em;
      font-weight: bold;

      &::before {
        content: "#";
        display: inline-block;
        font-size: 0.5em;
        vertical-align: middle;
      }
    }
  }
}
</style>
