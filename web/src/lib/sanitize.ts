import DOMPurify from 'dompurify'

// Conservative allowlist for organizer-authored descriptions (schedule,
// competition, staff bios). Anything outside this set is stripped.
const ALLOWED_TAGS = [
  'a',
  'b',
  'strong',
  'i',
  'em',
  'u',
  's',
  'code',
  'mark',
  'br',
  'p',
  'ul',
  'ol',
  'li',
  'blockquote',
  'hr',
  'h3',
  'h4',
  'h5',
  'h6',
]
const ALLOWED_ATTR = ['href', 'target', 'rel']

// Force external-link attrs on every <a>. Runs after sanitization so we
// can't be tricked into leaving a missing target/rel on an attacker-crafted
// element. DOMPurify itself already neutralizes javascript:/data: hrefs.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

/**
 * Sanitize organizer-authored rich text for v-html rendering.
 *
 * Newlines outside HTML tags become <br> so plain-typed paragraphs keep
 * their line breaks once `whitespace-pre-line` no longer applies.
 */
export function sanitizeRichText(input: string | undefined | null): string {
  if (!input) return ''
  const withBreaks = input.replace(/(?<!>)\n/g, '<br>')
  return DOMPurify.sanitize(withBreaks, { ALLOWED_TAGS, ALLOWED_ATTR })
}

/** Strip every tag — for one-line previews where HTML would break layout. */
export function stripTags(input: string | undefined | null): string {
  if (!input) return ''
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
}
