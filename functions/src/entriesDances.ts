import { HttpsError } from 'firebase-functions/v2/https';

export interface EntriesDance {
  name: string;
  steps?: string | number;
  _order: number;
  /** Entries occurrences are distinct even when their dance and steps match. */
  entriesOccurrenceId?: string;
  entriesCanonicalDanceId?: string;
  entriesCategory?: string;
  entriesCountsForAggregate?: boolean;
}

const id = (value: unknown): value is string => typeof value === 'string' && /^[\w-]{1,100}$/.test(value);

/** Old ledgers group a dance by its name. Structured programs supply explicit occurrence identities. */
export function entriesDances(input: unknown): EntriesDance[] {
  if (!Array.isArray(input) || !input.length || input.length > 200)
    throw new HttpsError('invalid-argument', 'Send between one and 200 dances.');
  const structured = input.some((dance) => dance?.occurrenceId != null);
  const unique = new Map<string, EntriesDance>();
  for (const dance of input) {
    if (!dance || typeof dance.name !== 'string' || !dance.name.trim() || dance.name.length > 120
      || (dance.steps != null && !(typeof dance.steps === 'number' && Number.isFinite(dance.steps))
        && !(typeof dance.steps === 'string' && dance.steps.length <= 40))) {
      throw new HttpsError('invalid-argument', 'Each dance needs a name and valid steps.');
    }
    if (structured && (!id(dance.occurrenceId)
      || (dance.canonicalDanceId != null && !id(dance.canonicalDanceId)))) {
      throw new HttpsError('invalid-argument', 'Each program activity needs its own valid occurrence ID.');
    }
    if (structured && ((dance.category != null && (typeof dance.category !== 'string' || !dance.category.trim() || dance.category.length > 80))
      || (dance.countsForAggregate != null && typeof dance.countsForAggregate !== 'boolean')))
      throw new HttpsError('invalid-argument', 'Check the activity section and aggregate information.');
    const name = dance.name.trim();
    const fingerprint = structured ? dance.occurrenceId : `${name.toLowerCase()}|${String(dance.steps ?? '').trim()}`;
    if (structured && unique.has(fingerprint))
      throw new HttpsError('invalid-argument', 'An activity occurrence was sent more than once.');
    if (!unique.has(fingerprint)) unique.set(fingerprint, {
      name,
      ...(dance.steps != null && { steps: dance.steps }),
      _order: unique.size,
      ...(structured && { entriesOccurrenceId: dance.occurrenceId }),
      ...(structured && dance.canonicalDanceId != null && { entriesCanonicalDanceId: dance.canonicalDanceId }),
      ...(structured && dance.category != null && { entriesCategory: dance.category.trim() }),
      ...(structured && dance.countsForAggregate != null && { entriesCountsForAggregate: dance.countsForAggregate }),
    });
  }
  return [...unique.values()];
}
