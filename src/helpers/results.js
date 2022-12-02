import { idKey } from '@/helpers/firebase';
import {
  findByIdKey,
  sortByKey,
} from '@/helpers/competition';

export const all = {
  [idKey]: 'all',
  $name: 'All Dancers',
};
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

export function hasExplicitlyEmptyResults(groupId, danceId, results = {}) {
  try {
    return results[groupId][danceId] === false;
  } catch (err) {
    return false;
  }
}

export function isDancerPointed(points, groupId, danceId, dancerId, checkFn = (dId) => dId === dancerId) {
  return Object.values(points?.[groupId]?.[danceId] || {})
    .flatMap((v) => v) // any judge
    .some(checkFn);
}

export const getPlaceholderDancer = (timestamp = undefined) => ({
  [idKey]: timestamp || Date.now(),
  number: '?',
  $number: '?',
  $name: 'Dancer',
});
export function isPlaceholderId(dancerId) {
  return /^\d+$/.test(dancerId); // fully numeric, i.e. a timestamp
}
export function hasPlaceholderDancers(groupId, danceId, results = {}, points = {}) {
  try {
    const check = (dancerId) => isPlaceholderId(dancerId);
    return results?.[groupId]?.[danceId]?.some(check)
      || isDancerPointed(points, groupId, danceId, undefined, check);
  } catch (err) {
    return false;
  }
}

export function findCategoryDancers(category, dancers = []) {
  return dancers.filter((dancer) => dancer.$group && dancer.$group.categoryId === category[idKey]);
}
export function findGroupDances(group, dances = []) {
  return dances.filter((dance) => dance.groupIds && dance.groupIds[group[idKey]]);
}
export function findGroupDancers(group, dancers = []) {
  return dancers.filter((dancer) => dancer.groupId === group[idKey]);
}
export function getAugmentedDancers(dancerIds, dancers = []) {
  return dancerIds.map((dancerIdWithOptionalModifier) => {
    const [dancerId, modifier] = `${dancerIdWithOptionalModifier}`.split(':');
    const dancer = findByIdKey(dancers, dancerId) || getPlaceholderDancer(dancerId);

    return {
      ...dancer,
      $tie: modifier === 'tie',
    };
  });
}

export function findPointedDancers(dancePoints, dancers = []) {
  const dancerIds = Object.values(dancePoints || {})
    .flatMap((v) => v)
    .filter((v, i, a) => a.indexOf(v) === i);
  const pointedDancers = getAugmentedDancers(dancerIds, dancers).sort(sortByKey('$number'));
  return pointedDancers.map((dancer) => ({
    ...dancer,
    $points: true,
  }));
}

export function findPlacedDancers(group, dance, dancers = [], results = {}, sortByNumber = false, includeDummyForExplicitlyEmptyResults = false) {
  // get ranked dancerIds
  let placings = [];
  if (group && dance) {
    const groupId = group[idKey];
    const danceId = dance[idKey];

    if (results?.[groupId]?.[danceId]) {
      placings = results[groupId][danceId];
    }
    if (includeDummyForExplicitlyEmptyResults && hasExplicitlyEmptyResults(groupId, danceId, results)) {
      placings.push('');
    }
  }

  // transform ranked dancerIds into ordered array of dancer objects
  const placedDancers = getAugmentedDancers(placings, dancers);
  if (sortByNumber) {
    return placedDancers.sort(sortByKey('$number'));
  }
  return placedDancers;
}
export function getPlaceIndex(dancer, dancers) {
  return dancers.findIndex((d) => d[idKey] === dancer[idKey]);
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
export function getOrdinal(place) {
  switch (`${place}`) {
    case '0': {
      return '';
    }
    case '1': {
      return 'st';
    }
    case '2': {
      return 'nd';
    }
    case '3': {
      return 'rd';
    }
    default: {
      return 'th';
    }
  }
}

export function isGroupInProgress(group, dances = [], results = {}) {
  const groupResults = results && results[group[idKey]];
  if (groupResults) {
    const dancesToCheck = [
      callbacks,
      ...findGroupDances(group, dances),
      hasOverall(group) && overall,
    ];
    return dancesToCheck
      .filter(Boolean)
      .some((dance) => (
        !groupResults[dance[idKey]]
          && !hasExplicitlyEmptyResults(group[idKey], dance[idKey], results)
      ));
  }
  return false;
}

export function getRows(groups, dances, dancers, results, points) {
  const rows = [];
  groups.forEach((group) => {
    dances.forEach((dance) => {
      const placedDancers = findPlacedDancers(group, dance, dancers, results);
      const pointedDancers = findPointedDancers(points?.[group[idKey]]?.[dance[idKey]], dancers);
      [...placedDancers, ...pointedDancers].forEach((dancer) => {
        rows.push({
          /* eslint-disable quote-props */
          'Category': group.$category?.name,
          'Age Group': group.name,
          'Dance': dance.$name || dance.name,
          'Dancer Number': dancer.number || '?',
          'First Name': dancer.firstName || '?',
          'Last Name': dancer.lastName || '?',
          'Location': dancer.location || '?',
          'Place': isDancerPointed(points, group[idKey], dance[idKey], dancer[idKey]) ? '♦' : (dance[idKey] !== callbacks[idKey] && getPlace(dancer, placedDancers)) || undefined,
          /* eslint-enable quote-props */
        });
      });
    });
  });
  return rows;
}
