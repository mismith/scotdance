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

export const getPlaceholderDancer = (timestamp = undefined) => ({
  [idKey]: timestamp || Date.now(),
  number: '?',
  $number: '?',
  $name: 'Unknown Dancer',
});

export function findGroupDancers(group, dancers = []) {
  return dancers.filter(dancer => dancer.groupId === group[idKey]);
}
export function findGroupDances(group, dances = []) {
  return dances.filter(dance => dance.groupIds && dance.groupIds[group[idKey]]);
}
export function findPlacedDancers(group, dance, dancers = [], results = {}, sortByNumber = false) {
  // get ranked dancerIds
  let placings = [];
  if (group && dance) {
    const groupId = group[idKey];
    const danceId = dance[idKey];

    if (results && results[groupId] && results[groupId][danceId]) {
      placings = results[groupId][danceId];
    }
  }

  // transform ranked dancerIds into ordered array of dancer objects
  const placedDancers = placings.map((result) => {
    const [dancerId, tie] = result.split(':');
    const dancer = `${dancerId}` === `${parseInt(dancerId, 10)}`
      ? getPlaceholderDancer(dancerId)
      : findByIdKey(dancers, dancerId);

    if (!dancer) {
      return dancer;
    }
    return {
      ...dancer,
      $tie: !!tie,
    };
  });
  if (sortByNumber) {
    return placedDancers.sort((a, b) => a.$number.localeCompare(b.$number));
  }
  return placedDancers;
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
