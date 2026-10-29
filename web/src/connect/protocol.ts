// How an organiser's other ScotDance tools (Splits first) hand work to
// ScotDance.app (ADR 0015). The tool loads /embed.js from ScotDance.app and
// calls ScotDance.send(item); that opens /connect.html in a full-window
// iframe, which signs in, asks which competition, and drops the item into
// the organiser's inbox for Import dancers. They talk with postMessage:
//
//   connect → tool   hello                      (loaded: send me the item)
//   tool → connect   send { item }
//   connect → tool   ready { scheme }           (showing; match its colour scheme)
//   connect → tool   sent { competitionId, competitionName, url }
//   connect → tool   closed                     (gone: take the iframe away)
//
// public/embed.js speaks the same messages; keep the two in step.

/** Every message carries this, so others on the same window are ignored. */
export const CHANNEL = 'scotdance:connect'

export interface ToolItem {
  kind: 'dancers'
  /** The tool, as Import dancers names it ("From Splits"). */
  source: string
  /** File name. */
  name: string
  /** CSV, read like any pasted or chosen list. */
  text: string
}

/** What the database rules accept: 1 MB of text, and short labels. */
const MAX_TEXT = 1_000_000
const MAX_LABEL = 200

/** Sites allowed to embed this page and hand it work: ScotDance.app's own, and local ones while developing. */
export function isAllowedOrigin(origin: string, { dev = false } = {}): boolean {
  let url: URL
  try {
    url = new URL(origin)
  } catch {
    return false
  }
  if (url.origin !== origin) return false
  if (url.protocol === 'https:' && (url.hostname === 'scotdance.app' || url.hostname.endsWith('.scotdance.app'))) return true
  return dev && url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
}

/** The item from a tool's `send`, or null when it isn't one we take. */
export function readItem(value: unknown): ToolItem | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  const label = (s: unknown) => typeof s === 'string' && s.trim().length > 0 && s.length <= MAX_LABEL
  if (v.kind !== 'dancers' || !label(v.source) || !label(v.name)) return null
  if (typeof v.text !== 'string' || !v.text.trim() || v.text.length > MAX_TEXT) return null
  return { kind: 'dancers', source: (v.source as string).trim(), name: (v.name as string).trim(), text: v.text }
}

export type FromTool = { channel: typeof CHANNEL; type: 'send'; item: unknown }

export type ToTool =
  | { type: 'hello' }
  | { type: 'ready'; scheme: 'light' | 'dark' }
  | { type: 'sent'; competitionId: string; competitionName: string; url: string }
  | { type: 'closed' }

export function isFromTool(data: unknown): data is FromTool {
  return !!data && typeof data === 'object' && (data as FromTool).channel === CHANNEL && (data as FromTool).type === 'send'
}
