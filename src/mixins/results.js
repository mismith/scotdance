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
    getGroupDancePlacings(group, dance) {
      let placings = [];
      if (group && dance) {
        const groupId = group[idKey];
        const danceId = dance[idKey];

        if (this.placings && this.placings[groupId] && this.placings[groupId][danceId]) {
          placings = this.placings[groupId][danceId];
        }
      }
      return placings;
    },
    getPlacedDancers(placings) {
      // transform ranked dancerIds into ordered array of dancer objects
      return placings.map(dancerId => this.dancers.find(dancer => dancer[idKey] === dancerId));
    },
    getGroupDanceWinner(group, dance) {
      const placings = this.getGroupDancePlacings(group, dance);
      const placedDancers = this.getPlacedDancers(placings);

      return placedDancers[0];
    },
  },
};
