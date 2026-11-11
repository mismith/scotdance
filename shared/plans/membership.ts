// Which dances an age group does, who can win a trophy event, and whether a championship ran as one.
import { namer } from "../labels";
import { entriesOf, plan, type CompetitionState, type Plan, type Updates } from "./types";

/** A dance on or off an age group (the dance holds the link: `dances/{id}/groupIds/{groupId}`). */
export function planSetDanceGroup(
  state: CompetitionState,
  danceId: string,
  groupId: string,
  on: boolean,
): Plan {
  const n = namer(state.data);
  const dance = n.danceLabel(danceId) ?? "a dance";
  const group = n.groupLabel(groupId) ?? "an age group";
  return plan(`${on ? "Added" : "Removed"} ${dance} ${on ? "to" : "from"} ${group}`, {
    [`dances/${danceId}/groupIds/${groupId}`]: on || null,
  });
}

/** Give an age group the same dances as another. `null` when it already does. */
export function planSameDancesAs(
  state: CompetitionState,
  groupId: string,
  sourceId: string,
): Plan | null {
  const updates: Updates = {};
  for (const d of entriesOf(state.data.dances)) {
    const want = !!d.groupIds?.[sourceId];
    if (want !== !!d.groupIds?.[groupId])
      updates[`dances/${d.id}/groupIds/${groupId}`] = want || null;
  }
  if (!Object.keys(updates).length) return null;
  return plan(`Now does the same dances as ${namer(state.data).groupLabel(sourceId)}`, updates);
}

/** An age group (or trophy event) with a trophy event's name for the cases below. */
export function planSetNotChampionship(
  state: CompetitionState,
  groupId: string,
  on: boolean,
): Plan {
  const label = namer(state.data).groupLabel(groupId) ?? "this age group";
  return plan(
    on ? `Marked ${label} not run as a championship` : `Marked ${label} a championship again`,
    { [`groups/${groupId}/notChampionship`]: on || null },
  );
}

/** One age group on or off a trophy event (who can win it). */
export function planSetTrophyEventGroup(
  state: CompetitionState,
  trophyEventId: string,
  groupId: string,
  on: boolean,
): Plan {
  const n = namer(state.data);
  return plan(
    `${on ? "Added" : "Removed"} ${n.groupLabel(groupId) ?? ""} ${on ? "to" : "from"} ${n.trophyEventLabel(trophyEventId) ?? ""}`,
    { [`trophyEvents/${trophyEventId}/groupIds/${groupId}`]: on || null },
  );
}

/** Every age group of a category (`blockName`) on or off a trophy event. */
export function planSetTrophyEventBlock(
  state: CompetitionState,
  trophyEventId: string,
  groupIds: string[],
  blockName: string,
  on: boolean,
): Plan {
  const updates = Object.fromEntries(
    groupIds.map((g) => [`trophyEvents/${trophyEventId}/groupIds/${g}`, on || null]),
  );
  return plan(
    `${on ? "Added" : "Removed"} all ${blockName} ${on ? "to" : "from"} ${namer(state.data).trophyEventLabel(trophyEventId) ?? ""}`,
    updates,
  );
}
