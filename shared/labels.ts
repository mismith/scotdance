// How Manage names things: the same words in its lists, its confirmations and Undo.
import { entryName, isTeam } from "./entries";
import {
  entriesOf,
  type RawCategory,
  type RawDance,
  type RawData,
  type RawDancer,
  type RawGroup,
  type RawPlatform,
  type RawStaff,
  type RawTrophyEvent,
  type WithId,
} from "./plans/types";

const trim = (v: unknown) => String(v ?? "").trim();

export const dancerFullName = (d: { firstName?: string; lastName?: string }) =>
  `${d.firstName ?? ""} ${d.lastName ?? ""}`.trim();
export const groupFullName = (
  g: { id?: string; name?: string },
  category?: { id?: string; name?: string },
) => `${category?.name ?? ""} ${g.name ?? ""}`.trim();
export const danceFullName = (d: { name?: string | number; steps?: string | number }) => {
  const name = trim(d.name);
  const steps = trim(d.steps);
  return steps ? `${name} (${steps})` : name;
};

export const categoryLabel = (c: RawCategory) => (c.name ?? "").trim() || "Untitled category";
export const groupLabel = (g: RawGroup, category?: RawCategory) =>
  groupFullName(g, category) || "Untitled age group";
export const danceLabel = (d: RawDance) => danceFullName(d) || "Untitled dance";
export const trophyEventLabel = (a: RawTrophyEvent) =>
  (a.name ?? "").trim() || "Untitled trophy event";
export const platformLabel = (p: RawPlatform) => (p.name ?? "").trim() || "Untitled platform";
export const staffLabel = (s: RawStaff) => dancerFullName(s) || "Unnamed";
export const dancerLabel = (d: RawDancer) =>
  isTeam(d) ? entryName(d) : dancerFullName(d) || "Unnamed dancer";

/** Looks things up by id in the stored data, labelled as Manage does. */
export function namer(data: RawData) {
  const categories = new Map(entriesOf(data.categories).map((c) => [c.id, c]));
  const groups = new Map(entriesOf(data.groups).map((g) => [g.id, g]));
  const dances = new Map(entriesOf(data.dances).map((d) => [d.id, d]));
  const trophyEvents = new Map(entriesOf(data.trophyEvents).map((a) => [a.id, a]));
  const dancers = new Map(entriesOf(data.dancers).map((d) => [d.id, d]));
  const group = (id: string): WithId<RawGroup> | undefined => groups.get(id);
  return {
    group,
    dance: (id: string) => dances.get(id),
    trophyEvent: (id: string) => trophyEvents.get(id),
    dancer: (id: string) => dancers.get(id),
    groupLabel: (id: string) => {
      const g = groups.get(id);
      return g ? groupLabel(g, g.categoryId ? categories.get(g.categoryId) : undefined) : undefined;
    },
    danceLabel: (id: string) => {
      const d = dances.get(id);
      return d ? danceLabel(d) : undefined;
    },
    trophyEventLabel: (id: string) => {
      const a = trophyEvents.get(id);
      return a ? trophyEventLabel(a) : undefined;
    },
    categoryOf: (groupId: string) => {
      const g = groups.get(groupId);
      return g?.categoryId ? categories.get(g.categoryId) : undefined;
    },
  };
}
