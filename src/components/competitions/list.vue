<template>
  <div class="competitions-list md-scroll-frame alt">
    <div class="md-scroll">
      <md-list class="md-list-cards">
        <md-list-item
          v-for="group in groupedCompetitions"
          :key="group.name"
          md-expand
          :md-expanded="true"
        >
          <md-subheader>{{ group.name }}</md-subheader>

          <md-list slot="md-expand" class="md-double-line">
            <competition-list-item
              v-for="competition in group.competitions"
              :key="competition[idKey]"
              :competition="competition"
              @click="$router.push(`/competitions/${competition[idKey]}`)"
            />
            <md-list-item v-if="!group.competitions.length" class="empty">
              No competitions found.
            </md-list-item>
          </md-list>
        </md-list-item>
      </md-list>
    </div>
  </div>
</template>

<script>
import moment from 'moment-mini';
import {
  idKey,
  db,
} from '@/helpers/firebase';
import CompetitionListItem from '@/components/competition-list-item';

export default {
  name: 'competitions-list',
  data() {
    return {
      idKey,
    };
  },
  firebase: {
    competitionsRaw: db.child('competitions'),
  },
  computed: {
    groupedCompetitions() {
      const competitions = this.competitionsRaw
        .map(competition => ({
          ...competition,
        }))
        .sort((a, b) => moment(a.date).diff(b.date)); // order chronologically

      return [
        {
          name: 'Upcoming',
          competitions: competitions.filter(c => moment().diff(c.date) < 0),
        },
        {
          name: 'Archived',
          competitions: competitions.filter(c => moment().diff(c.date) >= 0).reverse(),
        },
      ];
    },
  },
  components: {
    CompetitionListItem,
  },
};
</script>

<style lang="scss">
.competitions-list {

}
</style>
