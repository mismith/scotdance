import { Models } from 'postmark';
import { isEmulator } from './env';

// An email follows the app it came from. The v4 app stamps `origin` (its
// location.origin) on what it writes; the v3 apps don't. So no stamp means
// v3: its templates, and its #/ links on scotdance.app. A stamp means v4
// (postmark/, outside v3/), linking back to the site it came from, or, for
// the store apps (capacitor://localhost and the like), to V4_SITE.
const SITES = ['https://scotdance.app', 'https://next.scotdance.app'];
// Where the v4 store apps link: next.scotdance.app until launch, then
// scotdance.app (the v4 release runbook's cutover says when).
export const V4_SITE = 'https://next.scotdance.app';

export interface SentFrom {
  v4: boolean;
  url: string;
  host: string;
  /** Not scotdance.app: the email's footer says where it was sent from. */
  preview: boolean;
}

export function sentFrom(origin?: unknown): SentFrom {
  const v4 = typeof origin === 'string' && origin.length > 0;
  const url = isEmulator() ? 'http://localhost:5273'
    : !v4 ? 'https://scotdance.app'
      : SITES.includes(origin) ? origin : V4_SITE;
  const { host } = new URL(url);
  return { v4, url, host, preview: host !== 'scotdance.app' };
}

/** Emails to admin@ are always v4: the admin tools are only in v4. */
export const adminSite = (from: SentFrom): SentFrom => (from.v4 ? from : sentFrom(V4_SITE));

/**
 * What the templates know about the app, for the site it was sent from.
 * `preview` is that site's host when it isn't scotdance.app, for the footer
 * to name (a string, so the template needn't reach outside its section).
 */
export function appModel(config: { name?: string; description?: string; email?: string }, from: SentFrom) {
  return { name: config.name, description: config.description, email: config.email, url: from.url, host: from.host, preview: from.preview ? from.host : null };
}

// Every email: Postmark's activity filtered by template, and no open pixel or
// rewritten links (an invite's link stays as written).
export const sendOptions = (alias: string) => ({ TemplateAlias: alias, Tag: alias, TrackOpens: false, TrackLinks: Models.LinkTrackingOptions.None });

// What was submitted, in a line or two, so they know which one it's about:
// the date as "Friday 28 August 2026" (in English, a weekday too, so it can't
// be misread anywhere), and where. The v4 emails draw the date as the app's
// tile: "Aug", "28", "2026".
const longDate = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const tileParts = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
export function summary(competition: any = {}) {
  const { date, venue, location } = competition;
  const parsed = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date) ? new Date(`${date.slice(0, 10)}T00:00:00Z`) : null;
  const day = parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
  const part = (type: string) => tileParts.formatToParts(day).find((p) => p.type === type)?.value;
  return {
    date: day ? longDate.formatToParts(day).filter((p) => p.type !== 'literal').map((p) => p.value).join(' ') : null,
    where: [venue, location].filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim()).join(', ') || null,
    tile: day ? { month: part('month'), day: part('day'), year: part('year') } : null,
  };
}

/** Someone's first name, to sign or introduce an email with, or null. */
export async function firstName(db: any, uid?: string | null): Promise<string | null> {
  if (!uid) return null;
  const displayName = (await db.child(`users/${uid}/displayName`).get()).val();
  return typeof displayName === 'string' ? displayName.trim().split(/\s+/)[0] || null : null;
}

/** An organisation's letters when it has no logo, as the app draws them (types/organisation.ts). */
export function organisationMark(o: { name?: string; shortName?: string | null } = {}): string {
  const short = o.shortName?.trim();
  if (short && short.length <= 4) return short.toUpperCase();
  const words = (o.name ?? '').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w && !/^(of|the|and|for|de|du|la)$/i.test(w));
  return (words.slice(0, 3).map((w) => w[0]).join('') || '?').toUpperCase();
}
