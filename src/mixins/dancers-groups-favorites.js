import moment from 'moment-mini';
import {
  idKey,
} from '@/helpers/firebase';

export default {
  props: {
    competitionDataRef: {
      type: Object,
      required: true,
    },
    userFavoritesRef: {
      type: Object,
      required: true,
    },
  },
  // // TODO: this doesn't seem to bubble up, so needs to be manually copied
  // firebase() {
  //   return {
  //     dancersRaw: this.competitionDataRef.child('dancers'),
  //     groupsRaw: this.competitionDataRef.child('groups'),
  //     favorites: this.userFavoritesRef.child('dancers'),
  //   };
  // },
  computed: {
    dancers() {
      return this.dancersRaw.map(dancer => ({
        ...dancer,
        $group: this.getDancerGroup(dancer),
        $favorite: this.isFavorite(dancer),
      }));
    },
    groups() {
      return this.groupsRaw.map((group, i) => ({
        ...group,
        $order: `${10000 + i}`, // pad with 'leading zeros'
        $name: this.getGroupName(group),
      }));
    },
  },
  methods: {
    getGroupDancers(group) {
      // TODO: make this check performant
      return this.dancers.filter((dancer) => {
        const dancerGroup = this.getDancerGroup(dancer);
        return dancerGroup && dancerGroup[idKey] === group[idKey];
      });
    },
    getDancerGroup(dancer) {
      const age = moment(/* TODO: Competition.date */).diff(moment(dancer.dob, 'YYYY-MM-DD'), 'years');
      return this.groups.find((group) => {
        const min = parseInt(group.min, 10);
        const max = parseInt(group.max, 10);
        return group.level === dancer.level && min <= age && age <= max;
      });
    },
    getGroupName(group) {
      return group ? `${group.level} ${group.min}${group.max !== group.min ? `-${group.max}` : ''}` : '';
    },
    isFavorite(dancer) {
      return this.favorites.find(favorite => favorite[idKey] === dancer[idKey]);
    },
    hasFavorites(dancers) {
      return dancers.some(dancer => dancer.$favorite);
    },
  },
};
