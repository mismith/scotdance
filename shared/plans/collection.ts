// Adding, changing, removing and reordering the records of Manage's lists (dancers, age groups, dances,
// categories, platforms, staff, trophy events), with what each one drags along: a dancer's category follows
// their age group, removing an age group takes its results, draws and place in the schedule with it.
import { ensemble, entryName, isTeam, legacyNames, teamMembers } from "../entries";
import {
  danceLabel,
  categoryLabel,
  dancerLabel,
  groupLabel,
  platformLabel,
  staffLabel,
  trophyEventLabel,
} from "../labels";
import { forEachScheduleDance, idList, sheetsGoForGood } from "../util";
import { parsePlacings, OVERALL } from "../placings";
import {
  drawsOf,
  entriesOf,
  plan,
  pointsOf,
  resultsOf,
  scheduleOf,
  sheetsOf,
  type CollectionKind,
  type CompetitionState,
  type Plan,
  type RawData,
  type Updates,
  type WithId,
} from "./types";

type Item = WithId<Record<string, unknown>>;

export const KINDS: Record<
  CollectionKind,
  { singular: string; plural: string; sortable: boolean }
> = {
  dancers: { singular: "dancer", plural: "dancers", sortable: false },
  groups: { singular: "age group", plural: "age groups", sortable: true },
  trophyEvents: { singular: "trophy event", plural: "trophy events", sortable: true },
  categories: { singular: "category", plural: "categories", sortable: true },
  dances: { singular: "dance", plural: "dances", sortable: true },
  platforms: { singular: "platform", plural: "platforms", sortable: true },
  staff: { singular: "staff member", plural: "staff", sortable: true },
};

const num = (d: { number?: unknown }) => String(d.number ?? "").trim();

/** The list's records as the Manage list holds them: with ids, each name made. */
function items(data: RawData, kind: CollectionKind): Item[] {
  return entriesOf(data[kind] as Record<string, Record<string, unknown>> | undefined);
}

/** What a record is called in the list (and so in Undo): a team by its own name, else its label. */
export function titleOf(data: RawData, kind: CollectionKind, item: Item): string {
  const r = item as never;
  switch (kind) {
    case "categories":
      return categoryLabel(r);
    case "groups": {
      const category = entriesOf(data.categories).find(
        (c) => c.id === (item as { categoryId?: string }).categoryId,
      );
      return groupLabel(r, category);
    }
    case "dances":
      return danceLabel(r);
    case "trophyEvents":
      return trophyEventLabel(r);
    case "platforms":
      return platformLabel(r);
    case "staff":
      return staffLabel(r);
    case "dancers":
      return isTeam(r) ? entryName(r) : dancerLabel(r);
  }
}

/** "dancer", or "duet", "trio", "group" for an entry of several. */
export function singularOf(kind: CollectionKind, record: Record<string, unknown>): string {
  if (kind !== "dancers") return KINDS[kind].singular;
  const count = Array.isArray(record.dancers)
    ? record.dancers.length
    : record.team === true
      ? teamMembers(record as never).length || 2
      : 1;
  return count > 1 ? ensemble(count) : "dancer";
}

// --- What changing one field drags along

/** The writes alongside setting `key` of a record to `value`. */
export function changeEffects(
  state: CompetitionState,
  kind: CollectionKind,
  item: Item,
  key: string,
  value: unknown,
): Updates {
  const { data } = state;
  if (kind === "dancers") {
    const updates: Updates = {};
    // A dancer's category follows their age group (the import did the same).
    if (key === "groupId")
      updates[`dancers/${item.id}/categoryId`] =
        (value && entriesOf(data.groups).find((g) => g.id === String(value))?.categoryId) ?? null;
    // A team's name for v3 follows its title, studio and number (its dancers save their own).
    if (isTeam(item) && ["title", "studio", "number"].includes(key)) {
      const v3 = legacyNames({ ...item, [key]: value } as never);
      updates[`dancers/${item.id}/firstName`] = v3.firstName;
      updates[`dancers/${item.id}/lastName`] = v3.lastName;
    }
    return updates;
  }
  // A new dance: its place on the schedule was under the old one's row.
  if (kind === "trophyEvents")
    return key === "danceId" && (value || undefined) !== (item as { danceId?: string }).danceId
      ? offSchedule(data, [item.id])
      : {};
  return {};
}

/** Writes that take these age groups or trophy events off every platform they're on in the schedule. */
export function offSchedule(data: RawData, ids: string[]): Updates {
  const updates: Updates = {};
  forEachScheduleDance(scheduleOf(data), (path, item) => {
    for (const [pid, p] of Object.entries(item.platforms ?? {})) {
      const groups = idList(p?.orderedGroupIds);
      const kept = groups.filter((g) => !ids.includes(g));
      if (kept.length !== groups.length)
        updates[`${path}/platforms/${pid}/orderedGroupIds`] = kept.length ? kept : null;
    }
  });
  return updates;
}

// --- Adding

const nextOrder = (list: Item[]) =>
  list.reduce((max, i) => Math.max(max, typeof i._order === "number" ? i._order : -1), -1) + 1;

/**
 * Add a record. `record` is what the form made of its fields; `typed` its text fields as tidied (the
 * ones with a value make their dependent writes, e.g. a dancer's category). Sortable lists put it last.
 */
export function planAdd(
  state: CompetitionState,
  kind: CollectionKind,
  id: string,
  record: Record<string, unknown>,
  typed: Record<string, string> = {},
): Plan {
  const { data } = state;
  const rec = { ...record };
  if (KINDS[kind].sortable) rec._order = nextOrder(items(data, kind));
  // Extra fields that follow from others (e.g. a dancer's category) go into
  // the new record itself: one write can't touch a path and its child.
  const updates: Updates = {};
  const own = `${kind}/${id}/`;
  for (const [key, v] of Object.entries(typed)) {
    if (!v || !(key in rec)) continue;
    for (const [path, value] of Object.entries(
      changeEffects(state, kind, { ...rec, id }, key, v),
    )) {
      if (path.startsWith(own)) {
        if (value != null) rec[path.slice(own.length)] = value;
      } else updates[path] = value;
    }
  }
  updates[`${kind}/${id}`] = rec;
  const recordLabel = String(rec.name ?? [rec.firstName, rec.lastName].filter(Boolean).join(" "));
  const title = kind === "dancers" && isTeam(rec) ? entryName(rec as never) : recordLabel;
  const name = title || recordLabel || `the ${singularOf(kind, rec)}`;
  return plan(`Added ${name}`, updates);
}

/** Add several at once from presets, each `{ values }` with the scope (an age group's category) merged in. */
export function planAddPresets(
  state: CompetitionState,
  kind: CollectionKind,
  presets: Array<Record<string, string>>,
  scope: Record<string, string>,
  newId: () => string,
): Plan {
  let order = nextOrder(items(state.data, kind));
  const updates: Updates = {};
  const { singular, plural, sortable } = KINDS[kind];
  for (const values of presets)
    updates[`${kind}/${newId()}`] = {
      ...values,
      ...scope,
      ...(sortable ? { _order: order++ } : {}),
    };
  return plan(`Added ${presets.length} ${presets.length === 1 ? singular : plural}`, updates);
}

// --- Changing

/** Set one field of a record (`null` clears it). `fieldLabel` is how the form names the field. */
export function planSetField(
  state: CompetitionState,
  kind: CollectionKind,
  id: string,
  key: string,
  value: unknown,
  fieldLabel: string = key,
): Plan {
  const item = items(state.data, kind).find((i) => i.id === id) ?? ({ id } as Item);
  const updates: Updates = {
    [`${kind}/${id}/${key}`]: value,
    ...changeEffects(state, kind, item, key, value),
  };
  return plan(
    `${fieldLabel} of ${titleOf(state.data, kind, item) || `the ${singularOf(kind, item)}`}`,
    updates,
  );
}

/** Set one field on several records at once. */
export function planSetFieldOn(
  state: CompetitionState,
  kind: CollectionKind,
  ids: string[],
  key: string,
  value: unknown,
): Plan {
  const updates: Updates = {};
  const list = items(state.data, kind);
  for (const id of ids) {
    updates[`${kind}/${id}/${key}`] = value;
    const item = list.find((i) => i.id === id);
    if (item) Object.assign(updates, changeEffects(state, kind, item, key, value));
  }
  const { singular, plural } = KINDS[kind];
  return plan(`Updated ${ids.length} ${ids.length === 1 ? singular : plural}`, updates);
}

// --- Reordering

/** Save a new order: `_order` for each record whose place changed (nothing when dropped where it started). */
export function planReorder(
  kind: CollectionKind,
  order: Array<{ id: string; _order?: number }>,
): Plan {
  const updates: Updates = {};
  order.forEach((item, index) => {
    if (item._order !== index) updates[`${kind}/${item.id}/_order`] = index;
  });
  return plan(`Reordered ${KINDS[kind].plural}`, updates);
}

// --- Removing

/** What removing these takes with it. */
function removalEffects(
  state: CompetitionState,
  kind: CollectionKind,
  ids: string[],
): { updates: Updates; lasting: Updates; warnings: string[] } {
  const { data } = state;
  const none = { updates: {}, lasting: {}, warnings: [] as string[] };
  const results = resultsOf(data);
  const points = pointsOf(data);
  const sheets = sheetsOf(data);
  const draws = drawsOf(data);
  const trophyEvents = entriesOf(data.trophyEvents);
  const dancers = entriesOf(data.dancers);
  const groups = entriesOf(data.groups);
  const schedule = scheduleOf(data);

  switch (kind) {
    case "categories": {
      const n = ids.reduce((s, id) => s + groups.filter((g) => g.categoryId === id).length, 0);
      return {
        ...none,
        warnings: n
          ? [
              `${n} ${n === 1 ? "age group uses" : "age groups use"} ${ids.length === 1 ? "it" : "them"} and will need another category.`,
            ]
          : [],
      };
    }
    case "groups": {
      const updates: Updates = {};
      const lasting: Updates = {};
      const warnings: string[] = [];
      let nDancers = 0;
      let hasResults = false;
      for (const id of ids) {
        nDancers += dancers.filter((d) => d.groupId === id).length;
        for (const d of entriesOf(data.dances))
          if (d.groupIds?.[id]) updates[`dances/${d.id}/groupIds/${id}`] = null;
        // And off the trophy events it was open to.
        for (const x of trophyEvents)
          if (x.groupIds?.[id]) updates[`trophyEvents/${x.id}/groupIds/${id}`] = null;
        if (results[id]) {
          updates[`results/${id}`] = null;
          hasResults = true;
        }
        if (points[id]) updates[`points/${id}`] = null;
        // Its judges' sheets, for good (their files go with them: functions/src/sheets.ts).
        if (sheets[id]) lasting[`sheets/${id}`] = null;
        if (draws[id]) updates[`draws/${id}`] = null;
      }
      // And off the platforms they're on in the schedule.
      let scheduled = false;
      forEachScheduleDance(schedule, (path, item) => {
        for (const [pid, p] of Object.entries(item.platforms ?? {})) {
          const list = idList(p?.orderedGroupIds);
          const kept = list.filter((g) => !ids.includes(g));
          if (kept.length === list.length) continue;
          updates[`${path}/platforms/${pid}/orderedGroupIds`] = kept.length ? kept : null;
          scheduled = true;
        }
      });
      const them = ids.length === 1 ? "it" : "them";
      if (nDancers)
        warnings.push(
          `${nDancers} ${nDancers === 1 ? "dancer is" : "dancers are"} in ${them} and will need another age group.`,
        );
      if (hasResults)
        warnings.push(
          `${ids.length === 1 ? "Its" : "Their"} results and draws will be deleted too.`,
        );
      if (scheduled) warnings.push(`Also removes ${them} from the schedule.`);
      if (Object.keys(lasting).length) warnings.push(sheetsGoForGood(ids.length));
      return { updates, warnings, lasting };
    }
    case "dances": {
      const updates: Updates = {};
      let withResults = false;
      for (const [gid, byDance] of Object.entries(results)) {
        for (const id of ids) {
          if (byDance?.[id] !== undefined) {
            updates[`results/${gid}/${id}`] = null;
            withResults = true;
          }
        }
      }
      for (const [gid, byDance] of Object.entries(points))
        for (const id of ids) if (byDance?.[id]) updates[`points/${gid}/${id}`] = null;
      // Its judges' sheets, for good (their files go with them: functions/src/sheets.ts).
      const lasting: Updates = {};
      for (const [gid, byDance] of Object.entries(sheets))
        for (const id of ids) if (byDance?.[id]) lasting[`sheets/${gid}/${id}`] = null;
      for (const [gid, byDance] of Object.entries(draws))
        for (const id of ids) if (byDance?.[id]) updates[`draws/${gid}/${id}`] = null;
      // Its slots in the schedule go too (with who dances where in them).
      let scheduled = false;
      forEachScheduleDance(schedule, (path, item) => {
        if (item.danceId && ids.includes(item.danceId)) {
          updates[path] = null;
          scheduled = true;
        }
      });
      // Trophy events danced as it go back to being decided by the age groups' results.
      const danced = trophyEvents.filter((t) => t.danceId && ids.includes(t.danceId));
      for (const t of danced) updates[`trophyEvents/${t.id}/danceId`] = null;
      const warnings: string[] = [];
      if (withResults)
        warnings.push(`${ids.length === 1 ? "Its" : "Their"} results will be deleted too.`);
      if (danced.length)
        warnings.push(
          `${danced.map((t) => trophyEventLabel(t)).join(", ")} won’t be danced any more.`,
        );
      if (scheduled)
        warnings.push(`Also removes ${ids.length === 1 ? "it" : "them"} from the schedule.`);
      if (Object.keys(lasting).length) warnings.push(sheetsGoForGood(ids.length));
      return { updates, warnings, lasting };
    }
    case "platforms": {
      const updates: Updates = {};
      forEachScheduleDance(schedule, (path, item) => {
        for (const id of ids) if (item.platforms?.[id]) updates[`${path}/platforms/${id}`] = null;
      });
      const uses = Object.keys(updates).length;
      return {
        ...none,
        updates,
        warnings: uses
          ? [
              `The schedule puts age groups on ${ids.length === 1 ? "it" : "them"} in ${uses} ${uses === 1 ? "place" : "places"}; those assignments will be removed.`,
            ]
          : [],
      };
    }
    case "staff": {
      // Take them off any platform they're judging in the schedule.
      const updates: Updates = {};
      forEachScheduleDance(schedule, (path, item) => {
        for (const [pid, p] of Object.entries(item.platforms ?? {})) {
          const judges = idList(p?.orderedJudgeIds);
          const kept = judges.filter((j) => !ids.includes(j));
          if (kept.length !== judges.length)
            updates[`${path}/platforms/${pid}/orderedJudgeIds`] = kept.length ? kept : null;
        }
      });
      const n = Object.keys(updates).length;
      // And off any trophy they sponsor (stored by id), or its sponsor line would show the id.
      // Age groups' and trophy events'.
      const sponsoredGroups = groups.filter((g) => g.sponsor && ids.includes(g.sponsor));
      const sponsoredEvents = trophyEvents.filter((a) => a.sponsor && ids.includes(a.sponsor));
      for (const g of sponsoredGroups) updates[`groups/${g.id}/sponsor`] = null;
      for (const a of sponsoredEvents) updates[`trophyEvents/${a.id}/sponsor`] = null;
      const trophies = sponsoredGroups.length + sponsoredEvents.length;
      const warnings: string[] = [];
      if (n)
        warnings.push(
          `They’re judging in ${n} ${n === 1 ? "part" : "parts"} of the schedule and will be taken off.`,
        );
      if (trophies)
        warnings.push(
          `They sponsor ${trophies === 1 ? "a trophy" : `${trophies} trophies`}, which will show no sponsor.`,
        );
      return { ...none, updates, warnings };
    }
    case "trophyEvents": {
      // And off the schedule, where a danced one stands among the age groups.
      const updates: Updates = offSchedule(data, ids);
      const scheduled = Object.keys(updates).length > 0;
      let placed = 0;
      for (const id of ids) {
        const stored = results[id];
        if (stored && Object.keys(stored).length) updates[`results/${id}`] = null;
        if (parsePlacings(stored?.[OVERALL]).entries.length) placed++;
      }
      // Only warn when there are placings to lose (not for a "No results" mark).
      const warnings = placed
        ? [`${ids.length === 1 ? "Its" : "Their"} placings will be deleted too.`]
        : [];
      if (scheduled)
        warnings.push(`Also removes ${ids.length === 1 ? "it" : "them"} from the schedule.`);
      return { ...none, updates, warnings };
    }
    case "dancers": {
      const updates: Updates = {};
      // Take their numbers out of their age group's draws (numbers are only
      // unique within an age group, so other groups' draws are left alone).
      const gone = new Map<string, Set<string>>();
      for (const id of ids) {
        const d = dancers.find((x) => x.id === id);
        if (!d?.groupId || !num(d)) continue;
        gone.set(d.groupId, (gone.get(d.groupId) ?? new Set()).add(num(d)));
      }
      for (const [gid, nums] of gone) {
        for (const [did, raw] of Object.entries(draws[gid] ?? {})) {
          const order = idList(raw);
          const kept = order.filter((n) => !nums.has(n));
          if (kept.length !== order.length)
            updates[`draws/${gid}/${did}`] = kept.length ? kept : null;
        }
      }
      const withResults = ids.filter((id) => resultMentions(data, id) > 0);
      const warnings: string[] = [];
      if (withResults.length) {
        warnings.push(
          withResults.length === 1 && ids.length === 1
            ? "They have results entered. Those places will show as an unknown dancer (?) until changed."
            : `${withResults.length} of them have results entered. Those places will show as an unknown dancer (?) until changed.`,
        );
      }
      return { ...none, updates, warnings };
    }
  }
}

/** Which results mention a dancer (placings, callbacks or points). */
export function resultMentions(data: RawData, id: string): number {
  let count = 0;
  for (const byDance of Object.values(resultsOf(data))) {
    for (const placings of Object.values(byDance ?? {})) {
      if (Array.isArray(placings) && placings.some((p) => p === id || p === `${id}:tie`))
        count += 1;
    }
  }
  for (const byDance of Object.values(pointsOf(data))) {
    for (const byJudge of Object.values(byDance ?? {})) {
      if (Object.values(byJudge ?? {}).some((ids) => Array.isArray(ids) && ids.includes(id)))
        count += 1;
    }
  }
  return count;
}

/**
 * Remove records and everything that hangs off them: for an age group, its dancers' category link, results,
 * points, draws, sheets (`lasting`), schedule places and trophy events; for a dance, its results, points,
 * draws, sheets, schedule rows and trophy events danced as it; and so on (see `removalEffects`).
 * `warnings` says what else goes, for a confirmation.
 */
export function planRemove(state: CompetitionState, kind: CollectionKind, ids: string[]): Plan {
  const list = items(state.data, kind);
  const names = ids
    .map((id) => list.find((i) => i.id === id))
    .filter(Boolean)
    .map((i) => titleOf(state.data, kind, i as Item));
  const what =
    ids.length === 1
      ? (names[0] ?? `this ${KINDS[kind].singular}`)
      : `${ids.length} ${KINDS[kind].plural}`;
  const effects = removalEffects(state, kind, ids);
  const updates: Updates = { ...effects.updates };
  for (const id of ids) updates[`${kind}/${id}`] = null;
  return plan(`Deleted ${what}`, updates, { lasting: effects.lasting, warnings: effects.warnings });
}
