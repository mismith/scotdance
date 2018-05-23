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
  const clones = [...(items || [])];

  // was expanded before, so restore
  return clones.indexOf(itemId) >= 0
    // only one item, so save a tap
    || itemIds.length <= 1
    // nothing expanded, so expand first
    || (!clones.length && (expandAll ? true : itemIds.indexOf(itemId) === 0));
}

export function handleExpanded(items, itemId, expanded) {
  const clones = [...(items || [])];
  const index = clones.indexOf(itemId);
  if (expanded) {
    if (index < 0) {
      clones.push(itemId);
    }
  } else if (index >= 0) {
    clones.splice(index, 1);
  }
  return clones;
}
