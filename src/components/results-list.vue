<template>
  <md-list class="results-list">
    <result-list-item
      :winner="getGroupDanceWinner(group, callbacks) && {}"
      @click="handleClick(group, callbacks)"
      :class="{ active: isActive(group, callbacks) }"
    >
      {{ callbacks.$name }}
    </result-list-item>
    <md-divider class="md-inset" />

    <result-list-item
      v-for="dance in findGroupDances(group)"
      :key="dance[idKey]"
      :winner="getGroupDanceWinner(group, dance)"
      @click="handleClick(group, dance)"
      :class="{ active: isActive(group, dance) }"
    >
      {{ dance.$name }}
    </result-list-item>

    <md-divider v-if="hasOverall(group)" class="md-inset" />
    <result-list-item
      v-if="hasOverall(group)"
      :winner="getGroupDanceWinner(group, overall)"
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
  getPlacedDancers,
  getGroupDanceWinner,
  getGroupDanceResults,
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
    getPlacedDancers,
    getGroupDanceWinner,
    getGroupDanceResults,

    isActive(group, dance) {
      const {
        groupId,
        danceId,
      } = this.$route.params;

      return groupId === group[idKey] && danceId === dance[idKey];
    },
    hasOverall(group) {
      return group.$category && group.$category.name !== 'Primary';
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
