// Descriptions and bios from the old app are stored as HTML (<p>Entries…</p>),
// and the public pages render them through sanitizeRichText, which also turns
// plain line breaks into <br>. So Manage edits them as plain text (what the
// public page shows, with paragraphs and breaks as new lines) and saves that
// text as it is: it renders the same. Untouched, the HTML stays as it was.

/** Whether stored text is HTML (tags or entities) rather than plain text. */
export function looksLikeHtml(text: string): boolean {
  return /<\/?[a-z][a-z0-9]*\b[^<>]*>/i.test(text) || /&(?:[a-z]+|#\d+|#x[\da-f]+);/i.test(text)
}

const PARAGRAPH = /^(?:P|H[1-6]|BLOCKQUOTE|UL|OL)$/
// Where blocks meet: a new line, or a blank one between paragraphs. Marked
// first and settled at the end, so two blocks side by side make one break.
const LINE = '\uE000'
const PARA = '\uE001'
// What the page never shows, contents and all (as DOMPurify drops them).
const HIDDEN = /^(?:SCRIPT|STYLE|TEMPLATE|NOSCRIPT|IFRAME|SVG|MATH|TITLE|HEAD|AUDIO|VIDEO|NOEMBED|NOFRAMES|XMP|PLAINTEXT|COLGROUP|THEAD)$/

// A link keeps where it went: "the entry form (example.com/enter)".
function linkText(text: string, href: string | null): string {
  if (!href || !/^(?:https?:|mailto:|tel:|[^:]*$)/i.test(href.trim())) return text
  const shown = href.replace(/^(?:mailto|tel):/i, '')
  if (!text.trim()) return shown
  const bare = (s: string) =>
    s.trim().toLowerCase().replace(/^[a-z]+:\/\//, '').replace(/^www\./, '').replace(/\/$/, '')
  return bare(text) === bare(shown) ? text : `${text} (${shown})`
}

function textOf(node: Node): string {
  let out = ''
  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      // Spaces and line breaks in HTML are one space, as the page shows them.
      out += (child.textContent ?? '').replace(/\s+/g, ' ')
      continue
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue
    const el = child as Element
    const tag = el.tagName.toUpperCase()
    if (HIDDEN.test(tag)) continue
    if (tag === 'BR') out += '\n'
    else if (tag === 'HR') out += PARA
    else if (PARAGRAPH.test(tag)) out += PARA + textOf(el) + PARA
    else if (tag === 'LI') out += `${LINE}• ${textOf(el).trim()}${LINE}`
    else if (tag === 'DIV') out += LINE + textOf(el) + LINE
    else if (tag === 'A') out += linkText(textOf(el), el.getAttribute('href'))
    else out += textOf(el)
  }
  return out
}

/**
 * Stored rich text as plain text to edit: paragraphs become a blank line,
 * <br> a new line, list items "• " lines, and links keep their address.
 * Plain text comes back unchanged.
 */
export function htmlToText(value: string | null | undefined): string {
  if (!value) return ''
  if (!looksLikeHtml(value)) return value
  // Read it as the public page does: a line break typed beside the tags is a
  // <br> unless it follows one (as in sanitizeRichText). Parsed in a
  // <template>, nothing in it runs or loads.
  const t = document.createElement('template')
  t.innerHTML = value.replace(/(?<!>)\n/g, '<br>')
  return textOf(t.content)
    .replace(/[\s\uE000\uE001]*[\uE000\uE001][\s\uE000\uE001]*/g, (run) =>
      '\n'.repeat(Math.max(run.split('\n').length - 1, run.includes(PARA) ? 2 : 1)),
    )
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
