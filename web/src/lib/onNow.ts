import { blocks, dances as eventDances, events } from '@/lib/schedule'
import type { ScheduleDay } from '@/types/competition'

// On now (ADR 0020): a pink line on the age group that people at the
// competition say is dancing on a platform, from their answers to "Is it on
// now?" (functions/src/onNow.ts keeps the line). This works out where the line
// sits in a platform's running order, whether it's still believable, and which
// group to ask about next.

/** How long a line stands after its last Yes (as functions/src/onNow.ts counts answers). */
export const FRESH_MS = 15 * 60 * 1000

/** One age group (or a danced trophy event) in one dance on one platform. */
export interface Turn {
  /** "{dayId}/{blockId}/{eventId}/{scheduleDanceId}/{groupId}", as answers name it. */
  key: string
  eventId: string
  scheduleDanceId: string
  danceId: string | null
  /** The age group's or trophy event's id. */
  id: string
}

export interface Line {
  turn: string
  at: number
}

export const turnKey = (dayId: string, blockId: string, eventId: string, scheduleDanceId: string, id: string) =>
  [dayId, blockId, eventId, scheduleDanceId, id].join('/')

/**
 * A platform's running order for the day, across every session, event and
 * dance. `known`: the ids that are real turns (age groups and danced trophy
 * events; not spacers or deleted groups).
 */
export function platformTurns(day: ScheduleDay, platformId: string, known: (id: string) => boolean): Turn[] {
  const turns: Turn[] = []
  for (const block of blocks(day)) {
    for (const event of events(block)) {
      for (const sd of eventDances(event)) {
        for (const id of sd.platforms?.[platformId]?.orderedGroupIds ?? []) {
          if (!known(id)) continue
          turns.push({
            key: turnKey(day.id, block.id, event.id, sd.id, id),
            eventId: event.id,
            scheduleDanceId: sd.id,
            danceId: sd.danceId ?? null,
            id,
          })
        }
      }
    }
  }
  return turns
}

/**
 * Where the line goes (an index into `turns`), or null: no line, it's gone
 * stale, or results are in for its group or one after it, so things have
 * moved on.
 */
export function lineIndex(line: Line | null | undefined, turns: Turn[], posted: (t: Turn) => boolean, now: number): number | null {
  if (!line || now - line.at > FRESH_MS) return null
  const i = turns.findIndex((t) => t.key === line.turn)
  if (i < 0 || turns.slice(i).some(posted)) return null
  return i
}

/**
 * The group to ask about: the one after the line, or with no line, the first
 * after the last with results in. Null when the day's done.
 */
export function askIndex(line: number | null, turns: Turn[], posted: (t: Turn) => boolean): number | null {
  let i = line != null ? line + 1 : 0
  if (line == null) {
    for (let j = turns.length - 1; j >= 0; j--) {
      if (posted(turns[j])) {
        i = j + 1
        break
      }
    }
  }
  return i < turns.length ? i : null
}

// Each question is asked once on this device, so opening the page again doesn't nag.
const ASKED_KEY = 'onNow:asked'
const ASKED_MAX = 200

function readAsked(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(ASKED_KEY) ?? '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

export function wasAsked(competitionId: string, platformId: string, turn: string) {
  return readAsked().includes(`${competitionId}|${platformId}|${turn}`)
}

export function markAsked(competitionId: string, platformId: string, turn: string) {
  const id = `${competitionId}|${platformId}|${turn}`
  try {
    localStorage.setItem(ASKED_KEY, JSON.stringify([...readAsked().filter((x) => x !== id), id].slice(-ASKED_MAX)))
  } catch {
    // Private browsing: it may ask again, which is fine.
  }
}
