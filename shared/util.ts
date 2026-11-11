/**
 * A stored list of ids as strings: an array, or an object if it was ever
 * saved sparse. Old spacers are numbers (timestamps).
 */
export function idList(v: unknown): string[] {
  const values = Array.isArray(v) ? v : v && typeof v === "object" ? Object.values(v) : [];
  return values.filter((x) => x != null && x !== "").map(String);
}

// Push ids sort by creation time only when compared byte by byte, as Firebase
// does. `localeCompare` ignores case, so "-LEgsiq…" would land before "-LEgsT0…".
export const compareKeys = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export interface ScheduleDanceItem {
  danceId?: string;
  platforms?: Record<string, { orderedGroupIds?: unknown; orderedJudgeIds?: unknown } | undefined>;
}
export interface ScheduleTree {
  days?: Record<
    string,
    | {
        blocks?: Record<
          string,
          | {
              events?: Record<
                string,
                { dances?: Record<string, ScheduleDanceItem | undefined> } | undefined
              >;
            }
          | undefined
        >;
      }
    | undefined
  >;
}

/** Visit every dance item in the schedule with its path under competitions:data/{id}. */
export function forEachScheduleDance(
  schedule: ScheduleTree | null | undefined,
  visit: (path: string, item: ScheduleDanceItem) => void,
) {
  for (const [dayId, day] of Object.entries(schedule?.days ?? {}))
    for (const [blockId, block] of Object.entries(day?.blocks ?? {}))
      for (const [eventId, event] of Object.entries(block?.events ?? {}))
        for (const [itemId, item] of Object.entries(event?.dances ?? {}))
          if (item)
            visit(
              `schedule/days/${dayId}/blocks/${blockId}/events/${eventId}/dances/${itemId}`,
              item,
            );
}

/** Read a value at a slash path from a nested object. */
export function at(obj: unknown, path: string): unknown {
  return path
    .split("/")
    .reduce<unknown>(
      (o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined),
      obj,
    );
}

/** Said before deleting a dance or an age group that has any: Undo brings back the rest, not these. */
export const sheetsGoForGood = (n: number) =>
  `${n === 1 ? "Its judges’ sheets go" : "Their judges’ sheets go"} for good: Undo won’t bring them back.`;
