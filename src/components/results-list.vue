<template>
  <md-list class="results-list">
    <result-list-item
      :dancers="getPlacedDancers(getGroupDanceResults(group, callbacks), true)"
      @click="handleClick(group, callbacks)"
      :class="{ active: isActive(group, callbacks) }"
    >
      {{ callbacks.$name }}
    </result-list-item>
    <md-divider class="md-inset" />

    <result-list-item
      v-for="dance in findGroupDances(group)"
      :key="dance[idKey]"
      :dancers="getPlacedDancers(getGroupDanceResults(group, dance))"
      @click="handleClick(group, dance)"
      :class="{ active: isActive(group, dance) }"
    >
      {{ dance.$name }}
    </result-list-item>

    <md-divider v-if="hasOverall(group)" class="md-inset" />
    <result-list-item
      v-if="hasOverall(group)"
      :dancers="getPlacedDancers(getGroupDanceResults(group, overall))"
      @click="handleClick(group, overall)"
      :class="{ active: isActive(group, overall) }"
    >
      {{ overall.$name }}
      <md-icon class="icon-trophy" slot="icon" />
    </result-list-item>
  </md-list>
</template>

<script>
import ResultListItem from '@/components/result-list-item';
import {
  idKey,
} from '@/helpers/firebase';
import {
  overall,
  callbacks,
  findGroupDances,
  findGroupDancers,
  getPlacedDancers,
  getGroupDanceResults,
  hasOverall,
} from '@/helpers/results';

export default {
  name: 'results-list',
  props: {
    // groupId: String,
    // danceId: String,
    group: Object,
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
  methods: {
    findGroupDances,
    findGroupDancers,
    getPlacedDancers,
    getGroupDanceResults,
    hasOverall,

    isActive(group, dance) {
      const {
        groupId,
        danceId,
      } = this.$route.params;

      return groupId === group[idKey] && danceId === dance[idKey];
    },

    handleClick(group, dance) {
      this.$router.push({
        params: {
          groupId: group[idKey],
          danceId: dance[idKey],
        },
      });
    },
  },
  components: {
    ResultListItem,
  },
};
</script>

<style lang="scss">
.results-list {
  .md-list {
    > div {
      position: relative;

      > .md-divider {
        bottom: auto;
        top: 0;
        z-index: 3;
      }
    }
  }
}
</style>
