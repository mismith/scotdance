// First loads settle rather than pop: content rises 6px into place as it
// arrives (the shared rise-in), each a beat after the one before it.
export const settle = 'motion-safe:animate-[rise-in_var(--dur-slow)_var(--ease-snappy)_both]'

/** The stagger for the i-th of a list, capped so long lists don't drag. */
export const settleDelay = (i: number) => ({ animationDelay: `${Math.min(i, 5) * 30}ms` })

// Placeholders wait 150ms before showing (as Skeleton does), so a quick
// load goes straight to the content: for the box around a set of skeletons.
export const lateSkeleton = 'animate-[vt-fade-in_200ms_150ms_both]'
