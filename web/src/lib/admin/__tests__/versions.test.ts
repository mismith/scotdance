import { describe, expect, it } from 'vitest'
import { versionJump } from '../versions'

describe('versionJump', () => {
  it('lets the usual next releases through', () => {
    expect(versionJump('4.0.1', '4.0.2')).toBeNull()
    expect(versionJump('4.0.1', '4.0.12')).toBeNull()
    expect(versionJump('4.0.1', '4.1.0')).toBeNull()
    expect(versionJump('4.2.3', '5.0.0')).toBeNull()
    expect(versionJump('4.2.3', '5.3.0')).toBeNull()
    expect(versionJump('4.0.1', '4.0.1')).toBeNull()
    expect(versionJump('4.0.1', '4.0.2-beta.1')).toBeNull()
  })

  it('flags a big jump', () => {
    expect(versionJump('4.0.1', '200.0.0')).toBe('big')
    expect(versionJump('4.0.1', '6.0.0')).toBe('big')
    expect(versionJump('4.0.1', '4.3.0')).toBe('big')
    expect(versionJump('4.0.1', '4.10.0')).toBe('big')
  })

  it('flags going back', () => {
    expect(versionJump('4.0.1', '4.0.0')).toBe('lower')
    expect(versionJump('4.1.0', '4.0.9')).toBe('lower')
    expect(versionJump('4.0.1', '3.9.9')).toBe('lower')
  })

  it('has nothing to say without two versions', () => {
    expect(versionJump(undefined, '4.0.0')).toBeNull()
    expect(versionJump('', '4.0.0')).toBeNull()
    expect(versionJump('4.0.1', '')).toBeNull()
    expect(versionJump('latest', '4.0.0')).toBeNull()
  })
})
