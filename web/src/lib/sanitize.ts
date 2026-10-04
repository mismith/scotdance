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
  const withBreaks = linkify(input).replace(/(?<!>)\n/g, '<br>')
  return DOMPurify.sanitize(withBreaks, { ALLOWED_TAGS, ALLOWED_ATTR })
}

// Web addresses typed as plain text become links (an older description
// edited in Manage keeps its links as "Entry form (https://…)"). Only in text,
// never inside a tag or an existing link; DOMPurify vets the result.
const URL_IN_TEXT = /\bhttps?:\/\/[^\s<>"']*[^\s<>"'.,;:!?)\]]/gi
export function linkify(html: string): string {
  let inLink = 0
  return html
    .split(/(<[^>]*>)/)
    .map((part) => {
      if (part.startsWith('<')) {
        if (/^<a[\s>]/i.test(part)) inLink++
        else if (/^<\/a\s*>/i.test(part)) inLink = Math.max(0, inLink - 1)
        return part
      }
      return inLink ? part : part.replace(URL_IN_TEXT, (url) => `<a href="${url}">${url}</a>`)
    })
    .join('')
}

export { stripTags } from '@/lib/stripTags'
