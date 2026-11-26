// Date and time helpers. Dates are 'YYYY-MM-DD' strings; clock times are
// minutes from midnight. All date math is done in UTC so it never depends on
// the computer's own time zone.

const DAY_MS = 86_400_000;

export function isDate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const t = Date.parse(s + 'T00:00:00Z');
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === s;
}

function toMs(date: string): number {
  return Date.parse(date + 'T00:00:00Z');
}

function fromMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: string, n: number): string {
  return fromMs(toMs(date) + n * DAY_MS);
}

/** Whole days from a to b (positive when b is later). */
export function diffDays(a: string, b: string): number {
  return Math.round((toMs(b) - toMs(a)) / DAY_MS);
}

/** 1 = Monday ... 7 = Sunday. */
export function weekday(date: string): number {
  const d = new Date(toMs(date)).getUTCDay();
  return d === 0 ? 7 : d;
}

/** The Monday of the week that contains the date. Weeks run Monday to Sunday. */
export function monday(date: string): string {
  return addDays(date, 1 - weekday(date));
}

export function firstOfMonth(date: string): string {
  return date.slice(0, 8) + '01';
}

export function lastOfMonth(date: string): string {
  const [y, m] = date.split('-').map(Number);
  return fromMs(Date.UTC(y, m, 0));
}

/** All dates from a to b inclusive. */
export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** The calendar date in a time zone at a given instant. */
export function dateInZone(ms: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(ms));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Minutes from midnight in a time zone at a given instant. */
export function minutesInZone(ms: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(ms));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return get('hour') * 60 + get('minute');
}

/** 540 -> '9:00 AM', 810 -> '1:30 PM'. */
export function formatClock(min: number): string {
  const h24 = Math.floor(min / 60) % 24;
  const m = min % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
}

/** 45 -> '45 min', 60 -> '1 h', 90 -> '1 h 30 min'. */
export function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
  'October', 'November', 'December'];

export function weekdayName(date: string, short = false): string {
  const n = WEEKDAYS[weekday(date) - 1];
  return short ? n.slice(0, 3) : n;
}

/** '2026-12-21' -> 'Monday, December 21'. */
export function formatLongDate(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  return `${weekdayName(date)}, ${MONTHS[m - 1]} ${d}`;
}

/** '2026-12-21' -> 'Dec 21'. */
export function formatShortDate(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  return `${MONTHS[m - 1].slice(0, 3)} ${d}`;
}

export function monthName(date: string): string {
  const [y, m] = date.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}
