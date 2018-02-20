// eslint-disable-next-line import/prefer-default-export
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
