/**
 * Strip every tag — for one-line previews where HTML would break layout.
 * Returns plain text (shown with {{ }}, which escapes it), so "&" stays "&"
 * rather than "&amp;"; line breaks and block ends become newlines. Apart
 * from DOMPurify (lib/sanitize), as schedules need it at startup: a parsed
 * document is inert (no scripts run, nothing loads), and only its text is kept.
 */
export function stripTags(input: string | undefined | null): string {
  if (!input) return ''
  const withBreaks = input.replace(/<br\s*\/?>|<\/(?:p|div|li|h[1-6]|blockquote)>/gi, '$&\n')
  const doc = new DOMParser().parseFromString(withBreaks, 'text/html')
  for (const el of doc.querySelectorAll('script, style, template, noscript')) el.remove()
  return doc.body.textContent ?? ''
}
