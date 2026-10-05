import { Eye, EyeOff, Hourglass } from '@lucide/vue'
import type { Competition } from '@/types/competition'

// Who can see a competition, from Manage's two switches. Listed puts its
// overview and staff in front of everyone; Published adds dancers, the
// schedule and results. Each hidden state is named for the switch that's
// off (Unlisted, Unpublished), so the chip and the switch say the same thing.
export type Visibility = 'unlisted' | 'unpublished' | 'published'

export const visibilityOf = (c: Pick<Competition, 'listed' | 'published'>): Visibility =>
  c.published === true ? 'published' : c.listed === true ? 'unpublished' : 'unlisted'

/** Said the same way wherever it shows: "Unlisted: only admins can see this competition." */
export const VISIBILITY = {
  unlisted: {
    label: 'Unlisted',
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
