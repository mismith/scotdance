import moment from 'moment-mini';
import {
  idKey,
  db,
} from '@/helpers/firebase';

export default {
  firebase: {
    dancersRaw: db.child('competitionsData').child('idc0').child('dancers'),
    groupsRaw: db.child('competitionsData').child('idc0').child('groups'),
    favorites: db.child('users:favorites').child('idu0').child('dancers'),
  },
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
