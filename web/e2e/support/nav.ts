import type { Locator, Page } from '@playwright/test'

// Where the app's navigation lives. Wide screens (Tailwind `lg`, 1024px) have
// a sidebar on every page, and the bottom tab bars (and the More menu) are
// hidden. Narrower ones are the other way round. Decided by the page's width,
// so a test that resizes it gets the right one.

export const hasSidebar = (page: Page) => (page.viewportSize()?.width ?? 1280) >= 1024

/** The app-wide navigation: the sidebar (wide screens) or the bottom tab bar. */
export const appNav = (page: Page) => page.getByRole('navigation', { name: hasSidebar(page) ? 'ScotDance.app' : 'App', exact: true })

/**
 * One of Home, Competitions and Search. Exact: the sidebar also has "Manage
 * competitions" and, inside a competition, its own Dancers tab.
 */
export const appTab = (page: Page, name: 'Home' | 'Competitions' | 'Search') => appNav(page).getByRole('link', { name, exact: true })

/** Where a competition's own tabs (Overview, Dancers, Schedule, Results) are: nested in the sidebar, or the bottom bar. */
export const competitionTabs = (page: Page): Locator => (hasSidebar(page) ? page.locator('#sidebar-competitions') : page.getByRole('navigation', { name: 'Competition' }))

/**
 * What the More menu holds, as the layout has it: the menu itself (opened
 * from its tab) with buttons in it on phones; the sidebar, with links, on
 * wide screens (they have no More).
 */
export async function moreItems(page: Page) {
  if (hasSidebar(page)) return { menu: appNav(page), role: 'link' as const }
  await appNav(page).getByRole('button', { name: 'More' }).click()
  return { menu: page.getByRole('dialog', { name: 'More' }), role: 'button' as const }
}
