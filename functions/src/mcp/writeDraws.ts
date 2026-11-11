import {
  compareNumbers,
  isReel,
  planAddMissingToDraw,
  planClearAllDraws,
  planClearDraw,
  planNumberOrder,
  planRemoveStraysFromDraw,
  planSetDraw,
  planShuffle,
  planShuffleAll,
  storedDraw,
} from '../../../shared/plans';
import { ToolError } from './errors';
import { find, items, list, trim, Work } from './write';

export const DRAW_ACTIONS = ['shuffle', 'numberOrder', 'clear', 'addMissing', 'removeStrays'] as const;

export interface DrawInput {
  ageGroup: string;
  /** A dance (id or name) of that age group, or "all" for every dance it does. Needed for everything but an explicit order. */
  dance: string;
  /** The dancing order, by number, first to dance first. Replaces the draw. */
  order?: Array<string | number>;
  /** Or one of these, worked out as the app does */
  action?: (typeof DRAW_ACTIONS)[number];
}

export interface DrawTarget {
  group: string;
  dance: string;
  groupLabel: string;
  danceLabel: string;
}

/**
 * Draws are worked out by the plans the Draws screen uses. Shuffling keeps reels in number order: the screen's
 * "shuffle all" does, and a reel shuffled alone here is put in number order too (said in a warning).
 */
export function planDraws(work: Work, rows: DrawInput[]): { said: string[]; targets: DrawTarget[] } {
  const said: string[] = [];
  const targets: DrawTarget[] = [];
  const done = new Set<string>();
  for (const r of rows) {
    const group = find(work, 'groups', r.ageGroup, 'age group');
    const numbers = list(work, 'dancers').filter((d) => d.groupId === group.id).map((d) => trim(d.number)).filter(Boolean);
    const danced = list(work, 'dances').filter((d) => (d.groupIds as Record<string, unknown> | undefined)?.[group.id]);
    const all = r.dance.trim().toLowerCase() === 'all';
    if (all && r.order) throw new ToolError(`${group.label}: an explicit order is for one dance, not “all”.`);
    if (!r.order && !r.action) throw new ToolError(`${group.label}: give an order (numbers) or an action (${DRAW_ACTIONS.join(', ')}).`);
    if (r.order && r.action) throw new ToolError(`${group.label}: give an order or an action, not both.`);
    const chosen = all
      ? danced.map((d) => ({ id: d.id, label: items(work, 'dances').find((x) => x.id === d.id)!.label }))
      : [(() => {
        const dance = find(work, 'dances', r.dance, 'dance');
        if (!danced.some((d) => d.id === dance.id)) {
          throw new ToolError(`${group.label} doesn’t dance ${dance.label}. Its dances are ${danced.map((d) => items(work, 'dances').find((x) => x.id === d.id)!.label).join('; ') || 'none yet'}.`);
        }
        return dance;
      })()];
    if (!chosen.length) throw new ToolError(`${group.label} has no dances switched on, so there is nothing to draw.`);
    if (!numbers.length) throw new ToolError(`${group.label} has no entries yet, so there is nothing to draw.`);
    for (const c of chosen) {
      const key = `${group.id}/${c.id}`;
      if (done.has(key)) throw new ToolError(`${group.label}, ${c.label} is in the call twice. Send each draw once.`);
      done.add(key);
      targets.push({ group: group.id, dance: c.id, groupLabel: group.label, danceLabel: c.label });
    }

    if (r.order) {
      const seen = new Set<string>();
      const order = r.order.map((given) => {
        const g = trim(given);
        const hit = numbers.find((n) => n === g) ?? numbers.find((n) => n.toLowerCase() === g.toLowerCase());
        if (!hit) throw new ToolError(`${g} is not an entry in ${group.label}. The numbers there are ${[...numbers].sort(compareNumbers).slice(0, 15).join(', ')}${numbers.length > 15 ? ' …' : ''}.`);
        if (seen.has(hit)) throw new ToolError(`${hit} is in the draw twice.`);
        seen.add(hit);
        return hit;
      });
      work.apply(planSetDraw(work.state, group.id, chosen[0].id, order.length ? order : null, `Set the draw for ${group.label}`));
      const missing = numbers.filter((n) => !seen.has(n));
      if (order.length && missing.length) {
        work.warnings.push(`${group.label}, ${chosen[0].label}: ${missing.length} ${missing.length === 1 ? 'entry is' : 'entries are'} not in the draw yet (${[...missing].sort(compareNumbers).join(', ')}). action addMissing adds them to the end.`);
      }
      said.push(order.length ? `set the draw for ${group.label}, ${chosen[0].label}` : `cleared the draw for ${group.label}, ${chosen[0].label}`);
      continue;
    }

    switch (r.action) {
      case 'shuffle':
        if (all) work.apply(planShuffleAll(work.state, group.id));
        else if (isReel(list(work, 'dances').find((d) => d.id === chosen[0].id) as { name?: string })) {
          work.apply(planNumberOrder(work.state, group.id, chosen[0].id));
          work.warnings.push(`${chosen[0].label} is a reel, and reels are danced in number order, so it was put in number order, not shuffled.`);
        } else work.apply(planShuffle(work.state, group.id, chosen[0].id));
        break;
      case 'clear':
        if (all) work.apply(planClearAllDraws(work.state, group.id));
        else work.apply(planClearDraw(work.state, group.id, chosen[0].id));
        break;
      case 'numberOrder':
        for (const c of chosen) work.apply(planNumberOrder(work.state, group.id, c.id));
        break;
      case 'addMissing':
        for (const c of chosen) work.apply(planAddMissingToDraw(work.state, group.id, c.id));
        break;
      case 'removeStrays':
        for (const c of chosen) work.apply(planRemoveStraysFromDraw(work.state, group.id, c.id));
        break;
    }
    said.push(`${r.action === 'clear' ? 'cleared' : r.action === 'shuffle' ? 'shuffled' : r.action === 'numberOrder' ? 'put in number order' : r.action === 'addMissing' ? 'added missing entries to' : 'took strays out of'} ${all ? `every draw in ${group.label}` : `${group.label}, ${chosen[0].label}`}`);
  }
  return { said, targets };
}

/** The order stored now, for reading back */
export const drawOf = (work: Work, t: DrawTarget) => storedDraw(work.state, t.group, t.dance);
