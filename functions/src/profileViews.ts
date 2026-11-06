import type { Reference } from 'firebase-admin/database';
import { getPostmark } from './utility/email';
import { adminSite, appModel, sendOptions, sentFrom } from './utility/emailModel';

// Profile view counts. Signed in, the app records which dancers' profiles an
// account opened, once each per UTC day (web/src/lib/profileViews.ts):
//
//   dancers:views/{uid}/{day}/{dancerId} = true       kept 60 days
//   dancers:viewFlags/{uid}/{day} = { count, week, at, dismissedBy?, dismissedAt? }
//                                                     an account over FLAG_OVER in a day
//
// The purpose is to catch someone browsing lots of children's profiles in the
// app. (It isn't anti-scraping: results are public.) Each hour this flags any
// account over the line, once a day, and emails the system admin. System
// admin › Review › Profile views lists them to dismiss. At midnight UTC it
// also clears what's older than 60 days.

/**
 * Different dancers' profiles opened in one UTC day before an account is
 * flagged. A first guess: revisit it after two weeks of counts, when System
 * admin › Profile views shows what a busy day looks like.
 */
export const FLAG_OVER = 50;
const KEEP_DAYS = 60;
const DAY = 24 * 60 * 60 * 1000;

type Views = Record<string, Record<string, Record<string, unknown> | null> | null> | null;

/** A UTC day as the keys write it: 2026-11-04. */
export const dayKey = (date: Date) => date.toISOString().slice(0, 10);

/** The 7 UTC days ending with (and including) `now`'s. */
export const lastDays = (now: Date, count = 7) => Array.from({ length: count }, (_, i) => dayKey(new Date(now.getTime() - i * DAY)));

/** Different dancers opened across some days. */
function distinct(days: Record<string, Record<string, unknown> | null> | null | undefined, keys: string[]): number {
  const seen = new Set<string>();
  for (const key of keys) for (const dancerId of Object.keys(days?.[key] ?? {})) seen.add(dancerId);
  return seen.size;
}

export interface Over {
  uid: string;
  /** Dancers opened today. */
  count: number;
  /** Dancers opened over the last 7 days. */
  week: number;
}

/** Accounts that opened more than `over` different dancers' profiles today. */
export function accountsOver(views: Views, now: Date, over = FLAG_OVER): Over[] {
  const today = dayKey(now);
  const week = lastDays(now);
  const found: Over[] = [];
  for (const [uid, days] of Object.entries(views ?? {})) {
    const count = distinct(days, [today]);
    if (count > over) found.push({ uid, count, week: distinct(days, week) });
  }
  return found;
}

const joinedOn = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

interface Account {
  name: string | null;
  email: string | null;
  joined: string | null;
}

async function accountOf(auth: { getUser(uid: string): Promise<{ displayName?: string; email?: string; metadata: { creationTime: string } }> }, uid: string): Promise<Account> {
  try {
    const user = await auth.getUser(uid);
    const created = new Date(user.metadata.creationTime);
    return { name: user.displayName || null, email: user.email ?? null, joined: Number.isNaN(created.getTime()) ? null : joinedOn.format(created) };
  } catch {
    // An account that has since been deleted: the flag stands, and the email says so.
    return { name: null, email: null, joined: null };
  }
}

interface Config {
  db: Reference;
  name?: string;
  description?: string;
  email?: string;
}

/**
 * Flags each account over the line that has no flag for today yet, and emails
 * the system admin once for each. A failed email doesn't undo the flag:
 * System admin shows it either way.
 */
export async function checkProfileViews(config: Config, auth: Parameters<typeof accountOf>[0], now = new Date()) {
  const { db } = config;
  const today = dayKey(now);
  const views = (await db.child('dancers:views').get()).val() as Views;

  for (const { uid, count, week } of accountsOver(views, now)) {
    // A transaction, so two runs at once flag it, and email, once.
    const { committed } = await db.child(`dancers:viewFlags/${uid}/${today}`).transaction((current) => (current ? undefined : { count, week, at: now.getTime() }));
    if (!committed) continue;

    const account = await accountOf(auth, uid);
    const site = adminSite(sentFrom());
    try {
      await getPostmark().sendEmailWithTemplate({
        From: config.email,
        To: config.email,
        ...sendOptions('admin-profile-views'),
        TemplateModel: {
          app: appModel(config, site),
          count,
          week,
          over: FLAG_OVER,
          account: { ...account, uid },
          admin: { link: `${site.url}/admin/views` },
        },
      });
    } catch (err) {
      console.error('admin-profile-views email failed', err);
    }
  }

  // Once a day, as the day begins: nothing older than 60 days is kept.
  if (now.getUTCHours() === 0) await clearOld(db, views, now);
}

/** Views and flags from before the last KEEP_DAYS days. */
async function clearOld(db: Reference, views: Views, now: Date) {
  const cutoff = dayKey(new Date(now.getTime() - KEEP_DAYS * DAY));
  const updates: Record<string, null> = {};
  for (const [uid, days] of Object.entries(views ?? {})) {
    for (const day of Object.keys(days ?? {})) if (day < cutoff) updates[`dancers:views/${uid}/${day}`] = null;
  }
  const flags = ((await db.child('dancers:viewFlags').get()).val() ?? {}) as Record<string, Record<string, unknown>>;
  for (const [uid, days] of Object.entries(flags)) {
    for (const day of Object.keys(days ?? {})) if (day < cutoff) updates[`dancers:viewFlags/${uid}/${day}`] = null;
  }
  if (Object.keys(updates).length) await db.update(updates);
}
