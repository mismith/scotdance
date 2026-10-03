import { Eye, EyeOff, Hourglass } from '@lucide/vue'
import type { Competition } from '@/types/competition'

// Who can see a competition, from Manage's two switches. Listed puts its
// overview and staff in front of everyone; Published adds dancers, the
// schedule and results. Unpublished is Listed without Published, in the
// word the Published switch itself uses when it's turned off.
export type Visibility = 'private' | 'unpublished' | 'published'

export const visibilityOf = (c: Pick<Competition, 'listed' | 'published'>): Visibility =>
  c.published === true ? 'published' : c.listed === true ? 'unpublished' : 'private'

/** Said the same way wherever it shows: "Private: only admins can see this competition." */
export const VISIBILITY = {
  private: {
    label: 'Private',
    icon: EyeOff,
    line: 'only admins can see this competition.',
  },
  unpublished: {
    label: 'Unpublished',
    icon: Hourglass,
    line: 'only admins can see its dancers, schedule and results.',
  },
  published: { label: 'Published', icon: Eye, line: 'everyone can see everything.' },
} as const
