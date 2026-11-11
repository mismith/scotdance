// Dates as the app stores them (YYYY-MM-DD, or a millisecond timestamp), in the host's time zone.

/** The same reading as web's lib/format parseDate: `YYYY-MM-DD` as a local date, timestamps as ms. */
export function parseDate(value: number | string | Date): Date {
  if (value instanceof Date) return value;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    // No rolling '2019-13-45' over into 2020: it isn't a date.
    return date.getMonth() === m - 1 && date.getDate() === d ? date : new Date(NaN);
  }
  if (typeof value === "string" && /^\d{10,}$/.test(value)) return new Date(Number(value));
  return new Date(value);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** A stored date as YYYY-MM-DD (what date fields take), or '' if it isn't one. */
export function isoDate(value: unknown): string {
  if (value == null || value === "") return "";
  const d = parseDate(value as string | number | Date);
  return Number.isNaN(d.getTime())
    ? ""
    : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** A day's stored name: everyone (and the old app) sees it, so English, not the organiser's phone language. */
export const weekdayName = (iso: string) =>
  parseDate(iso).toLocaleDateString("en", { weekday: "long" });

/** The weekday in the host's language (what the app shows). */
export const localWeekday = (value: unknown) => {
  const d = value == null || value === "" ? null : parseDate(value as string | number | Date);
  return d && !Number.isNaN(d.getTime())
    ? new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(d)
    : "";
};

export function shiftDate(iso: string, days: number) {
  const d = parseDate(iso);
  d.setDate(d.getDate() + days);
  return isoDate(d);
}
