import { idKey } from '@/helpers/firebase';

export function findByIdKey(items, id) {
  return items.find(item => item[idKey] === id);
}
export function findGroup(groupId, groups = this.groups) {
  return findByIdKey(groups, groupId);
}
export function findLevel(levelId, levels = this.levels) {
  return findByIdKey(levels, levelId);
}

export function getGroupName(group) {
  const level = findLevel.call(this, group.levelId);
  return `${level ? level.name : ''} ${group.name}`;
}
export function findGroupDancers(group, dancers = this.dancers) {
  return dancers.filter(dancer => dancer.groupId === group[idKey]);
}

export function isFavoriteDancer(dancer, favorites = this.favorites) {
  return !!findByIdKey(favorites, dancer[idKey]);
}
export function hasFavorites(dancers) {
  return dancers.some(dancer => dancer.$favorite);
}
