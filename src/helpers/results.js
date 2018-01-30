import {
  idKey,
} from '@/helpers/firebase';

export const overall = {
  [idKey]: 'overall',
  $name: 'Overall',
};

export function findGroupDancers(group) {
  return this.dancers.filter(dancer => dancer.groupId === group[idKey]);
}
export function findGroupDances(group) {
  return this.dances.filter(dance => dance.groupIds && dance.groupIds[group[idKey]]);
}
export function getGroupDanceResults(group, dance) {
  let results = [];
  if (group && dance) {
    const groupId = group[idKey];
    const danceId = dance[idKey];

    if (this.results && this.results[groupId] && this.results[groupId][danceId]) {
      results = this.results[groupId][danceId];
    }
  }
  return results;
}
export function getPlacedDancers(results) {
  // transform ranked dancerIds into ordered array of dancer objects
  return results.map(dancerId => this.dancers.find(dancer => dancer[idKey] === dancerId));
}
export function getGroupDanceWinner(group, dance) {
  const results = this.getGroupDanceResults(group, dance);
  const placedDancers = this.getPlacedDancers(results);

  return placedDancers[0];
}
