import {
  idKey,
} from '@/helpers/firebase';

export const overall = {
  [idKey]: 'overall',
  $name: 'Overall',
};

export const callbacks = {
  [idKey]: 'callbacks',
  $name: 'Callbacks',
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
export function getPlacedDancers(results, sortByNumber = false) {
  // transform ranked dancerIds into ordered array of dancer objects
  const dancers = results.map(dancerId => this.dancers.find(dancer => dancer[idKey] === dancerId));
  if (sortByNumber) {
    return dancers.sort((a, b) => a.$number.localeCompare(b.$number));
  }
  return dancers;
}

export function hasOverall(group) {
  return group.$category && group.$category.name !== 'Primary';
}
