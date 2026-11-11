import { issuer } from './config';
import { ToolError } from './errors';
import { pushId } from './ids';
import { assertManages } from './read';
import type { Session } from './session';

/**
 * draft_dancers (ADR 0018): a whole list read from a spreadsheet, PDF or photo, filed in the organiser's import
 * inbox (`users:inbox/{uid}`, the same place Splits sends lists) as CSV in the shape Import dancers already reads.
 * Nothing in the competition changes: the organiser opens Import dancers, sees the usual preview, and presses Import.
 * So a list is checked by a person, and the app's own importer does the matching, the new age groups and the tidying.
 */

export interface DraftEntry {
  number: string;
  /** As the list writes it ("Premier"): Import dancers makes it if the competition lacks it */
  category?: string;
  ageGroup?: string;
  firstName?: string;
  lastName?: string;
  location?: string;
  studio?: string;
  routine?: string;
  /** A duet, trio or group: its dancers; one row each in the file */
  members?: Array<{ firstName: string; lastName?: string }>;
}

export const MAX_DRAFT_ENTRIES = 1500;
/** The inbox rule allows 1,000,000 characters */
const MAX_TEXT = 900_000;

const HEADER = ['Number', 'First name', 'Last name', 'Location', 'Category', 'Age group', 'Studio', 'Routine'];

const cell = (v: unknown) => {
  const s = String(v ?? '').replace(/\r?\n/g, ' ');
  return /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** The list as CSV: one row per dancer, a team's dancers on rows with the same number and age group (as Import dancers reads them) */
export function draftCsv(entries: DraftEntry[]): string {
  const lines = [HEADER.join(',')];
  for (const e of entries) {
    const dancers = e.members?.length ? e.members : [{ firstName: e.firstName ?? '', lastName: e.lastName ?? '' }];
    dancers.forEach((d, i) => {
      // The rest of the entry is said once, on its first row
      lines.push(
        [e.number, d.firstName, d.lastName ?? '', i ? '' : e.location, e.category, e.ageGroup, i ? '' : e.studio, i ? '' : e.routine]
          .map(cell)
          .join(','),
      );
    });
  }
  return lines.join('\n');
}

export function checkDraft(entries: DraftEntry[]): void {
  if (!entries.length) throw new ToolError('There are no dancers in that list.');
  if (entries.length > MAX_DRAFT_ENTRIES) {
    throw new ToolError(`A list can hold ${MAX_DRAFT_ENTRIES} entries; this has ${entries.length}. Send it in two or more lists.`);
  }
  entries.forEach((e, i) => {
    if (!String(e.number ?? '').trim()) throw new ToolError(`Entry ${i + 1} has no number.`);
    const named = e.members?.length ? e.members.every((m) => m.firstName?.trim()) : !!e.firstName?.trim();
    if (!named) throw new ToolError(`Entry ${e.number} needs a first name (or members, for a duet, trio or group).`);
  });
}

export async function fileDraft(session: Session, competition: string, entries: DraftEntry[], name?: string, newId: () => string = pushId) {
  await assertManages(session, competition);
  checkDraft(entries);
  const text = draftCsv(entries);
  if (text.length > MAX_TEXT) throw new ToolError('That list is too long for one file. Send it in two or more lists.');
  const id = newId();
  const file = name?.trim() || `${session.client || 'Assistant'} list.csv`;
  await session.write(`users:inbox/${session.uid}/${id}`, {
    kind: 'dancers',
    source: (session.client || 'Assistant').slice(0, 60),
    name: file.slice(0, 120),
    text,
    competitionId: competition,
    sentAt: { '.sv': 'timestamp' },
  });
  const where = `${issuer()}/competitions/${competition}/manage/dancers/import?inbox=${id}`;
  return {
    summary: `Filed ${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} in the organiser’s import inbox as “${file}”. Nothing in the competition has changed.`,
    entries: entries.length,
    inbox: id,
    next: `Tell the organiser to open ${where} (Manage › Dancers › Import, the list is waiting there), check the preview, and press Import.`,
  };
}
