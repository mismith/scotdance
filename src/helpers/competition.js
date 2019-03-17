import { idKey } from '@/helpers/firebase';

export function findByIdKey(items, id) {
  return items.find(item => item[idKey] === id);
}

export function sortByKey(key = idKey) {
  return (a, b) => (a[key] || '').localeCompare(b[key] || '');
}

export function hasFavorites(dancers) {
  return dancers.some(dancer => dancer && dancer.$favorite);
}

export function getScheduleItemDanceName(item, dances) {
  const dance = findByIdKey(dances, item.danceId);
  return (item && (item.$name || item.name)) || (dance && (dance.$name || dance.name));
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

export function textify(html) {
  return (html || '').replace(/<[^>]+?>/g, '').replace(/\n+/g, ' • ');
}

export function isNotEmptyObject(item) {
  return Object.values(item || {}).some(v => v);
}
