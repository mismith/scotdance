import type { Component } from 'vue'
import { CalendarClock, Gavel, Info, Layers, Music, ShieldCheck, SquareStack, Trophy, Users, UsersRound } from '@lucide/vue'

// The Manage sections, in the order a competition comes together: each step
// builds on the ones before it (age groups need categories, the schedule
// needs age groups and platforms, results need dancers). Admins sits apart.

export interface ManageSection {
  id: string
  /** Route name. */
  route: string
  title: string
  icon: Component
  /** Short line under the title on the Manage home list. */
  blurb: string
}

export const MANAGE_STEPS: ManageSection[] = [
  { id: 'details', route: 'manage.details', title: 'Details', icon: Info, blurb: 'Name, date, venue, links and who can see it' },
  { id: 'staff', route: 'manage.staff', title: 'Staff', icon: Gavel, blurb: 'Judges, pipers, helpers and sponsors' },
  { id: 'dances', route: 'manage.dances', title: 'Dances', icon: Music, blurb: 'The dances performed, with their steps' },
  { id: 'categories', route: 'manage.categories', title: 'Categories', icon: Layers, blurb: 'Primary, Beginner, Premier and so on' },
  { id: 'groups', route: 'manage.groups', title: 'Age groups', icon: UsersRound, blurb: 'Which dances each group does, and draws' },
  { id: 'dancers', route: 'manage.dancers', title: 'Dancers', icon: Users, blurb: 'Entries and numbers, usually from Excel or Google Sheets' },
  { id: 'platforms', route: 'manage.platforms', title: 'Platforms', icon: SquareStack, blurb: 'Where dancing happens' },
  { id: 'schedule', route: 'manage.schedule', title: 'Schedule', icon: CalendarClock, blurb: 'Days, sessions, events and who dances where' },
  { id: 'results', route: 'manage.results', title: 'Results', icon: Trophy, blurb: 'Callbacks, placings and championship points' },
]

export const ADMINS_SECTION: ManageSection = { id: 'admins', route: 'manage.admins', title: 'Admins', icon: ShieldCheck, blurb: 'Invite people to help manage' }

export const ALL_SECTIONS = [...MANAGE_STEPS, ADMINS_SECTION]
