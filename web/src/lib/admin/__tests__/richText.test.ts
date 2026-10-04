import { describe, expect, it } from 'vitest'
import { htmlToText, looksLikeHtml } from '../richText'

describe('looksLikeHtml', () => {
  it('spots tags and entities', () => {
    expect(looksLikeHtml('<p>Entries close Friday.</p>')).toBe(true)
    expect(looksLikeHtml('Line one<br/>Line two')).toBe(true)
    expect(looksLikeHtml('Fish &amp; chips')).toBe(true)
  })

  it('leaves plain text alone, angle brackets and ampersands included', () => {
    expect(looksLikeHtml('Two days of dancing.\n\nEntries close a week before.')).toBe(false)
    expect(looksLikeHtml('Ages 6 & under, <8 dancers a heat, 9 > 8')).toBe(false)
    expect(looksLikeHtml('Dancers <3 the Fling')).toBe(false)
  })
})

describe('htmlToText', () => {
  it('gives plain text back unchanged', () => {
    const plain = 'Two days of dancing.\n\nEntries close a week before.'
    expect(htmlToText(plain)).toBe(plain)
    expect(htmlToText(null)).toBe('')
    expect(htmlToText(undefined)).toBe('')
  })

  it('turns paragraphs into blank lines and <br> into new lines', () => {
    expect(htmlToText('<p>Entries, prizes and timings.</p>')).toBe('Entries, prizes and timings.')
    expect(htmlToText('<p>One</p><p>Two<br>Three</p>')).toBe('One\n\nTwo\nThree')
    // The old editor's empty paragraphs, and the source's own line breaks between tags.
    expect(htmlToText('<p>One</p>\n<p><br></p>\n<p>Two</p>')).toBe('One\n\nTwo')
    expect(htmlToText('<p>One<br></p><p>Two</p>')).toBe('One\n\nTwo')
    expect(htmlToText('<div>One</div><div>Two</div>')).toBe('One\nTwo')
  })

  it('keeps line breaks typed beside tags, as the page shows them', () => {
    expect(htmlToText('Line one\n<b>Line two</b>')).toBe('Line one\nLine two')
  })

  it('decodes entities and folds spaces as the page does', () => {
    expect(htmlToText('<p>Fish &amp; chips&nbsp;at  1&nbsp;pm</p>')).toBe('Fish & chips at 1 pm')
  })

  it('keeps where links went', () => {
    expect(
      htmlToText(
        '<p>Enter <a href="https://example.com/enter">here</a>, see <a href="https://www.example.com/">example.com</a> or email <a href="mailto:hi@example.com">hi@example.com</a>.</p>',
      ),
    ).toBe('Enter here (https://example.com/enter), see example.com or email hi@example.com.')
  })

  it('writes list items as lines and drops formatting but not words', () => {
    expect(htmlToText('<p>Dances:</p><ul><li>Fling</li><li><b>Sword</b></li></ul><p>Done</p>')).toBe(
      'Dances:\n\n• Fling\n• Sword\n\nDone',
    )
    expect(htmlToText('<b>bold</b> and <u>under</u>')).toBe('bold and under')
  })

  it('shows only what the page would, never scripts', () => {
    expect(htmlToText('<p>Hi</p><script>alert(1)</script><img src=x onerror="alert(1)">')).toBe('Hi')
  })
})
