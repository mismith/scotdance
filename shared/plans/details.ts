// The competition's own record (name, date, venue, links, who can see it) and hiding the Schedule or Results tab.
import {
  plan,
  resultsOf,
  scheduleOf,
  type CompetitionState,
  type Plan,
  type RawInfo,
} from "./types";

/** A text field of the competition (`null` clears it). `label` is what Undo calls it. */
export const planSetDetail = (key: string, value: unknown, label: string = key): Plan =>
  plan(label, {}, { info: { [key]: value } });

/** Listed: on lists and search. Unlisting also unpublishes. */
export const planListed = (on: boolean): Plan =>
  plan(
    on ? "Listed" : "Unlisted",
    {},
    { info: on ? { listed: true } : { listed: false, published: false } },
  );

/** Published: visible to everyone. Publishing also lists. */
export const planPublished = (on: boolean): Plan =>
  plan(
    on ? "Published" : "Unpublished",
    {},
    { info: on ? { published: true, listed: true } : { published: false } },
  );

/** The venue picked from a place search (venue, address, town… as one set). */
export function planSetVenue(fields: Record<string, unknown>): Plan {
  const f = fields as { venue?: string; address?: string; location?: string };
  return plan(
    `Venue set to ${f.venue ?? f.address ?? f.location ?? "the venue you picked"}`,
    {},
    { info: { ...fields } },
  );
}

const links = (info: RawInfo | null | undefined) =>
  Object.entries(info?.links && typeof info.links === "object" ? info.links : {}).filter(
    ([, v]) => v && typeof v === "object",
  );

/** A link (or uploaded file) listed last; `name` and `url` as typed. */
export function planAddLink(state: CompetitionState, id: string, name: string, url: string): Plan {
  const order = links(state.info).reduce((max, [, l]) => Math.max(max, l._order ?? -1), -1) + 1;
  return plan(
    "Added a link",
    {},
    { info: { [`links/${id}`]: { name: name.trim() || null, url, _order: order } } },
  );
}
export const planRemoveLink = (id: string, name?: string): Plan =>
  plan(`Removed ${name || "the link"}`, {}, { info: { [`links/${id}`]: null } });
export const planSetLinkName = (id: string, name: string | null): Plan =>
  plan("Link label", {}, { info: { [`links/${id}/name`]: name } });
export const planSetLinkUrl = (id: string, url: string | null): Plan =>
  plan("Link", {}, { info: { [`links/${id}/url`]: url } });

/** An organisation it's run by or part of. */
export const planAddOrganisation = (id: string, name?: string): Plan =>
  plan(`Added ${name}`, {}, { info: { [`organisations/${id}`]: true } });
export const planRemoveOrganisation = (id: string, name?: string): Plan =>
  plan(`Took ${name ?? "it"} off`, {}, { info: { [`organisations/${id}`]: null } });

// --- Hiding the Schedule or Results tab. Hiding deletes what's been entered in it (after asking, and it can
// be undone); showing it again starts from nothing.

export type HideableTab = "schedule" | "results";

export const HIDE_TAB = {
  schedule: { name: "Schedule", deletes: "The schedule built so far is deleted" },
  results: { name: "Results", deletes: "All results entered so far are deleted" },
} as const;

/** Whether something has been entered in the tab (hiding it would delete that). */
export const tabHasContent = (state: CompetitionState, tab: HideableTab) =>
  tab === "schedule"
    ? Object.keys(scheduleOf(state.data)?.days ?? {}).length > 0
    : Object.keys(resultsOf(state.data)).length > 0;

export const planHideTab = (tab: HideableTab, hide: boolean): Plan =>
  plan(hide ? `Hid the ${HIDE_TAB[tab].name} tab` : `Showed the ${HIDE_TAB[tab].name} tab`, {
    [tab]: hide ? false : null,
  });
