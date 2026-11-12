/** A fixed return intent, never a caller-supplied redirect URL. */
export function entriesReturnUrl(competitionId: string, origin = 'https://entries.scotdance.app'): string {
  const url = new URL('/organise', origin);
  url.searchParams.set('competition', competitionId);
  url.searchParams.set('refresh', '1');
  return url.href;
}
