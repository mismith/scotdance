import {
  idKey,
} from '@/helpers/firebase';

export default {
  data() {
    return {
      overall: {
        [idKey]: 'overall',
        $name: 'Overall',
      },
    };
  },
  methods: {
    findGroupDancers(group) {
      return this.dancers.filter(dancer => dancer.groupId === group[idKey]);
    },
    findGroupDances(group) {
      return this.dances.filter(dance => dance.groupIds && dance.groupIds[group[idKey]]);
    },
    getGroupDanceResults(group, dance) {
      let results = [];
      if (group && dance) {
        const groupId = group[idKey];
        const danceId = dance[idKey];

        if (this.results && this.results[groupId] && this.results[groupId][danceId]) {
          results = this.results[groupId][danceId];
        }
      }
      return results;
    },
    getPlacedDancers(results) {
      // transform ranked dancerIds into ordered array of dancer objects
      return results.map(dancerId => this.dancers.find(dancer => dancer[idKey] === dancerId));
    },
    getGroupDanceWinner(group, dance) {
      const results = this.getGroupDanceResults(group, dance);
      const placedDancers = this.getPlacedDancers(results);

      return placedDancers[0];
    },
  },
};
