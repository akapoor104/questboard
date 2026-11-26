import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Card } from '../../src/api/types.ts';
import {
  campfireText, cardCount, cardMeta, closedToastText, closeOutText, dueSoonText, hourLabel, hourRows, openCount, pctText, splitPool,
  stackGroups, timedBox, trayOrigin, trayOriginText, unconfirmedText,
} from '../../src/lib/today.ts';

let seq = 0;
const card = (o: Partial<Card>): Card => ({
  id: 'c' + ++seq, child_id: 'k', title: 't', category_id: 'academics', minutes: 30, kind: 'choice', created_by: 'kid',
  place: 'day', date: '2026-12-21', start_min: null, week_start: null, due_date: null, status: 'open', pct: null,
  resolved_at: null, note: null, doing_since: null, drop_requested_at: null, drop_reason: null, root_id: 'r',
  carried_from_id: null, library_item_id: null, goal_id: null, details: null, sort: 0, created_at: '', updated_at: '',
  seq, ...o,
});
const stack = (o: Partial<Card>) => card({ place: 'week', date: null, week_start: '2026-12-21', ...o });

test('stackGroups collapses identical cards and puts must-dos first', () => {
  const pick = stack({ title: 'Write an encounter', sort: 0 });
  const read = [1, 2, 3].map(() => stack({ title: 'Read for fun', category_id: 'rest', kind: 'must', sort: 2 }));
  const music = stack({ title: 'Music practice', category_id: 'music', kind: 'must', sort: 1 });
  const longerRead = stack({ title: 'Read for fun', category_id: 'rest', kind: 'must', minutes: 45, sort: 3 });
  const choiceRead = stack({ title: 'Read for fun', category_id: 'rest', kind: 'choice', sort: 4 });
  const groups = stackGroups([pick, ...read, music, longerRead, choiceRead]);
  assert.deepEqual(groups.map((g) => [g.card.id, g.more]), [
    [music.id, 0], [read[0].id, 2], [longerRead.id, 0], [pick.id, 0], [choiceRead.id, 0],
  ]);
});

test('stackGroups orders by sort, then seq, and keeps the first card of a group', () => {
  const a = stack({ title: 'A', sort: 5 });
  const b = stack({ title: 'B', sort: 5 });
  const a2 = stack({ title: 'A', sort: 1 });
  assert.deepEqual(stackGroups([b, a, a2]).map((g) => [g.card.id, g.more]), [[a2.id, 1], [b.id, 0]]);
  assert.deepEqual(stackGroups([]), []);
});

test('splitPool separates this week from open cards left in earlier weeks', () => {
  const now = stack({});
  const old = stack({ week_start: '2026-12-14' });
  const oldDone = stack({ week_start: '2026-12-07', status: 'resolved', pct: 100 });
  const next = stack({ week_start: '2026-12-28' });
  const day = card({});
  const { current, older } = splitPool([now, old, oldDone, next, day], '2026-12-21');
  assert.deepEqual(current, [now]);
  assert.deepEqual(older, [old]);
});

test('hourRows labels every full hour from the start hour to before the end', () => {
  assert.deepEqual(hourRows(480, 600), [480, 540]);
  assert.deepEqual(hourRows(450, 600), [420, 480, 540]);
  assert.deepEqual(hourRows(420, 1260).length, 14);
  assert.deepEqual(hourRows(480, 485), [480]);
  assert.deepEqual(hourLabel(480), '8 AM');
  assert.deepEqual(hourLabel(720), '12 PM');
  assert.deepEqual(hourLabel(810), '1:30 PM');
});

test('timedBox places a card in the day box and clamps it', () => {
  assert.deepEqual(timedBox(600, 45, 420, 1260), { top: 180, height: 45 });
  assert.deepEqual(timedBox(600, 10, 420, 1260), { top: 180, height: 20 }, 'at least 20 minutes tall');
  assert.deepEqual(timedBox(360, 120, 420, 1260), { top: 0, height: 60 }, 'starts before the day');
  assert.deepEqual(timedBox(300, 30, 420, 1260), { top: 0, height: 20 }, 'wholly before the day');
  assert.deepEqual(timedBox(1230, 60, 420, 1260), { top: 810, height: 30 }, 'runs past the end');
  assert.deepEqual(timedBox(1300, 30, 420, 1260), { top: 820, height: 20 }, 'wholly after the day');
});

test('trayOrigin finds the card a leftover came from', () => {
  const from = card({ date: '2026-12-19', status: 'resolved', pct: 50, note: 'Play date ran long' });
  const carry = card({ place: 'tray', date: null, carried_from_id: from.id });
  assert.deepEqual(trayOrigin(carry, [card({}), from]), { date: '2026-12-19', pct: 50, note: 'Play date ran long' });
  assert.equal(trayOrigin(carry, [card({})]), null, 'not loaded');
  assert.equal(trayOrigin(card({ place: 'tray' }), [from]), null, 'not carried');
});

test('trayOriginText reads like the design', () => {
  assert.equal(trayOriginText({ date: '2026-12-19', pct: 50, note: 'Play date ran long' }),
    'Saturday: 50% done. "Play date ran long."');
  assert.equal(trayOriginText({ date: '2026-12-20', pct: 0, note: null }), 'Sunday: not started.');
  assert.equal(trayOriginText({ date: '2026-12-20', pct: 25, note: 'Tired!' }), 'Sunday: 25% done. "Tired!"');
  assert.equal(trayOriginText({ date: '2026-12-20', pct: 25, note: '  ' }), 'Sunday: 25% done.');
});

test('campfireText', () => {
  assert.equal(campfireText(0), 'Campfire: light it today');
  assert.equal(campfireText(1), 'Campfire: 1 day');
  assert.equal(campfireText(6), 'Campfire: 6 days');
});

test('cardMeta follows the card text table', () => {
  const tz = 'America/Los_Angeles';
  assert.deepEqual(cardMeta(card({ start_min: 540 }), tz), ['9:00 AM', '30 min']);
  assert.deepEqual(cardMeta(card({}), tz), ['30 min']);
  assert.deepEqual(cardMeta(card({ start_min: 540, status: 'resolved', pct: 100 }), tz), ['9:00 AM', '30 min', 'done']);
  assert.deepEqual(cardMeta(card({ status: 'resolved', pct: 50 }), tz), ['30 min', '50% done']);
  assert.deepEqual(cardMeta(card({ status: 'resolved', pct: 0 }), tz), ['30 min', 'not started']);
  assert.deepEqual(cardMeta(card({ start_min: 600, doing_since: '2026-12-21T17:45:00Z' }), tz),
    ['Doing now', 'started 9:45 AM']);
  assert.deepEqual(cardMeta(stack({}), tz), ['My pick']);
  assert.deepEqual(cardMeta(stack({ kind: 'must' }), tz), []);
  assert.deepEqual(cardMeta(card({ place: 'tray', date: null, minutes: 25 }), tz), ['25 min left']);
  assert.deepEqual(cardMeta(card({ kind: 'must', drop_requested_at: '2026-12-21T17:00:00Z' }), tz),
    ['Waiting for a parent to decide']);
  assert.equal(pctText(75), '75% done');
});

test('openCount counts only today\'s open cards', () => {
  const list = [card({}), card({ status: 'resolved', pct: 100 }), card({ date: '2026-12-20' }), card({})];
  assert.equal(openCount(list, '2026-12-21'), 2);
});

test('reminder and panel sentences', () => {
  assert.equal(cardCount(1), '1 card');
  assert.equal(cardCount(13), '13 cards');
  assert.equal(unconfirmedText(1), '1 card from earlier days still needs a percent.');
  assert.equal(unconfirmedText(3), '3 cards from earlier days still need a percent.');
  const pack = stack({ title: 'Pack for the trip', kind: 'must', due_date: '2026-12-23' });
  assert.equal(dueSoonText(1, [pack]), 'Must-do due Wednesday: "Pack for the trip" is not on a day yet.');
  assert.equal(dueSoonText(2, [pack, pack]), '2 must-dos are due soon and not on a day yet.');
  assert.equal(dueSoonText(1, []), '1 must-do is due soon and not on a day yet.');
  assert.equal(closeOutText(7), '7 cards still need a percent. When every card has one, close the day to keep the campfire burning.');
  assert.equal(closeOutText(1), '1 card still needs a percent. When every card has one, close the day to keep the campfire burning.');
  assert.equal(closeOutText(0), 'Every card has a percent. Close the day to keep the campfire burning.');
  assert.equal(closedToastText(3), 'Day closed. Campfire: 3 days.');
  assert.equal(closedToastText(1), 'Day closed. Campfire: 1 day.');
});
