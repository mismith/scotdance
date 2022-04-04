export function isCypress() {
  return Boolean(window.Cypress) || window.location.search.includes('cypress');
}
export function isDev() {
  return (process.env.NODE_ENV !== 'production' || isCypress()) && !window.location.search.includes('production');
}
