// First loads settle rather than pop: content fades up 6px as it arrives
// (CSS @starting-style, so it plays whenever it's inserted), a little after
// the one before it. Reduce Motion keeps just the fade. Not for rows with a
// press state: both set `transition`.
export const settle =
  'transition-[opacity,translate] duration-(--dur-base) ease-standard starting:translate-y-1.5 starting:opacity-0 motion-reduce:starting:translate-y-0'

/** The stagger for the i-th of a list, capped so long lists don't drag. */
export const settleDelay = (i: number) => ({ transitionDelay: `${Math.min(i, 5) * 30}ms` })

// Skeletons only show for loads that take a moment: invisible for the first
// 150ms, so a quick load goes straight to the content.
export const lateSkeleton = 'transition-opacity duration-(--dur-base) delay-150 starting:opacity-0'
