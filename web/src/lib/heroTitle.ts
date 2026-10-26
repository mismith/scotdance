// A page's own large title, in the manner of Apple's large titles
// (text-hero). A very long one (over 40 characters, as a competition's or a
// venue's full name can be), or one with a word too long to fit a phone's
// width at that size ("Primary/Beginner/Novice"), takes a size down.
export function heroTitle(name?: string | null): string {
  const words = (name ?? '').split(/\s+/)
  const long = (name?.length ?? 0) > 40 || words.some((w) => w.length > 16)
  return long ? 'text-[1.5rem] leading-[1.1] font-[800] tracking-[-0.024em] text-balance break-words' : 'text-hero break-words'
}
