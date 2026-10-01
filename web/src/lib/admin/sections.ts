import type { Component } from 'vue'
import { CalendarClock, Gavel, Info, Layers, Music, ShieldCheck, SquareStack, Trophy, Users, UsersRound } from '@lucide/vue'

// The Manage sections, grouped by when organisers need them. Phones show
// this as a list; wider screens as a sidebar.

export interface ManageSection {
  id: string
  /** Route name. */
  route: string
  title: string
  icon: Component
  /** Short line under the title on the Manage home list. */
  blurb: string
}

export interface ManageSectionGroup {
  title: string
  sections: ManageSection[]
}

export const MANAGE_SECTIONS: ManageSectionGroup[] = [
  {
    title: 'On the day',
    sections: [
      { id: 'results', route: 'manage.results', title: 'Results', icon: Trophy, blurb: 'Callbacks, placings and championship points' },
      { id: 'schedule', route: 'manage.schedule', title: 'Schedule', icon: CalendarClock, blurb: 'Days, sessions, events and platforms' },
    ],
  },
  {
    title: 'Set up',
    sections: [
      { id: 'details', route: 'manage.details', title: 'Details and publishing', icon: Info, blurb: 'Name, date, venue, links and who can see it' },
      { id: 'dancers', route: 'manage.dancers', title: 'Dancers', icon: Users, blurb: 'Entries, numbers and importing from Excel' },
      { id: 'groups', route: 'manage.groups', title: 'Age groups', icon: UsersRound, blurb: 'Which dances each group does, and draws' },
      { id: 'categories', route: 'manage.categories', title: 'Categories', icon: Layers, blurb: 'Primary, Beginner, Premier and so on' },
      { id: 'dances', route: 'manage.dances', title: 'Dances', icon: Music, blurb: 'The dances performed, with their steps' },
      { id: 'platforms', route: 'manage.platforms', title: 'Platforms', icon: SquareStack, blurb: 'Where dancing happens' },
    ],
  },
  {
    title: 'People',
    sections: [
      { id: 'staff', route: 'manage.staff', title: 'Judges, pipers and sponsors', icon: Gavel, blurb: 'Who’s judging, piping, helping and supporting' },
      { id: 'admins', route: 'manage.admins', title: 'Admins', icon: ShieldCheck, blurb: 'Invite people to help manage' },
    ],
  },
]

export const ALL_SECTIONS = MANAGE_SECTIONS.flatMap((g) => g.sections)
