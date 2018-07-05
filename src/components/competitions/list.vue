<template>
  <div class="competitions-list md-scroll-frame alt">
    <div
      v-if="loaded"
      v-persist-scroll="'/competitions'"
      class="md-scroll-frame md-scroll"
    >
      <md-list class="md-list-cards">
        <md-list-item-cards
          v-for="group in groupedCompetitions"
          :key="group[idKey]"
          v-if="group.competitions.length"
          md-expand
          :md-expanded="isGroupExpanded(group, groupedCompetitions)"
          @toggled="handleGroupExpanded(group[idKey], $event)"
        >
          <md-subheader>{{ group.name }}</md-subheader>

          <md-list slot="md-expand" class="md-double-line">
            <competition-list-item
              v-for="competition in group.competitions"
              :key="competition[idKey]"
              :competition="competition"
              :to="{ name: 'competition.info', params: { competitionId: competition[idKey] } }"
            />
          </md-list>
        </md-list-item-cards>
      </md-list>
      <md-empty-state
        v-if="!competitions.length"
        md-icon="clear"
        md-label="No competitions found"
      />
    </div>
    <div v-else class="md-scroll-frame spinner-container">
      <mi-md-spinner />
    </div>
  </div>
</template>

<script>
import CompetitionListItem from '@/components/utility/competition-list-item';
import {
  idKey,
} from '@/helpers/firebase';
import {
  isExpanded,
  handleExpanded,
} from '@/helpers/router';

export default {
  name: 'competitions-list',
  props: {
    competitions: Array,
    competitionsRef: Object,
  },
  localStorage: {
    competitionsListExpandedGroups: {
      type: Object,
      default: {},
    },
  },
  data() {
    return {
      idKey,

      loaded: false,
    };
  },
  computed: {
    groupedCompetitions() {
      return [
        {
          [idKey]: 'current',
          name: 'Current',
          competitions: this.competitions
            .filter(c => c.date && this.$moment().isSame(c.date, 'week')),
        },
        {
          [idKey]: 'upcoming',
          name: 'Upcoming',
          competitions: this.competitions
            .filter(c => this.$moment().isBefore(c.date, 'week')),
        },
        {
          [idKey]: 'archive',
          name: 'Archive',
          competitions: this.competitions
            .filter(c => !c.date || this.$moment().isAfter(c.date, 'week')).reverse(),
        },
      ];
    },
  },
  methods: {
    isGroupExpanded(item, items) {
      const itemIds = items.map(i => i[idKey]);
      return isExpanded(this.competitionsListExpandedGroups, item[idKey], itemIds, true);
    },
    handleGroupExpanded(groupId, expanded) {
      this.competitionsListExpandedGroups = handleExpanded(this.competitionsListExpandedGroups, groupId, expanded);
      this.$localStorage.set('competitionsListExpandedGroups', this.competitionsListExpandedGroups);
    },
  },
  async created() {
    await this.competitionsRef.once('value');

    this.loaded = true;
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
