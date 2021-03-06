import router from '@/router';
import store from '@/store';

export async function getTitleChunks(route) {
  return [store.state.$package.$name, ...await Promise.all(route.matched
    .map(async (match) => {
      if (typeof match.meta.title === 'function') {
        return match.meta.title(route);
      }
      return match.meta.title;
    }))]
    .filter((chunk) => chunk);
}

export function isExpanded(items, itemId, itemIds, expandByDefault = undefined) {
  const expandeds = {
    ...items,
  };

  if (expandeds[itemId] !== undefined) {
    // has been explicitly set, so restore
    return expandeds[itemId];
  }
  if (itemIds.length <= 1) {
    // only one item, so save a tap and expand
    return true;
  }
  if (expandByDefault !== undefined) {
    return expandByDefault;
  }
  // expand first item (at least)
  return itemIds.indexOf(itemId) === 0;
}

export function handleExpanded(items, itemId, expanded) {
  const expandeds = {
    ...items,
    [itemId]: !!expanded,
  };
  return expandeds;
}

export function getFirstExisting(...routes) {
  if (!routes.length) return null;

  const { route: { matched } } = router.resolve(routes[0]);
  if (matched.length) {
    return routes[0];
  }
  return getFirstExisting(...routes.slice(1));
}

export function formatExternalURL(url) {
  return (url || '').replace(/^(?:http(s?):\/\/)?/i, 'http$1://');
}

export function formatHumanURL(url) {
  return (url || '').replace(/^((https?:)?\/\/)?(www\.)?/i, '');
}
