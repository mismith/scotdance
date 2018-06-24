import {
  idKey,
} from '@/helpers/firebase';
import {
  findByIdKey,
} from '@/helpers/competition';

export const callbacks = {
  [idKey]: 'callbacks',
  $name: 'Callbacks',
};
export const overall = {
  [idKey]: 'overall',
  $name: 'Overall',
};
export function hasOverall(group) {
  return group.$category && group.$category.name !== 'Primary';
}

export const getPlaceholderDancer = (timestamp = undefined) => ({
  [idKey]: timestamp || Date.now(),
  number: '?',
  $number: '?',
  $name: 'Dancer',
});
export function isPlaceholderDancerId(dancerId) {
  return /^\d+$/.test(dancerId);
}
export function hasPlaceholderDancers(groupId, danceId, results = {}) {
  try {
    return results[groupId][danceId].some(dancerId => isPlaceholderDancerId(dancerId));
  } catch (err) {
    return false;
  }
}

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
    const dancer = isPlaceholderDancerId(dancerId)
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

export function isInProgress(group, dances = [], results = {}) {
  const groupResults = results && results[group[idKey]];
  if (groupResults) {
    const dancesToCheck = [
      callbacks,
      ...findGroupDances(group, dances),
      hasOverall(group) && overall,
    ];
    return dancesToCheck
      .filter(v => v)
      .some(dance => !groupResults[dance[idKey]] || hasPlaceholderDancers(group[idKey], dance[idKey], results));
  }
  return false;
}
