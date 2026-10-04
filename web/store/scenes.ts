/// <reference lib="dom" />
// What each store shot shows of the app: where to go, and anything to do
// first.
import type { Page } from '@playwright/test'
import type { Device } from './devices.ts'
import { TODAY_ID, personId } from './demo.ts'

export interface Scene {
  id: string
  /** The app's path, or how to find it (some ids are made by the seed). */
  path: string | (() => Promise<string>)
  devices?: Device['id'][]
  prepare?: (page: Page, device: Device) => Promise<void>
  /** Pretend it's this day instead of the demo day. */
  now?: string
}

export const SCENES: Scene[] = [
  // Freya's Juvenile World Championship final: the Fling's placings are in.
  {
    id: 'results',
    path: `/competitions/${TODAY_ID}/results/${TODAY_ID}-grp-world-juv/${TODAY_ID}-dance-fling`,
  },
  { id: 'home', path: '/' },
  { id: 'schedule', path: `/competitions/${TODAY_ID}/schedule` },
  // On Cowal's first day: the calendar lists a competition on the day it starts.
  { id: 'calendar', path: '/competitions?view=calendar', now: '2026-08-27' },
  // Today's placings, then every competition before.
  { id: 'dancer', path: async () => `/dancers/${await personId('Hazel Morrison')}/info` },
  // The organiser's schedule builder, on finals day.
  {
    id: 'builder',
    path: `/competitions/${TODAY_ID}/manage/schedule/${TODAY_ID}-day3`,
    // On a phone the builder is two panes: its palette (dances, age groups)
    // and the schedule, each scrolling on its own. Scroll the schedule to
    // the day's first block.
    prepare: async (page) => {
      await page
        .getByText('Morning', { exact: true })
        .first()
        .evaluate((el) => {
          let pane = el.parentElement
          while (
            pane &&
            !(
              /(auto|scroll)/.test(getComputedStyle(pane).overflowY) &&
              pane.scrollHeight > pane.clientHeight
            )
          )
            pane = pane.parentElement
          if (pane)
            pane.scrollTop +=
              el.getBoundingClientRect().top - pane.getBoundingClientRect().top - 14
        })
    },
  },
  { id: 'overview', path: `/competitions/${TODAY_ID}/info` },
]
