// Writes the entry-list files the import tests upload. Run from the repo root
// (it borrows the old app's SheetJS to write real .xlsx files):
//
//   node web/e2e/fixtures/make-import-fixtures.mjs
//
// program.xlsx          A program: a title, template leftovers, merged
//                       headings, numbers as numbers and as text, a lettered
//                       number, blank rows, odd spacing, O’Neill and Ó Briain,
//                       and a dancer in two age groups. A notes sheet first.
// program-updated.csv   The same program a week later, saved by Excel on
//                       Windows (Windows-1252): one name fixed, one dancer
//                       moved, one new, one gone.
// table.xlsx            A table under a title, with a Category and an Age
//                       group column, and a number heading ("Bib No.") that
//                       has to be chosen by hand.

import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as XLSX from '../../../node_modules/xlsx/xlsx.mjs'

XLSX.set_fs(fs)
const out = (name) => fileURLToPath(new URL(name, import.meta.url))

function workbook(sheets) {
  const wb = XLSX.utils.book_new()
  for (const [name, rows, merges] of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(rows)
    if (merges) ws['!merges'] = merges
    XLSX.utils.book_append_sheet(wb, ws, name)
  }
  return wb
}
const across = (r) => ({ s: { r, c: 0 }, e: { r, c: 3 } })

// --- program.xlsx
const program = [
  ['Calgary Highland Games 2026: Program'],
  [],
  ['Category / Age Group'],
  ['Primary'],
  [101, 'Isla', 'MacDonald', 'Calgary, AB'],
  ['102', 'Ava', 'O’Neill', 'Edmonton, AB'],
  [103, 'Seán', 'Ó Briain  ', 'Glasgow'],
  [],
  ['Beginner 7 & Under 9 Years'],
  ['Dancer Number', 'First Name', 'Last Name', 'Location'],
  [201, 'Mia', 'Reid', 'Ottawa, ON'],
  [202, 'Ella', 'Grant'],
  ['203A', 'Lucy', 'Kerr', 'Halifax, NS'],
  [],
  ['Premier 12 & Under 14 Years'],
  [301, 'Freya', 'Ross', 'Vancouver, BC'],
  [302, ' Hannah ', 'Murray', 'Calgary, AB'],
  ['Premier Championship 12 & Over'],
  [301, 'Freya', 'Ross', 'Vancouver, BC'],
  [401, 'Ruby', 'Sinclair', 'Calgary, AB'],
]
XLSX.writeFile(
  workbook([
    ['Notes', [['Entries close June 1.'], ['Questions: the secretary.']]],
    ['Program', program, [0, 3, 8, 14, 17].map(across)],
  ]),
  out('program.xlsx'),
)

// --- program-updated.csv (Windows-1252, CRLF, as Excel's plain "CSV" saves)
const updated = [
  ['Primary', '', '', ''],
  ['101', 'Isla', 'MacDonald-Smith', 'Calgary, AB'],
  ['102', 'Ava', 'O’Neill', 'Edmonton, AB'],
  ['103', 'Seán', 'Ó Briain', 'Glasgow'],
  ['', '', '', ''],
  ['Beginner 7 & Under 9 Years', '', '', ''],
  ['201', 'Mia', 'Reid', 'Ottawa, ON'],
  ['203A', 'Lucy', 'Kerr', 'Halifax, NS'],
  ['204', 'Grace', 'Fraser', 'Red Deer, AB'],
  ['Premier 12 & Under 14 Years', '', '', ''],
  ['301', 'Freya', 'Ross', 'Vancouver, BC'],
  ['Premier 14 & Under 16 Years', '', '', ''],
  ['302', 'Hannah', 'Murray', 'Calgary, AB'],
  ['Premier Championship 12 & Over', '', '', ''],
  ['301', 'Freya', 'Ross', 'Vancouver, BC'],
  ['401', 'Ruby', 'Sinclair', 'Calgary, AB'],
]
const csv = updated.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\r\n') + '\r\n'
const cp1252 = { '’': 0x92, 'é': 0xe9, 'á': 0xe1, 'Ó': 0xd3 }
const bytes = [...csv].map((ch) => {
  if (ch.charCodeAt(0) < 0x80) return ch.charCodeAt(0)
  if (cp1252[ch] == null) throw new Error(`No Windows-1252 byte for ${ch}`)
  return cp1252[ch]
})
fs.writeFileSync(out('program-updated.csv'), Buffer.from(bytes))

// --- table.xlsx
const table = [
  ['Spring Fling 2026 entries', '', '', '', '', ''],
  [],
  ['Bib No.', 'First name', 'Last name', 'From', 'Category', 'Age group'],
  [11, 'Eilidh', 'Campbell', 'Calgary, AB', 'Novice', '10 & Under 12 Years'],
  [12, 'Morag', 'Stewart', 'Edmonton, AB', 'Novice', '10 & Under 12 Years'],
  [21, 'Kirsty', 'Mackenzie', 'Banff, AB', 'Intermediate', '12 Years & Over'],
]
XLSX.writeFile(workbook([['Entries', table, [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }]]]), out('table.xlsx'))

console.log('Wrote program.xlsx, program-updated.csv, table.xlsx')
