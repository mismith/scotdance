import {
  isEligible,
  ordered,
  planScheduleEdit,
  replaceDay,
  type DaySpec,
  type RawSchedule,
  type RowSpec,
  type SessionSpec,
} from '../../../shared/plans';
import { ToolError } from './errors';
import { items, list, realDate, trim, Work } from './write';
import { pick, fold } from './view';

/** An age group, trophy event, judge or gap as get_schedule shows it (an id, a name, or `{ id, name }`), or "gap" */
export type CellRef = string | { id?: string; name?: string | null; gap?: boolean };

export interface PlatformInput {
  /** The platform's id or name */
  id?: string;
  platform?: string;
  ageGroups?: CellRef[];
  judges?: CellRef[];
}
export interface RowInput {
  id?: string;
  /** A dance's id (as get_schedule gives it), or its name */
  danceId?: string;
  dance?: string;
  /** A row that is not a dance (Registration, March Past) has just a name */
  name?: string;
  description?: string;
  platforms?: PlatformInput[];
}
export interface EventInput { id?: string; name: string; description?: string; dances?: RowInput[] }
export interface SessionInput { id?: string; name: string; description?: string; events?: EventInput[] }
export interface DayInput { id?: string; name?: string; date?: string; description?: string; sessions?: SessionInput[] }

export interface ScheduleTarget { day: string; label: string }

const isGapId = (id: string) => /^\d+$/.test(id);

class Ids {
  private readonly seen = new Set<string>();
  private n = 0;
  claim(id: string, what: string) {
    if (this.seen.has(id)) throw new ToolError(`The ${what} id ${id} is used twice in this call. Each session, event and row has its own id.`);
    this.seen.add(id);
  }
  gap(): string {
    return String(Date.now() + this.n++);
  }
}

/**
 * Put whole days on the schedule from a declarative description (what get_schedule shows). Each day given is
 * rebuilt exactly as described by the shared schedule plans; days not mentioned are left alone.
 */
export function planSchedule(work: Work, days: DayInput[], competitionDate?: unknown): { said: string[]; targets: ScheduleTarget[] } {
  if (work.state.data.schedule === false) {
    throw new ToolError('The Schedule tab is hidden for this competition, so there is no schedule to build. set_visibility can show it (schedule: "show") first.');
  }
  const groups = items(work, 'groups');
  const trophyEvents = list(work, 'trophyEvents').filter((t) => !!t.danceId).map((t) => ({ id: t.id, label: trim(t.name) }));
  const cellGroups = [...groups, ...trophyEvents];
  const judges = list(work, 'staff').filter((s) => s.type === 'Judge').map((s) => ({ id: s.id, label: `${trim(s.firstName)} ${trim(s.lastName)}`.trim() || 'Unnamed' }));
  const dances = items(work, 'dances');
  const platforms = items(work, 'platforms');
  const state = () => work.state;
  const ids = new Ids();
  const said: string[] = [];
  const targets: ScheduleTarget[] = [];
  const claimedDays = new Set<string>();

  const platformFor = (given: string) => {
    const g = given.trim();
    const bare = g.replace(/^platform\s+/i, '');
    return pick(platforms, platforms.some((p) => p.id === g || fold(p.label) === fold(g)) ? g : bare, (p) => p.label, 'platform');
  };

  const cellList = (kind: 'age group' | 'judge', given: CellRef[] | undefined, danceId: string | undefined, danceLabel: string, where: string): string[] => {
    const out: string[] = [];
    for (const item of given ?? []) {
      let id: string;
      const asString = typeof item === 'string' ? item.trim() : '';
      if (typeof item === 'object' && item.gap) id = item.id && isGapId(item.id) ? item.id : ids.gap();
      else if (asString && /^(gap|spacer)$/i.test(asString)) id = ids.gap();
      else {
        const wanted = typeof item === 'string' ? item : (item.id ?? item.name ?? '');
        if (!trim(wanted)) throw new ToolError(`${where}: an empty ${kind}.`);
        const direct = (kind === 'judge' ? judges : cellGroups).find((x) => x.id === trim(wanted));
        if (direct) id = direct.id;
        else if (typeof item === 'object' && item.id) {
          throw new ToolError(`${where}: there is no ${kind} with the id ${item.id}. get_${kind === 'judge' ? 'staff' : 'dances'} lists them.`);
        } else id = pick(kind === 'judge' ? judges : cellGroups, wanted, (x) => x.label, kind).id;
        if (kind === 'age group') {
          if (!isEligible(state().data, danceId, id)) {
            const who = cellGroups.find((x) => x.id === id)!.label;
            const trophy = trophyEvents.some((t) => t.id === id);
            throw new ToolError(
              trophy
                ? `${where}: ${who} is a trophy event danced as its own dance, so it only goes with that dance, not ${danceLabel}.`
                : `${where}: ${who} doesn’t dance ${danceLabel}. Switch it on for that age group first (save_dances), or leave it out of this cell.`,
            );
          }
        } else if (!judges.some((j) => j.id === id)) {
          throw new ToolError(`${where}: that is not a judge.`);
        }
      }
      if (!isGapId(id) && out.includes(id)) {
        throw new ToolError(`${where}: ${cellGroups.concat(judges).find((x) => x.id === id)?.label ?? id} is in this cell twice.`);
      }
      out.push(id);
    }
    return out;
  };

  for (const [i, d] of days.entries()) {
    const dayWord = `day ${i + 1}`;
    if (d.date !== undefined && d.date !== '' && !realDate(d.date, false)) throw new ToolError(`“${d.date}” is not a date. Use YYYY-MM-DD, like 2026-11-14.`);
    const before = work.state.data.schedule && typeof work.state.data.schedule === 'object' ? (work.state.data.schedule as RawSchedule) : {};
    const existingDays = ordered(before.days);

    // Which day this is: the id, else the same date, else the same name; else a new one
    let dayId: string | null = null;
    if (d.id) {
      if (!existingDays.some(([id]) => id === d.id)) throw new ToolError(`There is no day with the id ${d.id}. get_schedule lists them; leave the id out to add a day.`);
      dayId = d.id;
    } else {
      const byDate = d.date ? existingDays.filter(([, x]) => String(x.date ?? '').slice(0, 10) === d.date) : [];
      const byName = d.name ? existingDays.filter(([, x]) => fold(String(x.name ?? '')) === fold(d.name!)) : [];
      const found = byDate.length === 1 ? byDate : byName.length === 1 ? byName : [];
      if (found.length) dayId = found[0][0];
    }
    if (dayId) {
      if (claimedDays.has(dayId)) throw new ToolError(`${dayWord} is the same day as an earlier one in this call. Send each day once.`);
      claimedDays.add(dayId);
    }
    const old = dayId && before.days?.[dayId] ? structuredClone(before.days[dayId]) : undefined;
    const label = d.name ?? (old?.name as string | undefined) ?? d.date ?? dayWord;

    const sessions: SessionSpec[] | undefined = d.sessions?.map((s, si) => {
      const sPlace = `${label}, session ${si + 1}`;
      if (!trim(s.name)) throw new ToolError(`${sPlace} needs a name (like “Morning”).`);
      if (s.id) {
        if (!old?.blocks?.[s.id]) throw new ToolError(`${sPlace}: there is no session with the id ${s.id} in ${label}. Leave the id out to add one.`);
        ids.claim(s.id, 'session');
      }
      const oldSession = s.id ? old?.blocks?.[s.id] : undefined;
      return {
        id: s.id,
        name: s.name,
        description: s.description,
        events: (s.events ?? []).map((e, ei) => {
          const ePlace = `${s.name}, event ${ei + 1}`;
          if (!trim(e.name)) throw new ToolError(`${ePlace} needs a name.`);
          if (e.id) {
            if (!oldSession?.events?.[e.id]) throw new ToolError(`${ePlace}: there is no event with the id ${e.id} in ${s.name}. Leave the id out to add one.`);
            ids.claim(e.id, 'event');
          }
          const oldEvent = e.id ? oldSession?.events?.[e.id] : undefined;
          return {
            id: e.id,
            name: e.name,
            description: e.description,
            rows: (e.dances ?? []).map((r, ri): RowSpec => {
              const rPlace = `${e.name}, row ${ri + 1}`;
              if (r.id) {
                if (!oldEvent?.dances?.[r.id]) throw new ToolError(`${rPlace}: there is no row with the id ${r.id} in ${e.name}. Leave the id out to add one.`);
                ids.claim(r.id, 'row');
              }
              const wantsDance = r.danceId ?? r.dance;
              let danceId: string | undefined;
              let danceLabel = '';
              if (wantsDance) {
                const dance = dances.find((x) => x.id === trim(wantsDance)) ?? pick(dances, wantsDance, (x) => x.label, 'dance');
                danceId = dance.id;
                danceLabel = dance.label;
              } else if (!trim(r.name)) {
                throw new ToolError(`${rPlace} needs a dance (danceId) or, for a line that isn’t a dance like Registration, a name.`);
              }
              const place = `${e.name}, ${danceLabel || r.name}`;
              if (!danceId && r.platforms?.some((p) => p.ageGroups?.length || p.judges?.length)) {
                throw new ToolError(`${place}: only a dance has platforms with age groups and judges. Make it a dance, or take the platforms off.`);
              }
              const cells: RowSpec['cells'] = {};
              for (const p of r.platforms ?? []) {
                const given = p.platform ?? p.id;
                if (!given) throw new ToolError(`${place}: a platform needs its id or name.`);
                const platform = platformFor(given);
                if (cells[platform.id]) throw new ToolError(`${place}: platform ${platform.label} is listed twice.`);
                cells[platform.id] = {
                  groupIds: cellList('age group', p.ageGroups, danceId, danceLabel, `${place} on ${platform.label}`),
                  judgeIds: cellList('judge', p.judges, danceId, danceLabel, `${place} on ${platform.label}`),
                };
              }
              return { id: r.id, danceId, name: danceId ? undefined : trim(r.name), description: r.description, cells };
            }),
          };
        }),
      };
    });

    const spec: DaySpec = { name: d.name, date: d.date, description: d.description, sessions };
    const dayAfter: { id: string } = { id: '' };
    work.apply(planScheduleEdit(work.state, `Saved ${label}`, (s) => {
      dayAfter.id = replaceDay(s, { newId: work.newId, competitionDate }, dayId, spec);
    }));
    const counted = sessions ?? [];
    const events = counted.reduce((n, s) => n + s.events.length, 0);
    const rows = counted.reduce((n, s) => n + s.events.reduce((m, e) => m + e.rows.length, 0), 0);
    const removed = old && sessions ? ordered(old.blocks).filter(([id]) => !sessions.some((s) => s.id === id)).length : 0;
    if (removed) work.warnings.push(`${label}: ${removed} ${removed === 1 ? 'session' : 'sessions'} that ${removed === 1 ? 'was' : 'were'} there before and not in this call ${removed === 1 ? 'was' : 'were'} removed (with their events and dances). undo_change brings them back.`);
    if (!old) work.made('day', dayAfter.id, label);
    said.push(`${dayId ? 'saved' : 'added'} ${label}${sessions ? ` (${sessions.length} ${sessions.length === 1 ? 'session' : 'sessions'}, ${events} ${events === 1 ? 'event' : 'events'}, ${rows} ${rows === 1 ? 'row' : 'rows'})` : ''}`);
    targets.push({ day: dayAfter.id, label });
  }
  return { said, targets };
}
