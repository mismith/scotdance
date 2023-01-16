<template>
  <v-list two-line class="DancerReportResults">
    <ResultListItem
      v-for="dance in groupDances"
      :key="dance[idKey]"
      :to="{ name: 'competition.results', params: { groupId: group[idKey], danceId: dance[idKey] } }"
    >
      <template #avatar><span /></template>
      {{ dance.$name }}
      <template #icon>
        <v-icon v-if="isPointed(dance)" class="mr-3 my-3">{{ mdiCardsDiamond }}</v-icon>
        <Place v-else :place="getPlace(dancer, group, dance)" />
      </template>
    </ResultListItem>

    <v-divider v-if="hasOverall(group)" />
    <ResultListItem
      v-if="hasOverall(group)"
      :to="{ name: 'competition.results', params: { groupId: group[idKey], danceId: overall[idKey] } }"
    >
      <template #avatar><span /></template>
      {{ overall.$name }}
      <template #icon>
        <v-icon v-if="isPointed(overall)" class="mr-3 my-3">{{ mdiCardsDiamond }}</v-icon>
        <Place v-else :place="getPlace(dancer, group, overall)" />
      </template>
    </ResultListItem>

    <EmptyResults
      v-if="!groupDances.length && !hasOverall(group)"
      :groupId="group[idKey]"
      :danceId="overall[idKey]"
      :results="results"
    />
  </v-list>
</template>

<script>
import {
  mdiCardsDiamond,
} from '@mdi/js';
import ResultListItem from '@/components/ResultListItem.vue';
import EmptyResults from '@/components/EmptyResults.vue';
import Place from '@/components/Place.vue';
import { idKey } from '@/helpers/firebase';
import {
  overall,
  hasOverall,
  findGroupDances,
  findPlacedDancers,
  getPlace,
  isDancerPointed,
} from '@/helpers/results';

export default {
  name: 'DancerReportResults',
  props: {
    dancer: {
      type: Object,
      required: true,
    },
    dancers: {
      type: Array,
      required: true,
    },
    dances: {
      type: Array,
      required: true,
    },
    groups: {
      type: Array,
      required: true,
    },
    results: {
      type: Object,
      required: true,
    },
    points: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      idKey,
      overall,
      hasOverall,
      mdiCardsDiamond,
    };
  },
  computed: {
    group() {
      return (this.dancer && this.dancer.$group) || {};
    },
    groupDances() {
      return findGroupDances(this.group, this.dances);
    },
  },
  methods: {
    getPlace(dancer, group, dance) {
      if (this.results?.[group?.[idKey]]?.[dance?.[idKey]]) {
        const placedDancers = findPlacedDancers(group, dance, this.dancers, this.results);
        return getPlace(dancer, placedDancers);
      }

      // no results yet
      return null;
    },
    isPointed(dance) {
      return isDancerPointed(this.points, this.group?.[idKey], dance?.[idKey], this.dancer?.[idKey]);
    },
  },
  components: {
    ResultListItem,
    EmptyResults,
    Place,
  },
};
</script>
