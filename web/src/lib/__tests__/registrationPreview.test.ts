import { describe, expect, it } from 'vitest'
import { registrationNote, registrationPreview, registrationToSave } from '@/lib/registration'

// A registration number's box, wherever one's typed (Add a competition,
// Manage › Details, System admin › Submissions): it says how the number will
// be saved, and saves just that.

describe('registrationPreview', () => {
  it('tidies one it can read, and names who registered it', () => {
    expect(registrationPreview('c ab co 26 1234')).toEqual({ saved: 'C-AB-CO-26-1234', unread: false, lines: ['Registered with ScotDance Canada: C-AB-CO-26-1234'] })
    expect(registrationPreview('use 134, C-AB-CO-26-1234').lines).toEqual(['Registered with ScotDance USA: USE-0134', 'Registered with ScotDance Canada: C-AB-CO-26-1234'])
  })

  it('keeps one it can’t read as typed (tidied of spaces), and says nothing itself', () => {
    expect(registrationPreview('  Pending   with SDC ')).toEqual({ saved: 'Pending with SDC', unread: true, lines: [] })
  })

  it('says a placeholder is left blank', () => {
    expect(registrationPreview('TBA')).toEqual({ saved: '', unread: false, lines: ['Left blank until you have one.'] })
  })

  it('reads a number that needs its competition’s year', () => {
    expect(registrationPreview('SQC 24/02', 2024).saved).toBe('SQC 2024/02')
  })
})

describe('the box’s note and save', () => {
  it('says nothing while it’s empty, and saves nothing', () => {
    expect(registrationNote('  ')).toBeNull()
    expect(registrationToSave('  ')).toBeNull()
    expect(registrationToSave('TBA')).toBeNull()
  })

  it('says how it’ll be saved, then saves that', () => {
    expect(registrationNote('c ab co 26 1234')).toBe('Registered with ScotDance Canada: C-AB-CO-26-1234')
    expect(registrationToSave('c ab co 26 1234')).toBe('C-AB-CO-26-1234')
    expect(registrationNote('Pending with SDC')).toBe('Not a format ScotDance.app knows, so it’s saved as typed.')
    expect(registrationToSave('Pending with SDC')).toBe('Pending with SDC')
  })
})
