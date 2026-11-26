import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { DeviceRow, Settings } from '../../src/api/types.ts';
import {
  backupFileName, backupSummary, cleanPairCode, deviceName, deviceStatus, familyForm, familyPatch, hoursToMinutes,
  minutesToHours, minutesToTime, parentsLine, parseBackup, TIME_ZONES, timeToMinutes, timeZoneOptions, validEmail,
  validPin,
} from '../../src/lib/settings.ts';

const device = (o: Partial<DeviceRow>): DeviceRow => ({
  user_id: 'u1', label: 'This browser', kind: 'kid', status: 'approved', child_id: 'k', approved_at: null,
  created_at: '', unlocked: false, ...o,
});

const SETTINGS: Settings = {
  family_name: 'Demo family', timezone: 'America/Los_Angeles', day_start_min: 480, day_end_min: 1260, children: [],
  parent_emails: ['parent@demo.local'], unlock_minutes: 120, catchup_alert_threshold: 3,
  structured_weekly_max_min: 600, automation_token_set: false, parents: [],
};

test('cleanPairCode keeps upper-case letters and digits, at most six', () => {
  assert.equal(cleanPairCode('k7m-2qx'), 'K7M2QX');
  assert.equal(cleanPairCode(' a b c 1 2 3 4 5'), 'ABC123');
  assert.equal(cleanPairCode('é!?'), '');
  assert.equal(cleanPairCode(''), '');
});

test('validPin is exactly four digits', () => {
  assert.equal(validPin('4321'), true);
  assert.equal(validPin('0000'), true);
  assert.equal(validPin('123'), false);
  assert.equal(validPin('12345'), false);
  assert.equal(validPin('12a4'), false);
  assert.equal(validPin(' 1234'), false);
});

test('validEmail wants something@something.something with no spaces', () => {
  assert.equal(validEmail('grandma@example.com'), true);
  assert.equal(validEmail('a.b@mail.co.uk'), true);
  assert.equal(validEmail('grandma@example'), false);
  assert.equal(validEmail('grandma example.com'), false);
  assert.equal(validEmail('a b@example.com'), false);
  assert.equal(validEmail('@example.com'), false);
  assert.equal(validEmail(''), false);
});

test('deviceStatus gives the three sentences', () => {
  assert.equal(deviceStatus(device({ unlocked: true })), 'His board, unlocked now');
  assert.equal(deviceStatus(device({ unlocked: false })), 'His board, locked');
  assert.equal(deviceStatus(device({ kind: 'display' })), 'Display only, no PIN, cannot change anything');
});

test('deviceName falls back when there is no label', () => {
  assert.equal(deviceName(device({ label: 'Kitchen screen' })), 'Kitchen screen');
  assert.equal(deviceName(device({ label: null })), 'His device');
  assert.equal(deviceName(device({ label: '  ', kind: 'display' })), 'Display');
});

test('backupFileName', () => {
  assert.equal(backupFileName('2026-12-21'), 'questboard-backup-2026-12-21.json');
});

test('parseBackup accepts version 1 with tables, refuses the rest', () => {
  const doc = parseBackup('{"version":1,"exported_at":"2026-12-21T18:06:00Z","tables":{"cards":[]}}');
  assert.equal(doc.version, 1);
  assert.deepEqual(doc.tables.cards, []);
  for (const bad of ['{"hello":1}', 'not json', '[]', 'null', '{"version":2,"tables":{}}', '{"version":1}',
    '{"version":1,"tables":[]}', '{"version":"1","tables":{}}']) {
    assert.throws(() => parseBackup(bad), { message: 'not a Questboard backup' }, bad);
  }
});

test('backupSummary counts cards and ideas and names the day in the family zone', () => {
  const doc = parseBackup(JSON.stringify({
    version: 1, exported_at: '2026-12-22T05:00:00Z', tables: { cards: [{}, {}], library_items: [{}] },
  }));
  assert.equal(backupSummary(doc, 'America/Los_Angeles'), '2 cards, 1 library idea, exported Monday, December 21');
  assert.equal(backupSummary(parseBackup('{"version":1,"tables":{"cards":[{}]}}'), 'UTC'), '1 card, 0 library ideas');
});

test('time zones: the six US zones, plus the current one when it is elsewhere', () => {
  assert.equal(TIME_ZONES.length, 6);
  assert.deepEqual(timeZoneOptions('America/Chicago').map((z) => z.id), TIME_ZONES.map((z) => z.id));
  const more = timeZoneOptions('Europe/Berlin');
  assert.equal(more.length, 7);
  assert.deepEqual(more[6], { id: 'Europe/Berlin', name: 'Europe/Berlin' });
});

test('minutes and time inputs', () => {
  assert.equal(minutesToTime(480), '08:00');
  assert.equal(minutesToTime(1290), '21:30');
  assert.equal(minutesToTime(1440), '23:59');
  assert.equal(minutesToTime(0), '00:00');
  assert.equal(timeToMinutes('08:00'), 480);
  assert.equal(timeToMinutes('21:30'), 1290);
  assert.equal(timeToMinutes(''), null);
  assert.equal(timeToMinutes('25:00'), null);
});

test('minutes and hour fields, half hours allowed', () => {
  assert.equal(minutesToHours(120), '2');
  assert.equal(minutesToHours(90), '1.5');
  assert.equal(minutesToHours(580), '9.5');
  assert.equal(hoursToMinutes('2'), 120);
  assert.equal(hoursToMinutes('1.5'), 90);
  assert.equal(hoursToMinutes(' 10 '), 600);
  assert.equal(hoursToMinutes('0'), 0);
  assert.equal(hoursToMinutes('1.25'), null);
  assert.equal(hoursToMinutes('-1'), null);
  assert.equal(hoursToMinutes(''), null);
  assert.equal(hoursToMinutes('two'), null);
});

test('familyPatch sends only what changed', () => {
  const form = familyForm(SETTINGS);
  assert.deepEqual(form, {
    family_name: 'Demo family', timezone: 'America/Los_Angeles', day_start: '08:00', day_end: '21:00',
    unlock_hours: '2', tray_alert: '3', weekly_hours: '10',
  });
  assert.deepEqual(familyPatch(SETTINGS, form), { patch: {} });
  assert.deepEqual(familyPatch(SETTINGS, { ...form, tray_alert: '1' }), { patch: { catchup_alert_threshold: 1 } });
  assert.deepEqual(
    familyPatch(SETTINGS, { ...form, family_name: ' Kapoors ', day_start: '07:30', unlock_hours: '1.5', weekly_hours: '8.5' }),
    { patch: { family_name: 'Kapoors', day_start_min: 450, unlock_minutes: 90, structured_weekly_max_min: 510 } },
  );
  assert.deepEqual(familyPatch(SETTINGS, { ...form, timezone: 'America/Chicago' }), { patch: { timezone: 'America/Chicago' } });
  // A day that ends at midnight is shown as 23:59 and is not sent back unchanged.
  const midnight = { ...SETTINGS, day_end_min: 1440 };
  assert.deepEqual(familyPatch(midnight, familyForm(midnight)), { patch: {} });
});

test('familyPatch refuses what the server would refuse', () => {
  const form = familyForm(SETTINGS);
  const problem = (f: Partial<typeof form>) => 'problem' in familyPatch(SETTINGS, { ...form, ...f });
  assert.equal(problem({ day_start: '21:00', day_end: '08:00' }), true);
  assert.equal(problem({ day_start: '09:00', day_end: '09:00' }), true);
  assert.equal(problem({ day_start: '' }), true);
  assert.equal(problem({ family_name: '  ' }), true);
  assert.equal(problem({ unlock_hours: '0' }), true);
  assert.equal(problem({ unlock_hours: '1.2' }), true);
  assert.equal(problem({ tray_alert: '0' }), true);
  assert.equal(problem({ tray_alert: '2.5' }), true);
  assert.equal(problem({ weekly_hours: 'lots' }), true);
  assert.equal(problem({ weekly_hours: '0' }), false);
});

test('parentsLine', () => {
  assert.equal(parentsLine(1), '1 Google account allowed');
  assert.equal(parentsLine(2), '2 Google accounts allowed');
});
