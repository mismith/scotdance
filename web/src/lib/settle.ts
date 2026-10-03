// First loads settle rather than pop: content rises 6px into place as it
// arrives (the shared rise-in), each a beat after the one before it.
export const settle = 'motion-safe:animate-[rise-in_var(--dur-slow)_var(--ease-snappy)_both]'

/** The stagger for the i-th of a list, capped so long lists don't drag. */
export const settleDelay = (i: number) => ({ animationDelay: `${Math.min(i, 5) * 30}ms` })

// Placeholders wait 150ms before showing (as Skeleton does), so a quick
// load goes straight to the content: for the box around a set of skeletons.
export const lateSkeleton = 'animate-[vt-fade-in_200ms_150ms_both]'

// Rows that come and go in place (a group you open, a list you filter as you
// type): they open and close to their own height and fade, so nothing below
// jumps; in a list (a <TransitionGroup>), the rest glide to their new spots.
// Whatever holds them needs [interpolate-size:allow-keywords].
export const rowsOpen = {
  enterActiveClass: 'overflow-hidden transition-[height,opacity] duration-(--dur-base) ease-standard motion-reduce:transition-opacity',
  enterFromClass: 'h-0 opacity-0',
  leaveActiveClass: 'overflow-hidden transition-[height,opacity] duration-(--dur-quick) ease-exit motion-reduce:transition-opacity',
  leaveToClass: 'h-0 opacity-0',
}
export const rowsMove = { ...rowsOpen, moveClass: 'transition-transform duration-(--dur-slow) ease-snappy' }
