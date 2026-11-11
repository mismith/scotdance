// An entry is a dancer, or a duet, trio or group (ADR 0012): its names, and who dances in it.
import { ensemble, entryName, isTeam, legacyNames } from "../entries";
import { draftName, listToMembers, membersToList, type MemberDraft } from "../teamMembers";
import {
  entriesOf,
  plan,
  type CompetitionState,
  type Plan,
  type RawDancer,
  type Updates,
} from "./types";

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const keep = (r: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(r).filter(([, x]) => x != null && x !== ""));
const filled = (list: MemberDraft[]) => list.filter((r) => draftName(r));

/** The add form's rows with a name. */
export const namedRows = (rows: MemberDraft[] | undefined) =>
  (rows ?? []).filter((r) => draftName(r));

/**
 * The record the add form saves: a dancer, or (with two or more named rows) a team whose members each
 * get a key from `newId`, with v3's copy of its name (ADR 0012 decision 3).
 */
export function dancerRecord(
  v: {
    number?: unknown;
    groupId?: unknown;
    title?: unknown;
    studio?: unknown;
    location?: unknown;
    dancers?: MemberDraft[];
  },
  newId: () => string,
): Record<string, unknown> {
  const rows = namedRows(v.dancers).map((r) => ({
    ...r,
    firstName: r.firstName.trim(),
    lastName: r.lastName.trim(),
  }));
  const common = {
    number: text(v.number),
    groupId: text(v.groupId),
    title: text(v.title),
    studio: text(v.studio),
    location: text(v.location),
  };
  if (namedRows(v.dancers).length < 2)
    return keep({ ...common, firstName: rows[0]?.firstName, lastName: rows[0]?.lastName });
  const team = keep({ ...common, team: true, members: listToMembers(rows, newId) });
  return keep({ ...team, ...legacyNames(team) });
}

const find = (state: CompetitionState, id: string): RawDancer & { id: string } =>
  entriesOf(state.data.dancers).find((d) => d.id === id) ?? { id };
const nameOf = (d: RawDancer) => entryName(d) || "this entry";

/** How a change to an entry's dancers came out: for the message after. */
export type DancersOutcome = "name" | "one" | "team" | "became";
export interface DancersPlan {
  plan: Plan;
  outcome: DancersOutcome;
  /** The word for several dancers ("duet"), when it became one. */
  ensemble?: string;
  /** The dancer left on their own, when it became one dancer again. */
  alone?: string;
}

/** Several dancers as saved, with v3's copy of the entry's name (ADR 0012 decision 3). */
function teamUpdates(
  d: RawDancer & { id: string },
  list: MemberDraft[],
  newId: () => string,
): Updates {
  const at = (k: string) => `dancers/${d.id}/${k}`;
  const members = listToMembers(list, newId, isTeam(d) ? d.members : null);
  const v3 = legacyNames({ ...d, team: true, members: members ?? undefined });
  return {
    [at("team")]: true,
    [at("members")]: members,
    [at("firstName")]: v3.firstName,
    [at("lastName")]: v3.lastName,
    [at("dancerId")]: null,
  };
}

/**
 * Save an entry's dancers, from the list as edited. One dancer stays a dancer (just the name); several make
 * it a duet, trio or group; a team left with one dancer is a dancer again under their own name.
 */
export function planSetDancers(
  state: CompetitionState,
  id: string,
  list: MemberDraft[],
  newId: () => string,
  label?: string,
): DancersPlan {
  const d = find(state, id);
  const at = (k: string) => `dancers/${id}/${k}`;
  const named = filled(list);
  const savedTeam = isTeam(d);
  // A dancer with a new row still empty: just their own name.
  if (!savedTeam && named.length < 2) {
    const one = named[0] ?? { firstName: "", lastName: "" };
    return {
      plan: plan(`Name of ${nameOf(d)}`, {
        [at("firstName")]: one.firstName.trim() || null,
        [at("lastName")]: one.lastName.trim() || null,
      }),
      outcome: "name",
    };
  }
  if (named.length === 1 && savedTeam) {
    const one = named[0];
    return {
      plan: plan(`Made ${nameOf(d)} one dancer`, {
        [at("team")]: null,
        [at("members")]: null,
        [at("firstName")]: one.firstName.trim() || null,
        [at("lastName")]: one.lastName.trim() || null,
      }),
      outcome: "one",
      alone: draftName(one),
    };
  }
  const becoming = !savedTeam;
  return {
    plan: plan(
      becoming
        ? `Made ${nameOf(d)} a ${ensemble(named.length)}`
        : (label ?? `Dancers of ${nameOf(d)}`),
      teamUpdates(d, named, newId),
    ),
    outcome: becoming ? "became" : "team",
    ...(becoming && { ensemble: ensemble(named.length) }),
  };
}

/** A lone dancer's first or last name. */
export function planSetDancerName(
  state: CompetitionState,
  id: string,
  part: "firstName" | "lastName",
  value: string,
): Plan {
  return plan(
    `${part === "firstName" ? "First name" : "Last name"} of ${nameOf(find(state, id))}`,
    { [`dancers/${id}/${part}`]: value || null },
  );
}

/** Take one dancer off a saved team (by their place in its list). */
export function planTakeOffTeam(
  state: CompetitionState,
  id: string,
  index: number,
  newId: () => string,
): DancersPlan {
  const d = find(state, id);
  const saved = isTeam(d)
    ? membersToList(d.members)
    : [{ firstName: d.firstName ?? "", lastName: d.lastName ?? "" }];
  const r = saved[index];
  const left = saved.filter((_, n) => n !== index);
  if (filled(left).length === 1) return planSetDancers(state, id, left, newId);
  return {
    plan: plan(`Took ${draftName(r)} off ${nameOf(d)}`, teamUpdates(d, left, newId)),
    outcome: "team",
  };
}
