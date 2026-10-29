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

  it('takes local sites only while developing', () => {
    expect(isAllowedOrigin('http://localhost:5190')).toBe(false)
    expect(isAllowedOrigin('http://localhost:5190', { dev: true })).toBe(true)
    expect(isAllowedOrigin('http://127.0.0.1:5190', { dev: true })).toBe(true)
    expect(isAllowedOrigin('http://192.168.1.4:5190', { dev: true })).toBe(false)
  })
})

describe('readItem', () => {
  const item = { kind: 'dancers', source: 'Splits', name: 'entries.csv', text: '101,Ava,Ross' }

  it('takes a list of dancers', () => {
    expect(readItem(item)).toEqual(item)
    expect(readItem({ ...item, source: '  Splits ', extra: 'dropped' })).toEqual(item)
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
  it('gives a tool’s pass to its own site only', () => {
    expect(audienceFor('challenge', 'https://challenge.scotdance.app')).toBe('challenge')
    expect(audienceFor('challenge', 'https://splits.scotdance.app')).toBeNull()
    expect(audienceFor('challenge', 'https://scotdance.app')).toBeNull()
    expect(audienceFor('challenge', 'https://challenge.scotdance.app.evil.com')).toBeNull()
  })

  it('knows only its tools', () => {
    expect(audienceFor('toString', 'https://challenge.scotdance.app')).toBeNull()
    expect(audienceFor(undefined, 'https://challenge.scotdance.app')).toBeNull()
  })

  it('takes a local site while developing', () => {
    expect(audienceFor('challenge', 'http://localhost:5173')).toBeNull()
    expect(audienceFor('challenge', 'http://localhost:5173', { dev: true })).toBe('challenge')
  })
})
