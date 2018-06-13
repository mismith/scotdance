import { idKey } from '@/helpers/firebase';

export function findByIdKey(items, id) {
  return items.find(item => item[idKey] === id);
}

export function hasFavorites(dancers) {
  return dancers.some(dancer => dancer.$favorite);
}

export function getScheduleItemDanceName(item, dances) {
  const dance = findByIdKey(dances, item.danceId);
  const named = dance || item;
  return named.$name || named.name;
}

export function hydrateByIdKey(ids, items = []) {
  return (ids || []).map(id => findByIdKey(items, id));
}

export function danceExtender(dance) {
  const name = dance.name || '';
  const stepsString = dance.steps ? ` (${dance.steps})` : '';

  return {
    groupIds: {},
    ...dance,
    $name: `${name}${stepsString}`.trim(),
    $shortName: `${dance.shortName || name}${stepsString}`.trim(),
  };
}
