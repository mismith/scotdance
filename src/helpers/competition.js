import {
  idKey,
  db,
} from '@/helpers/firebase';
import store from '@/store';

export function findByIdKey(items, id) {
  return items.find(item => item[idKey] === id);
}

export function hasFavorites(dancers) {
  return dancers.some(dancer => dancer && dancer.$favorite);
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

export function toggleFavoriteDancer(dancer) {
  const setFavorite = to => db
    .child('users:favorites')
    .child(store.state.me[idKey])
    .child('dancers')
    .child(dancer[idKey])
    .set(to);

  if (store.state.me) {
    const toggled = dancer.$favorite ? null : true;
    return setFavorite(toggled);
  }

  // 'store' dancer for favoriting post-auth...
  store.commit('addPostLoginCallback', () => {
    setFavorite(true);
  });

  // ...while opening dialog to inform user about favorites functionality
  return store.commit('setDialogOpen', 'favorites');
}
