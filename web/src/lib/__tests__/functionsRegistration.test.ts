// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { getOnRegistrationWritten, tidyRegistration, yearOf } from '../../../../functions/src/registration'
import { FakeRtdb, snap } from './fakeRtdb'
import { registrations } from '@/lib/registration'

// Registration numbers (functions/src/registration.ts), tidied into each
// association's own format however they were typed. The cases are numbers
// as they were entered in production.

const tidy = (raw: string, year?: number) => tidyRegistration(raw, year).value

describe('Canada (RSOBHD, through ScotDance Canada)', () => {
  it('keeps the format, and mends the usual slips', () => {
    expect(tidy('C-AB-CO-26-1234')).toBe('C-AB-CO-26-1234')
    expect(tidy(' C-ON-CO-24-2430 ')).toBe('C-ON-CO-24-2430')
    expect(tidy('c-on-co-24-2430')).toBe('C-ON-CO-24-2430')
    expect(tidy('C-NS-C0-23-1007')).toBe('C-NS-CO-23-1007')
    expect(tidy('CSK- CO-23-1008')).toBe('C-SK-CO-23-1008')
    expect(tidy('CSK-CO-25-1008')).toBe('C-SK-CO-25-1008')
    expect(tidy('CA-AB-CO-18-1013')).toBe('C-AB-CO-18-1013')
    expect(tidy('C-BC-CO 24-1003')).toBe('C-BC-CO-24-1003')
    expect(tidy('C-BC-CO 221003')).toBe('C-BC-CO-22-1003')
    expect(tidy('C-NB-CO22-1022')).toBe('C-NB-CO-22-1022')
    expect(tidy('CO-QC-23-1008')).toBe('C-QC-CO-23-1008')
    expect(tidy('C-CO-QC-24-1003')).toBe('C-QC-CO-24-1003')
  })

  it('gives Manitoba’s the CO, and keeps their three digits', () => {
    expect(tidy('C-MB-22-143')).toBe('C-MB-CO-22-143')
    expect(tidy('C-MB-CO-24-172 ')).toBe('C-MB-CO-24-172')
    expect(tidy('C-MB-C0-26-191')).toBe('C-MB-CO-26-191')
  })

  it('reads one with its dashes run together', () => {
    expect(tidy('C-BC-CO 251025')).toBe('C-BC-CO-25-1025')
    expect(tidy('C-BC-CO- 261025')).toBe('C-BC-CO-26-1025')
  })

  it('keeps several, joined with commas', () => {
    expect(tidy('C-SK-CO-22-1009 and C-SK-CO-22-1010')).toBe('C-SK-CO-22-1009, C-SK-CO-22-1010')
    expect(tidy('C-SK-CO-24-1002 & C-SK-CO-24-1012 ')).toBe('C-SK-CO-24-1002, C-SK-CO-24-1012')
  })
})

describe('the USA (RSOBHD, through ScotDance USA)', () => {
  it('writes the region and four digits', () => {
    expect(tidy('USE-134')).toBe('USE-0134')
    expect(tidy('E-0136')).toBe('USE-0136')
    expect(tidy('USNW-0310')).toBe('USNW-0310')
    expect(tidy('USSE-0414')).toBe('USSE-0414')
    expect(tidy('us w 612')).toBe('USW-0612')
    expect(tidy('SCOTDANCE: USNW 0304')).toBe('USNW-0304')
  })
})

describe('Australia', () => {
  it('writes ABHDI’s and the committees’ numbers as two digits, then a four-digit year, spaced as each writes it', () => {
    expect(tidy('C15/2024')).toBe('C15/2024')
    expect(tidy('C05/24')).toBe('C05/2024')
    expect(tidy('C 02 /2024  and  V 01 /2024')).toBe('C02/2024, V01/2024')
    expect(tidy('C021/2026')).toBe('C21/2026')
    expect(tidy('V 05/25')).toBe('V05/2025')
    expect(tidy('v 12/2025')).toBe('V12/2025')
    expect(tidy('FNQ-06/25')).toBe('FNQ 06/2025')
    expect(tidy('FNQ01/2024')).toBe('FNQ 01/2024')
    expect(tidy('C12/2025 & NSW14/2025')).toBe('C12/2025, NSW 14/2025')
    expect(tidy('C12/2026 @ V05/2026')).toBe('C12/2026, V05/2026')
    expect(tidy('T6/2026')).toBe('T06/2026')
    expect(tidy('Comp. No: SA 1/26')).toBe('SA 01/2026')
    expect(tidy('WAM 3/2026')).toBe('WAM 03/2026')
  })

  it('keeps the ACT’s and Eastern Goldfields’ running numbers', () => {
    expect(tidy('C18/2026 ACT Reg No 167')).toBe('C18/2026, ACT 167')
    expect(tidy('EGHD/C203')).toBe('EGHD/C203')
    expect(tidy('C10/2026 EGHD / C 201')).toBe('C10/2026, EGHD/C201')
  })

  it('writes South Queensland’s year first', () => {
    expect(tidy('SQC2023/06')).toBe('SQC 2023/06')
    expect(tidy('SQC 2023/08')).toBe('SQC 2023/08')
    expect(tidy('SQC02/2024')).toBe('SQC 2024/02')
    // Two two-digit parts: the competition’s year says which is which.
    expect(tidy('SQC24/02  C05/24', 2024)).toBe('SQC 2024/02, C05/2024')
    expect(tidyRegistration('SQC24/02', null).unread).toEqual(['SQC24/02'])
  })

  it('takes off the labels around them', () => {
    expect(tidy('ABHDI Registration No C21/2023')).toBe('C21/2023')
    expect(tidy('ABHDI: C21/2024, SNDP04/24, SQC 2024/10')).toBe('C21/2024, SNDP04/2024, SQC 2024/10')
    expect(tidy('ABHDI Reg No C23 /2024 VSCHDI V15/24 VSDMAI and LLHDA V16/24 ')).toBe('C23/2024, V15/2024, V16/2024')
    expect(tidy('Championships no C14/2026 Reg no NSW14/2026')).toBe('C14/2026, NSW 14/2026')
    expect(tidy('ABHDI C10/2023 & FNQ 08/23')).toBe('C10/2023, FNQ 08/2023')
    expect(tidy('Reg. No. SQC 2026/11, C19/2026 & SNDP04/2026')).toBe('SQC 2026/11, C19/2026, SNDP04/2026')
  })

  it('leaves FNQ’s old numbers (FNQ C05/17, before 2022) as typed: their C isn’t ABHDI’s', () => {
    expect(tidyRegistration('FNQ C05/17')).toEqual({ value: 'FNQ C05/17', unread: ['FNQ'] })
  })
})

describe('anything else', () => {
  it('drops placeholders', () => {
    for (const raw of ['TBA', 'TBD', 'N/A', 'n/a', ' ', '']) expect(tidyRegistration(raw)).toEqual({ value: '', unread: [] })
  })

  it('leaves it all as typed when it can’t read some, and says what', () => {
    expect(tidyRegistration('C-AB-CO-23-1005X')).toEqual({ value: 'C-AB-CO-23-1005X', unread: ['C-AB-CO-23-1005X'] })
    expect(tidyRegistration('C-NS-CO-1014').unread).toEqual(['C-NS-CO-1014'])
    expect(tidyRegistration('C-AB-CO-26-').unread).toEqual(['C-AB-CO-26-'])
    // (What each is for stays with it.)
    expect(tidyRegistration(' Competition CSK-CO-1005,  Workshop CSK-CO-1006')).toEqual({
      value: 'Competition CSK-CO-1005, Workshop CSK-CO-1006',
      unread: ['CSK-CO-1005', 'CSK-CO-1006'],
    })
    expect(tidyRegistration('c-on-co-26-2609, BSC2109056B')).toEqual({ value: 'c-on-co-26-2609, BSC2109056B', unread: ['BSC2109056B'] })
  })

  it('says the same number once', () => {
    expect(tidy('C-MB-CO-24-168, C-MB-24-168')).toBe('C-MB-CO-24-168')
  })

  it('reads a competition’s year from its date', () => {
    expect(yearOf('2026-05-03')).toBe(2026)
    expect(yearOf('soon')).toBeNull()
    expect(yearOf(undefined)).toBeNull()
  })
})

describe('the trigger on a competition’s number', () => {
  it('writes it back tidied, once, and leaves a tidy one be', async () => {
    const rtdb = new FakeRtdb()
    rtdb.write({ 'competitions/c1': { name: 'Thistle Championships', date: '2024-03-16', sobhd: 'SQC24/02  C05/24' } })
    const onWritten = getOnRegistrationWritten(rtdb.ref())
    const deliver = () => onWritten({ after: snap(rtdb.read('competitions/c1/sobhd')) }, { params: { competitionId: 'c1' } })
    await deliver()
    expect(rtdb.read('competitions/c1/sobhd')).toBe('SQC 2024/02, C05/2024')
    const writes = rtdb.writes
    await deliver()
    expect(rtdb.writes).toBe(writes)
  })

  it('clears a placeholder, and leaves a removed number alone', async () => {
    const rtdb = new FakeRtdb()
    rtdb.write({ 'competitions/c1': { date: '2025-11-16', sobhd: 'TBA' } })
    const onWritten = getOnRegistrationWritten(rtdb.ref())
    await onWritten({ after: snap('TBA') }, { params: { competitionId: 'c1' } })
    expect(rtdb.read('competitions/c1/sobhd')).toBeNull()
    await onWritten({ after: snap(null) }, { params: { competitionId: 'c1' } })
    expect(rtdb.read('competitions/c1')).toEqual({ date: '2025-11-16' })
  })
})

describe('naming each association (the app’s side)', () => {
  it('names what it knows from the tidied form, and otherwise just shows the number', () => {
    expect(registrations('C-AB-CO-26-1234, USE-0134')).toEqual([
      { number: 'C-AB-CO-26-1234', association: 'ScotDance Canada' },
      { number: 'USE-0134', association: 'ScotDance USA' },
    ])
    expect(registrations('C12/2025, SNDP04/2026, SQC 2026/11, NSW 14/2025').map((r) => r.association)).toEqual(['ABHDI', 'ABHDI', 'SQRCHDI', 'NSWSCHDI'])
    expect(registrations('ACT 167')).toEqual([{ number: 'ACT 167', association: null }])
    expect(registrations('BSC2109056B')).toEqual([{ number: 'BSC2109056B', association: null }])
    expect(registrations('')).toEqual([])
    expect(registrations(undefined)).toEqual([])
  })

  it('agrees with the server: every tidied number it names is one the server writes', () => {
    for (const raw of ['C-NS-C0-23-1007', 'E-0136', 'USSE 414', 'C05/24', 'V 05/25', 'FNQ-06/25', 'SQC02/2024', 'SNDP04/24', 'NSW14/2025', 'T6/2026', 'SA 1/26', 'WAM 3/2026']) {
      const [r] = registrations(tidy(raw))
      expect(r.association, raw).not.toBeNull()
    }
  })
})
