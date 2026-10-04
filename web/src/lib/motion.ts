/** Smooth scrolling, unless Reduce Motion is on: then it jumps. */
export const smooth = (): ScrollBehavior => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth')
