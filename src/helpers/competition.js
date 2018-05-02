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
