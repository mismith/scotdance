<template>
  <div class="competitions-list md-scroll-frame alt">
    <div class="md-scroll">
      <md-list class="md-list-cards">
        <md-list-item-cards
          v-for="group in groupedCompetitions"
          :key="group.name"
          v-if="group.competitions.length"
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
          </md-list>
        </md-list-item-cards>
      </md-list>
      <md-empty-state
        v-if="!competitions.length"
        md-icon="error"
        md-label="No competitions found"
      />
    </div>
  </div>
</template>

<script>
import {
  idKey,
} from '@/helpers/firebase';
import CompetitionListItem from '@/components/competition-list-item';

export default {
  name: 'competitions-list',
  props: {
    competitions: Array,
  },
  data() {
    return {
      idKey,
    };
  },
  computed: {
    groupedCompetitions() {
      return [
        {
          name: 'Upcoming',
          competitions: this.competitions.filter(c => this.$moment().diff(c.date) < 0),
        },
        {
          name: 'Archive',
          competitions: this.competitions.filter(c => this.$moment().diff(c.date) >= 0).reverse(),
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
