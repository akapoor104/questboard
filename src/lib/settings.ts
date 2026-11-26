// Small pure helpers for the parent's Settings screen.
import type { DeviceRow, ExportDoc, Settings, SettingsPatch } from '../api/types.ts';
import { dateInZone, formatLongDate } from './dates.ts';

/** What the code field keeps: upper case letters and digits only, at most six. */
export function cleanPairCode(text: string): string {
  return text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

/** Exactly four digits. */
export function validPin(pin: string): boolean {
  return /^[0-9]{4}$/.test(pin);
}

/** something@something.something, with no spaces. */
export function validEmail(text: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
}

/** The line under a linked device's name. */
export function deviceStatus(device: DeviceRow): string {
  if (device.kind === 'display') return 'Display only, no PIN, cannot change anything';
  return device.unlocked ? 'His board, unlocked now' : 'His board, locked';
}

/** The name a device is listed under. */
export function deviceName(device: DeviceRow): string {
  const label = device.label?.trim();
  if (label) return label;
  return device.kind === 'display' ? 'Display' : 'His device';
}

/** '2026-12-21' -> 'questboard-backup-2026-12-21.json'. */
export function backupFileName(today: string): string {
  return `questboard-backup-${today}.json`;
}

/** Reads a backup file. Throws Error('not a Questboard backup') unless it looks like one. */
export function parseBackup(text: string): ExportDoc {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    throw new Error('not a Questboard backup');
  }
  if (
    typeof doc !== 'object' || doc === null || Array.isArray(doc)
    || (doc as { version?: unknown }).version !== 1
  ) throw new Error('not a Questboard backup');
  const tables = (doc as { tables?: unknown }).tables;
  if (typeof tables !== 'object' || tables === null || Array.isArray(tables)) {
    throw new Error('not a Questboard backup');
  }
  return doc as ExportDoc;
}

function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** '42 cards, 95 library ideas, exported Monday, December 21'. */
export function backupSummary(doc: ExportDoc, timeZone: string): string {
  const cards = doc.tables.cards?.length ?? 0;
  const ideas = doc.tables.library_items?.length ?? 0;
  const parts = [count(cards, 'card', 'cards'), count(ideas, 'library idea', 'library ideas')];
  const ms = doc.exported_at ? Date.parse(doc.exported_at) : NaN;
  if (!Number.isNaN(ms)) parts.push(`exported ${formatLongDate(dateInZone(ms, timeZone))}`);
  return parts.join(', ');
}

/** The time zones offered in the Family panel. */
export const TIME_ZONES: readonly { id: string; name: string }[] = [
  { id: 'America/New_York', name: 'Eastern' },
  { id: 'America/Chicago', name: 'Central' },
  { id: 'America/Denver', name: 'Mountain' },
  { id: 'America/Los_Angeles', name: 'Pacific' },
  { id: 'America/Anchorage', name: 'Alaska' },
  { id: 'Pacific/Honolulu', name: 'Hawaii' },
];

/** TIME_ZONES, plus the current value at the end when it is not one of them. */
export function timeZoneOptions(current: string): { id: string; name: string }[] {
  const list = [...TIME_ZONES];
  if (current && !list.some((z) => z.id === current)) list.push({ id: current, name: current });
  return list;
}

/** 540 -> '09:00' (the value of an <input type="time">). 1440 -> '24:00' is shown as '23:59'. */
export function minutesToTime(min: number): string {
  const m = Math.min(Math.max(0, Math.round(min)), 1439);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** '09:30' -> 570; null when it is not a time. */
export function timeToMinutes(text: string): number | null {
  const m = /^([01][0-9]|2[0-3]):([0-5][0-9])$/.exec(text);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** 90 -> '1.5'; 600 -> '10'. Whole and half hours as typed in a number field. */
export function minutesToHours(min: number): string {
  return String(Math.round((min / 60) * 2) / 2);
}

/** '1.5' -> 90; null unless it is a number of whole or half hours, 0 or more. */
export function hoursToMinutes(text: string): number | null {
  const t = text.trim();
  if (!/^[0-9]+(\.[0-9]+)?$/.test(t)) return null;
  const half = Number(t) * 2;
  return Number.isInteger(half) ? half * 30 : null;
}

/** What the Family panel's fields hold, as typed. */
export interface FamilyForm {
  family_name: string;
  timezone: string;
  day_start: string;
  day_end: string;
  unlock_hours: string;
  tray_alert: string;
  weekly_hours: string;
}

/** The form filled in from the server's settings. */
export function familyForm(s: Settings): FamilyForm {
  return {
    family_name: s.family_name,
    timezone: s.timezone,
    day_start: minutesToTime(s.day_start_min),
    day_end: minutesToTime(s.day_end_min),
    unlock_hours: minutesToHours(s.unlock_minutes ?? 0),
    tray_alert: String(s.catchup_alert_threshold ?? ''),
    weekly_hours: minutesToHours(s.structured_weekly_max_min ?? 0),
  };
}

/**
 * Checks the form and returns only the fields that changed, or the sentence to show when
 * something is not right.
 */
export function familyPatch(s: Settings, f: FamilyForm): { patch: SettingsPatch } | { problem: string } {
  const name = f.family_name.trim();
  if (name === '' || name.length > 60) return { problem: 'Give the family a name (up to 60 letters).' };
  const start = timeToMinutes(f.day_start);
  const end = timeToMinutes(f.day_end);
  if (start === null || end === null) return { problem: 'Pick a time for the start and the end of the day.' };
  if (start >= end) return { problem: 'The day has to start before it ends.' };
  const unlock = hoursToMinutes(f.unlock_hours);
  if (unlock === null || unlock < 30) return { problem: 'Unlock lasts at least half an hour (0.5).' };
  const tray = f.tray_alert.trim();
  if (!/^[0-9]+$/.test(tray) || Number(tray) < 1 || Number(tray) > 99) {
    return { problem: 'The tray alert is a number of cards from 1 to 99.' };
  }
  const weekly = hoursToMinutes(f.weekly_hours);
  if (weekly === null || weekly > 6000) return { problem: 'The weekly guide is a number of hours, in whole or half hours.' };

  const patch: SettingsPatch = {};
  if (name !== s.family_name) patch.family_name = name;
  if (f.timezone !== s.timezone) patch.timezone = f.timezone;
  // Compared as shown: a day that ends at midnight (1440) is shown as 23:59 and is not a change.
  if (f.day_start !== minutesToTime(s.day_start_min)) patch.day_start_min = start;
  if (f.day_end !== minutesToTime(s.day_end_min)) patch.day_end_min = end;
  if (unlock !== s.unlock_minutes) patch.unlock_minutes = unlock;
  if (Number(tray) !== s.catchup_alert_threshold) patch.catchup_alert_threshold = Number(tray);
  if (weekly !== s.structured_weekly_max_min) patch.structured_weekly_max_min = weekly;
  return { patch };
}

/** '1 Google account allowed', '2 Google accounts allowed'. */
export function parentsLine(n: number): string {
  return `${n} Google ${n === 1 ? 'account' : 'accounts'} allowed`;
}
