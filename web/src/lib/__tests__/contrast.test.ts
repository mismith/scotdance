import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// A6: every ink the app sets on a fill or surface keeps WCAG contrast, in
// both themes, straight from the tokens in style.css. Text needs 4.5:1;
// large text, icons and control edges need 3:1. Only plain hex tokens are
// checked (mixes and oklch tints are derived from these).
const css = readFileSync(`${process.cwd()}/src/style.css`, 'utf8')

function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(`\n${selector} {`)
  const block = css.slice(start, css.indexOf('\n}', start))
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[\da-f]{3,6});/gi)].map((m) => [m[1], m[2]]))
}
const light = tokens(':root')
const THEMES = { light, dark: { ...light, ...tokens('.dark') } }

function luminance(hex: string) {
  const h = hex.length === 4 ? [...hex.slice(1)].map((c) => c + c).join('') : hex.slice(1)
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}
function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}

const TEXT = 4.5
const LARGE = 3
const PAIRS: Array<[ink: string, fill: string, min: number]> = [
  ...['background', 'card', 'raised', 'popover', 'muted'].map((f) => ['foreground', f, TEXT] as const),
  ...['background', 'card', 'raised', 'muted'].map((f) => ['muted-foreground', f, TEXT] as const),
  ...['background', 'card', 'raised', 'blue-paper'].map((f) => ['primary', f, TEXT] as const),
  ['primary-foreground', 'primary-fill', TEXT],
  ['secondary', 'background', TEXT],
  ['secondary', 'card', TEXT],
  ['secondary-foreground', 'secondary', TEXT],
  ['destructive', 'background', TEXT],
  ['destructive', 'card', TEXT],
  ['destructive-foreground', 'destructive-fill', TEXT],
  ...['background', 'card', 'live-paper'].map((f) => ['live', f, TEXT] as const),
  ['next-foreground', 'next', TEXT],
  ['done-foreground', 'done', TEXT],
  ['done-foreground', 'card', TEXT],
  // Field edges and focus rings.
  ['input', 'card', LARGE],
  ['ring', 'card', LARGE],
  ['ring', 'background', LARGE],
  // Initials and ticks on a followed dancer's colour.
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => ['on-dancer', `dancer-${n}`, LARGE] as const),
]

describe.each(Object.entries(THEMES))('%s theme', (_, t) => {
  it.each(PAIRS)('%s on %s reaches %s:1', (ink, fill, min) => {
    expect(t[ink], `--${ink}`).toBeDefined()
    expect(t[fill], `--${fill}`).toBeDefined()
    expect(contrast(t[ink]!, t[fill]!)).toBeGreaterThanOrEqual(min)
  })
})
