import { describe, expect, it } from 'vitest'
import { stripTags } from '@/lib/stripTags'

describe('stripTags', () => {
  it('keeps the text, with line breaks for blocks and <br>', () => {
    expect(stripTags('<p>Morning &amp; noon</p><p>Second<br>line</p>')).toBe('Morning & noon\nSecond\nline\n')
  })

  it('drops scripts and styles entirely', () => {
    expect(stripTags('<style>p{}</style>Hi<script>alert(1)</script>')).toBe('Hi')
  })

  it('handles nothing', () => {
    expect(stripTags(null)).toBe('')
  })
})
