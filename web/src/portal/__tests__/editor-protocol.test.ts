import { describe, expect, it } from 'vitest'
import { editorOrigin, editorMessage, channel } from '../editor/protocol'
describe('owner editor boundary', () => {
  it('allows only exact first-party origins, with localhost restricted to development', () => {
    for (const origin of [
      'https://entries.scotdance.app',
      'https://binder.scotdance.app',
      'https://cshd.scotdance.site',
    ])
      expect(editorOrigin(origin)).toBe(true)
    for (const origin of [
      'null',
      'https://evil.test',
      'https://entries.scotdance.app.evil.test',
      'https://cshd.scotdance.site.evil.test',
      'https://one.two.scotdance.site',
      'https://entries.scotdance.app:444',
      'https://entries.scotdance.app/',
      'http://entries.scotdance.app',
      'http://127.0.0.1:5322',
    ])
      expect(editorOrigin(origin)).toBe(false)
    expect(editorOrigin('http://127.0.0.1:5322', true)).toBe(true)
  })
  it('rejects messages from other windows, origins and editor instances', () => {
    const source = {} as Window
    const message = {
      source,
      origin: 'https://entries.scotdance.app',
      data: { channel, session: 'active' },
    } as MessageEvent
    expect(editorMessage(message, source, message.origin, 'active')).toBe(true)
    expect(editorMessage(message, {} as Window, message.origin, 'active')).toBe(false)
    expect(editorMessage(message, source, 'https://evil.test', 'active')).toBe(false)
    expect(editorMessage(message, source, message.origin, 'old')).toBe(false)
  })
})
