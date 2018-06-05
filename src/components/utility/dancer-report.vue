<template>
  <div class="dancer-report">
    <md-list class="md-double-line md-list-cards">
      <dancer-list-item
        :key="dancer[idKey]"
        :dancer="dancer"
      />
    </md-list>
    <md-list v-if="group" class="md-list-cards">
      <!--<md-list-item-cards md-expand :md-expanded="true">
        <md-subheader>Schedule</md-subheader>

        <md-list slot="md-expand">
          <md-list-item class="empty">
            Schedule to be determined.
          </md-list-item>
        </md-list>
      </md-list-item-cards>-->
      <md-list-item-cards md-expand :md-expanded="true">
        <md-subheader>Results</md-subheader>

        <md-list slot="md-expand">
          <result-list-item
            v-for="dance in findGroupDances(group)"
            :key="dance[idKey]"
            :place="getPlace(dancer, group, dance)"
            :to="{ name: 'competition.results', params: { groupId: group[idKey], danceId: dance[idKey] } }"
          >
            <span slot="avatar" />
            {{ dance.$name }}
          </result-list-item>

          <md-divider v-if="hasOverall(group)" />
          <result-list-item
             v-if="hasOverall(group)"
            :place="getPlace(dancer, group, overall)"
            :to="{ name: 'competition.results', params: { groupId: group[idKey], danceId: overall[idKey] } }"
          >
            <span slot="avatar" />
            {{ overall.$name }}
          </result-list-item>
        </md-list>
      </md-list-item-cards>
    </md-list>
  </div>
</template>

<script>
import DancerListItem from '@/components/utility/dancer-list-item';
import ResultListItem from '@/components/utility/result-list-item';
import {
  idKey,
} from '@/helpers/firebase';
import {
  overall,
  hasOverall,
  findGroupDances,
} from '@/helpers/results';

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
      overall,
      hasOverall,
    };
  },
  computed: {
    group() {
      return this.dancer && this.dancer.$group;
    },
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
