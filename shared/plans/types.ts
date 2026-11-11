// What a plan function takes and gives back. Pure data: no Vue, Firebase or DOM.

/** A multi-path update: `null` removes the path. Paths are slash-separated and relative to the competition. */
export type Updates = Record<string, unknown>;

/**
 * One change to a competition, worked out but not yet saved.
 * - `data`: paths under `competitions:data/{id}` (dancers, groups, results, schedule…)
 * - `info`: paths under `competitions/{id}` (name, date, listed, published, links…)
 * - `lasting`: paths under `competitions:data/{id}` deleted for good: saved after the rest and kept out of Undo
 *   (judges' sheets, whose files are deleted with them)
 * - `summary`: what happened, in the words Undo shows
 * - `warnings`: what a removal also takes with it, for a confirmation
 */
export interface Plan {
  data: Updates;
  info: Updates;
  lasting: Updates;
  summary: string;
  warnings: string[];
}

export const plan = (
  summary: string,
  data: Updates = {},
  rest: Partial<Omit<Plan, "summary" | "data">> = {},
): Plan => ({
  data,
  info: rest.info ?? {},
  lasting: rest.lasting ?? {},
  summary,
  warnings: rest.warnings ?? [],
});

/** Nothing to save. */
export const isEmpty = (p: Pick<Plan, "data" | "info" | "lasting">) =>
  !Object.keys(p.data).length && !Object.keys(p.info).length && !Object.keys(p.lasting).length;

// --- The competition as stored (what Manage reads live): raw records, so a plan never rewrites a field nobody touched.

export interface RawCategory {
  name?: string;
  _order?: number;
}
export interface RawGroup {
  name?: string;
  categoryId?: string;
  sponsor?: string;
  trophy?: string;
  notChampionship?: boolean;
  _order?: number;
}
export interface RawTrophyEvent {
  name?: string;
  trophy?: string;
  sponsor?: string;
  groupIds?: Record<string, boolean>;
  danceId?: string;
  _order?: number;
}
export interface RawDance {
  name?: string;
  shortName?: string;
  steps?: string | number;
  groupIds?: Record<string, boolean>;
  _order?: number;
}
export interface RawMember {
  firstName?: string;
  lastName?: string;
  dancerId?: string;
  _order?: number;
}
export interface RawDancer {
  number?: string | number;
  firstName?: string;
  lastName?: string;
  location?: string;
  groupId?: string;
  categoryId?: string;
  dancerId?: string;
  title?: string;
  studio?: string;
  team?: boolean;
  members?: Record<string, RawMember>;
}
export interface RawStaff {
  type?: string;
  firstName?: string;
  lastName?: string;
  location?: string;
  description?: string;
  image?: string;
  website?: string;
  judgeId?: string;
  piperId?: string;
  _order?: number;
}
export interface RawPlatform {
  name?: string;
  description?: string;
  _order?: number;
}

export interface RawSchedulePlatform {
  orderedGroupIds?: string[];
  orderedJudgeIds?: string[];
}
export interface RawScheduleDance {
  order?: number;
  danceId?: string;
  name?: string;
  description?: string;
  platforms?: Record<string, RawSchedulePlatform>;
}
export interface RawScheduleEvent {
  order?: number;
  name?: string;
  description?: string;
  dances?: Record<string, RawScheduleDance>;
}
export interface RawScheduleBlock {
  order?: number;
  name?: string;
  description?: string;
  events?: Record<string, RawScheduleEvent>;
}
export interface RawScheduleDay {
  order?: number;
  name?: string;
  date?: string | number;
  description?: string;
  blocks?: Record<string, RawScheduleBlock>;
}
export interface RawSchedule {
  days?: Record<string, RawScheduleDay>;
}

export interface RawData {
  categories?: Record<string, RawCategory>;
  groups?: Record<string, RawGroup>;
  trophyEvents?: Record<string, RawTrophyEvent>;
  dances?: Record<string, RawDance>;
  dancers?: Record<string, RawDancer>;
  staff?: Record<string, RawStaff>;
  platforms?: Record<string, RawPlatform>;
  schedule?: RawSchedule | false;
  results?: Record<string, Record<string, string[] | false | undefined>> | false;
  points?: Record<string, Record<string, Record<string, string[]>>>;
  sheets?: Record<string, Record<string, Record<string, unknown> | undefined> | undefined>;
  draws?: Record<string, Record<string, string[] | undefined>>;
}

/** The competition record (`competitions/{id}`): only what plans read. */
export interface RawInfo {
  name?: string;
  date?: string | number;
  listed?: boolean;
  published?: boolean;
  links?: Record<string, { name?: string; url?: string; _order?: number }>;
}

/** What every plan reads: the competition record and its data, as stored. */
export interface CompetitionState {
  info?: RawInfo | null;
  data: RawData;
}

export type CollectionKind =
  "dancers" | "groups" | "trophyEvents" | "categories" | "dances" | "platforms" | "staff";

/** A record with its id. */
export type WithId<T> = T & { id: string };

const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object";

/** The records of a collection that are records (a stray `true` or null is skipped), each with its id. */
export function entriesOf<T>(rec: Record<string, T> | undefined | null): Array<WithId<T>> {
  if (!rec || typeof rec !== "object") return [];
  return Object.entries(rec)
    .filter(([, v]) => v && typeof v === "object")
    .map(([id, v]) => ({ ...v, id }));
}

/** Results as stored: `false` (the tab hidden) reads as none. */
export const resultsOf = (data: RawData) => (data.results && obj(data.results) ? data.results : {});
export const pointsOf = (data: RawData) => data.points ?? {};
export const sheetsOf = (data: RawData) => (data.sheets && obj(data.sheets) ? data.sheets : {});
export const drawsOf = (data: RawData) => data.draws ?? {};
export const scheduleOf = (data: RawData): RawSchedule | null =>
  data.schedule && obj(data.schedule) ? data.schedule : null;
