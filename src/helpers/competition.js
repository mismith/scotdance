import Fuse from 'fuse.js';
import moment from 'moment';
import { idKey } from '@/helpers/firebase';

export function findByIdKey(items, id) {
  return items.find((item) => item[idKey] === id);
}

export function sortByKey(key = idKey) {
  return (a, b) => (a[key] || '').localeCompare(b[key] || '');
}

export function hasFavorites(dancers) {
  return dancers.some((dancer) => dancer && dancer.$favorite);
}

export function getScheduleItemDanceName(item, dances) {
  const dance = findByIdKey(dances, item.danceId);
  return (item && (item.$name || item.name)) || (dance && (dance.$name || dance.name));
}

export function hydrateByIdKey(ids, items = []) {
  return (ids || []).map((id) => findByIdKey(items, id));
}

export function getGroupName(group, categories) {
  const category = findByIdKey(categories, group.categoryId);
  return `${category?.name || ''} ${group.name || ''}`.trim();
}

export function competitionExtender(competition, $store) {
  return {
    ...competition,
    location: competition.location?.trim(),
    $pinned: $store.getters.isFavorite('competitions', competition[idKey]),
    $viewed: $store.getters.isViewed('competitions', competition[idKey]),
    $relevance: Math.abs(moment().diff(competition.date)),
  };
}

export function danceExtender(dance) {
  const name = dance.name || '';
  const stepsString = dance.steps ? ` (${dance.steps.trim()})` : '';

  return {
    groupIds: {},
    ...dance,
    $name: `${name.trim()}${stepsString}`,
    $shortName: `${(dance.shortName || name).trim()}${stepsString}`,
  };
}

export function groupExtender(group, i, categories) {
  return {
    ...group,
    $order: `${10000 + i}`, // prepend with leading 'zeroes'
    $name: getGroupName(group, categories),
    $category: findByIdKey(categories, group.categoryId),
  };
}

export function dancerExtender(dancer, groups = [], $store) {
  return {
    ...dancer,
    // prepend with leading 'zeroes', and stringify for search
    $number: `${10000 + Number.parseInt(dancer.number, 10)}`,
    $name: `${(dancer.firstName || '').trim()} ${(dancer.lastName || '').trim()}`.trim(),
    $group: findByIdKey(groups, dancer.groupId),
    $favorite: $store.getters.isFavorite('dancers', dancer[idKey]),
  };
}

export function slugline(html) {
  return (html || '').split('\n')[0].trim() || '';
}

export function slugify(text) {
  return text
    ? text.toLowerCase().replace(/[^a-z-]/g, '-').replace(/-{2,}/g, '-').replace(/^-|-$/g, '')
    : '';
}

export function initialify(name) {
  const allNames = name.trim().split(' ');
  const initials = allNames.reduce((acc, curr, index) => {
    if (index === 0 || index === allNames.length - 1) {
      return `${acc}${curr.charAt(0).toUpperCase()}`;
    }
    return acc;
  }, '');
  return initials.substring(0, 3);
}

export function isNotEmptyObject(item) {
  return Object.values(item || {}).some(Boolean);
}

export function searchByKeys(items, query, searchKeys) {
  if (query && items.length) {
    const results = new Fuse(items, {
      keys: searchKeys,
      threshold: 0.33,
      ignoreLocation: true,
    }).search(query);
    return results.map(({ item }) => item);
  }
  return items;
}
