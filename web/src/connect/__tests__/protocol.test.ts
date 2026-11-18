import { describe, expect, it } from 'vitest'
import { CHANNEL, audienceFor, isAllowedOrigin, isFromTool, readItem } from '../protocol'

describe('isAllowedOrigin', () => {
  it('takes ScotDance.app and its subdomains, over https only', () => {
    expect(isAllowedOrigin('https://scotdance.app')).toBe(true)
    expect(isAllowedOrigin('https://splits.scotdance.app')).toBe(true)
    expect(isAllowedOrigin('https://toolkit.scotdance.app')).toBe(true)
    expect(isAllowedOrigin('http://splits.scotdance.app')).toBe(false)
  })

  it('turns away look-alikes', () => {
    expect(isAllowedOrigin('https://scotdance.app.evil.com')).toBe(false)
    expect(isAllowedOrigin('https://evilscotdance.app')).toBe(false)
    expect(isAllowedOrigin('https://splits.scotdance.app.example')).toBe(false)
    expect(isAllowedOrigin('null')).toBe(false)
    expect(isAllowedOrigin('https://scotdance.app/connect')).toBe(false)
  })

  it('takes studios’ own sites on Binder, one name deep, over https', () => {
    expect(isAllowedOrigin('https://cshd.scotdance.site')).toBe(true)
    expect(isAllowedOrigin('https://glen-dance.scotdance.site')).toBe(true)
    expect(isAllowedOrigin('http://cshd.scotdance.site')).toBe(false)
    expect(isAllowedOrigin('https://scotdance.site')).toBe(false)
    expect(isAllowedOrigin('https://a.b.scotdance.site')).toBe(false)
    expect(isAllowedOrigin('https://-x.scotdance.site')).toBe(false)
    expect(isAllowedOrigin('https://cshd.scotdance.site.evil.com')).toBe(false)
    expect(isAllowedOrigin('https://cshdscotdance.site')).toBe(false)
  })

  it('takes local sites only while developing', () => {
    expect(isAllowedOrigin('http://localhost:5190')).toBe(false)
    expect(isAllowedOrigin('http://localhost:5190', { dev: true, localTools: { entries: 'http://localhost:5190' } })).toBe(true)
    expect(isAllowedOrigin('http://127.0.0.1:5190', { dev: true })).toBe(false)
    expect(isAllowedOrigin('http://192.168.1.4:5190', { dev: true })).toBe(false)
  })
})

describe('readItem', () => {
  const item = { kind: 'dancers', source: 'Splits', name: 'entries.csv', text: '101,Ava,Ross' }

  it('takes a list of dancers', () => {
    expect(readItem(item)).toEqual(item)
    expect(readItem({ ...item, source: '  Splits ', extra: 'dropped' })).toEqual(item)
  })

  it('preserves a valid preselected competition and rejects path injection', () => {
    expect(readItem({ ...item, competitionId: '-Saturday' })).toEqual({ ...item, competitionId: '-Saturday' })
    for (const competitionId of ['', '../other', 'one/two', 42, 'x'.repeat(129)]) {
      expect(readItem({ ...item, competitionId })).toBeNull()
    }
  })

  it('turns away anything else', () => {
    expect(readItem(null)).toBeNull()
    expect(readItem({ ...item, kind: 'results' })).toBeNull()
    expect(readItem({ ...item, source: '' })).toBeNull()
    expect(readItem({ ...item, name: 'x'.repeat(201) })).toBeNull()
    expect(readItem({ ...item, text: '  ' })).toBeNull()
    expect(readItem({ ...item, text: 'x'.repeat(1_000_001) })).toBeNull()
  })
})

describe('isFromTool', () => {
  it('only reads messages on our channel', () => {
    expect(isFromTool({ channel: CHANNEL, type: 'send', item: {} })).toBe(true)
    expect(isFromTool({ channel: CHANNEL, type: 'signIn', audience: 'challenge' })).toBe(true)
    expect(isFromTool({ channel: CHANNEL, type: 'delete' })).toBe(false)
    expect(isFromTool({ channel: 'other', type: 'send' })).toBe(false)
    expect(isFromTool('send')).toBe(false)
  })
})

describe('audienceFor', () => {
  it('restricts central account handoff to Connect alone', () => {
    expect(audienceFor('connect', 'https://connect.scotdance.app')).toBe('connect')
    for (const origin of ['https://entries.scotdance.app', 'https://binder.scotdance.app', 'https://cshd.scotdance.site', 'https://connect.scotdance.app.evil.example', 'https://scotdance-connect.web.app', 'http://connect.scotdance.app']) {
      expect(audienceFor('connect', origin)).toBeNull()
    }
  })

  it('gives a tool’s pass to its own site only', () => {
    expect(audienceFor('challenge', 'https://challenge.scotdance.app')).toBe('challenge')
    expect(audienceFor('challenge', 'https://splits.scotdance.app')).toBeNull()
    expect(audienceFor('challenge', 'https://scotdance.app')).toBeNull()
    expect(audienceFor('challenge', 'https://challenge.scotdance.app.evil.com')).toBeNull()
    expect(audienceFor('binder', 'https://binder.scotdance.app')).toBe('binder')
    expect(audienceFor('binder', 'https://challenge.scotdance.app')).toBeNull()
    expect(audienceFor('binder', 'https://cshd.scotdance.site')).toBe('binder')
    expect(audienceFor('challenge', 'https://cshd.scotdance.site')).toBeNull()
    expect(audienceFor('binder', 'http://cshd.scotdance.site')).toBeNull()
    expect(audienceFor('binder', 'https://a.b.scotdance.site')).toBeNull()
    expect(audienceFor('entries', 'https://entries.scotdance.app')).toBe('entries')
    expect(audienceFor('entries', 'https://dev.entries.scotdance.app')).toBe('entries-dev')
    expect(audienceFor('binder', 'https://dev.entries.scotdance.app')).toBeNull()
    expect(audienceFor('entries', 'https://dev.entries.scotdance.app.evil.example')).toBeNull()
    expect(audienceFor('entries', 'https://binder.scotdance.app')).toBeNull()
    expect(audienceFor('entries', 'https://scotdance-entries--kilt-gskstz6n.web.app')).toBe('entries-dev')
    expect(audienceFor('entries-dev', 'https://entries.scotdance.app')).toBeNull()
    expect(audienceFor('binder', 'https://scotdance-entries--kilt-gskstz6n.web.app')).toBeNull()
    expect(audienceFor('entries', 'https://scotdance-entries.web.app')).toBeNull()
    expect(audienceFor('entries', 'https://evil--scotdance-entries--x.web.app')).toBeNull()
    expect(audienceFor('entries', 'http://scotdance-entries--kilt-gskstz6n.web.app')).toBeNull()
    expect(audienceFor('entries', 'https://cshd.scotdance.site')).toBeNull()
  })

  it('knows only its tools', () => {
    expect(audienceFor('toString', 'https://challenge.scotdance.app')).toBeNull()
    expect(audienceFor(undefined, 'https://challenge.scotdance.app')).toBeNull()
  })

  it('takes a local site while developing', () => {
    expect(audienceFor('challenge', 'http://localhost:5173')).toBeNull()
    expect(audienceFor('challenge', 'http://localhost:5173', { dev: true, localTools: { challenge: 'http://localhost:5173' } })).toBe('challenge')
  })
})

// A second local page must not steal the central session by posing as Connect.
describe('local sign-in isolation', () => {
  it('does not grant any audience merely because the caller is localhost', () => {
    for (const audience of ['connect', 'entries', 'binder', 'challenge']) {
      expect(audienceFor(audience, 'http://127.0.0.1:6001', { dev: true })).toBeNull()
    }
  })
})


describe('explicit local tool bindings', () => {
  const localTools = { entries: 'http://127.0.0.1:5397', connect: 'http://127.0.0.1:5399' }
  const options = { dev: true, localTools }
  it('allows only the configured audience at each exact origin', () => {
    expect(audienceFor('entries', localTools.entries, options)).toBe('entries')
    expect(audienceFor('connect', localTools.connect, options)).toBe('connect')
    expect(audienceFor('connect', localTools.entries, options)).toBeNull()
    expect(audienceFor('entries', localTools.connect, options)).toBeNull()
    for (const origin of ['http://127.0.0.1:6001', 'http://localhost:5397', 'http://127.0.0.1:5397.evil.example', 'null']) {
      expect(isAllowedOrigin(origin, options)).toBe(false)
      expect(audienceFor('connect', origin, options)).toBeNull()
    }
  })
  it('ignores local configuration in a release build and refuses non-loopback configuration', () => {
    expect(audienceFor('entries', localTools.entries, { localTools })).toBeNull()
    const origin = 'http://evil.example'
    expect(audienceFor('connect', origin, { dev: true, localTools: { connect: origin } })).toBeNull()
  })
})
