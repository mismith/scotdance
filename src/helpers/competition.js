import { idKey } from '@/helpers/firebase';

export function findByIdKey(items, id) {
  return items.find(item => item[idKey] === id);
}

export function hasFavorites(dancers) {
  return dancers.some(dancer => dancer.$favorite);
}
