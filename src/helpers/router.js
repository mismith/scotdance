
export async function getTitleChunks(route) {
  return ['ScotDance', ...await Promise.all(route.matched
    .map(async (match) => {
      if (typeof match.meta.title === 'function') {
        return match.meta.title(route);
      }
      return match.meta.title;
    }))]
    .filter(chunk => chunk);
}

export function isExpanded(items, itemId, itemIds, expandAll = false) {
  if (!items) items = {}; // eslint-disable-line no-param-reassign

  // was expanded before, so restore
  return !!items[itemId]
    // only one item, so save a tap
    || itemIds.length <= 1
    // nothing expanded, so expand first
    || (!Object.keys(items).length && (expandAll ? true : itemIds.indexOf(itemId) === 0));
}

export function handleExpanded(items, itemId, expanded) {
  const expandeds = {
    ...items,
  };
  if (expanded) {
    expandeds[itemId] = true;
  } else if (expandeds[itemId]) {
    expandeds[itemId] = false;
  }
  return expandeds;
}
