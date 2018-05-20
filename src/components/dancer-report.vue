<template>
  <div class="dancer-report">
    <md-list class="md-double-line md-list-cards">
      <dancer-list-item
        :key="dancer[idKey]"
        :dancer="dancer"
      />
    </md-list>
    <md-list v-if="dancer.$group" class="md-list-cards">
      <md-list-item md-expand :md-expanded="true">
        <md-subheader>Schedule</md-subheader>

        <md-list slot="md-expand">
          <md-list-item class="empty">
            Schedule to be determined.
          </md-list-item>
        </md-list>
      </md-list-item>
      <md-list-item md-expand :md-expanded="true">
        <md-subheader>Results</md-subheader>

        <md-list slot="md-expand">
          <result-list-item
            v-for="dance in findGroupDances(dancer.$group)"
            :key="dance[idKey]"
            :place="getPlace(dancer, dancer.$group, dance)"
            @click="$router.push({ name: 'competition.results', params: { groupId: dancer.$group[idKey], danceId: dance[idKey]}})"
          >
            <span slot="avatar" />
            {{ dance.$name }}
          </result-list-item>
        </md-list>
      </md-list-item>
    </md-list>
  </div>
</template>

<script>
import {
  findGroupDances,
} from '@/helpers/results';
import DancerListItem from '@/components/dancer-list-item';
import ResultListItem from '@/components/result-list-item';
import {
  idKey,
} from '@/helpers/firebase';

export default {
  name: 'dancer-report',
  props: {
    dancer: Object,
    dances: Array,
    groups: Array,
    results: Object,
  },
  data() {
    return {
      idKey,
    };
  },
  watch: {
  },
  methods: {
    findGroupDances,

    getPlace(dancer, group, dance) {
      try {
        const groupId = group[idKey];
        const danceId = dance[idKey];
        const index = this.results[groupId][danceId].indexOf(dancer[idKey]);
        if (index >= 0) {
          // placed
          return index + 1;
        }
        // did not place
        return 0;
      } catch (err) {
        // no results yet
        return null;
      }
    },
  },
  components: {
    DancerListItem,
    ResultListItem,
  },
};
</script>

<style lang="scss">
.dancer-report {

}
</style>
