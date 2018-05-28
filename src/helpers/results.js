import {
  idKey,
} from '@/helpers/firebase';
import {
  findByIdKey,
} from '@/helpers/competition';

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
export function getPlacedDancers(group, dance, sortByNumber = false) {
  // get ranked dancerIds
  let results = [];
  if (group && dance) {
    const groupId = group[idKey];
    const danceId = dance[idKey];

    if (this.results && this.results[groupId] && this.results[groupId][danceId]) {
      results = this.results[groupId][danceId];
    }
  }

  // transform ranked dancerIds into ordered array of dancer objects
  const dancers = results.map((result) => {
    const [dancerId, tie] = result.split(':');
    const dancer = findByIdKey(this.dancers, dancerId);

    if (!dancer) {
      return dancer;
    }
    return {
      ...dancer,
      $tie: !!tie,
    };
  });
  if (sortByNumber) {
    return dancers.sort((a, b) => a.$number.localeCompare(b.$number));
  }
  return dancers;
}

export function hasOverall(group) {
  return group.$category && group.$category.name !== 'Primary';
}

export function getPlaceIndex(dancer, dancers) {
  return dancers.findIndex(d => d[idKey] === dancer[idKey]);
}

export function isPlaced(dancer, dancers) {
  return getPlaceIndex(dancer, dancers) >= 0;
}

export function getPlace(dancer, dancers) {
  const dancerIndex = getPlaceIndex(dancer, dancers);
  return dancers.reduce((place, d, i) => {
    if (i > dancerIndex) return place;
    if (d.$tie) return place;
    return i + 1;
  }, 0);
}
