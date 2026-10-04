import { describe, expect, it } from 'vitest'
import { linkify } from '@/lib/sanitize'

describe('linkify', () => {
  it('links web addresses typed as text', () => {
    expect(linkify('Entry form (https://example.com/entry).')).toBe(
      'Entry form (<a href="https://example.com/entry">https://example.com/entry</a>).',
    )
  })
  it('leaves existing links and tags alone', () => {
    const html = '<p><a href="https://a.test">https://a.test</a> and <img src="https://b.test/x.png"></p>'
    expect(linkify(html)).toBe(html)
  })
  it('links text after a link closes', () => {
    expect(linkify('<a href="x">x</a> then https://c.test')).toBe('<a href="x">x</a> then <a href="https://c.test">https://c.test</a>')
  })
})
