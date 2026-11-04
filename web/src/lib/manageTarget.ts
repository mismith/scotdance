import type { RouteLocationNormalizedLoaded, RouteLocationRaw } from 'vue-router'

// Where the pencil on a competition's page goes in Manage: the same thing,
// to edit. A dancer opens that dancer, an age group's results open its
// results (at the dance the link pointed to), a schedule event opens its
// day. Anything else opens Manage's overview.
export function manageTarget(route: Pick<RouteLocationNormalizedLoaded, 'name' | 'params' | 'hash'>, competitionId: string): RouteLocationRaw {
  const p = (key: string) => (route.params[key] ? String(route.params[key]) : undefined)
  const params = { competitionId }
  switch (route.name) {
    case 'competition.dancers':
      return { name: 'manage.dancers', params }
    case 'competition.dancer':
      return { name: 'manage.dancers', params: { ...params, itemId: p('dancerId') } }
    case 'competition.schedule':
      return { name: 'manage.schedule', params }
    case 'competition.event':
      return { name: 'manage.schedule', params: { ...params, dayId: p('dayId') } }
    case 'competition.results':
      return { name: 'manage.results', params }
    case 'competition.group':
      return { name: 'manage.results', params: { ...params, groupId: p('groupId'), danceId: route.hash.match(/^#dance-(.+)$/)?.[1] } }
    default:
      return { name: 'manage', params }
  }
}
