import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Card } from '../../src/api/types.ts';
import {
  cardActions, dayName, placeDays, resolveText, roundUp5, suggestStart, whereText,
} from '../../src/lib/cardActions.ts';
import { previewResolve } from '../../src/lib/board.ts';

const TODAY = '2026-12-21';
let seq = 0;
const card = (o: Partial<Card>): Card => ({
  id: 'c' + ++seq, child_id: 'k', title: 't', category_id: 'academics', minutes: 30, kind: 'choice', created_by: 'kid',
  place: 'day', date: TODAY, start_min: null, week_start: null, due_date: null, status: 'open', pct: null,
  resolved_at: null, note: null, doing_since: null, drop_requested_at: null, drop_reason: null, root_id: 'r',
  carried_from_id: null, library_item_id: null, goal_id: null, details: null, sort: 0, created_at: '', updated_at: '',
  seq, ...o,
});
const must = { kind: 'must' as const, created_by: 'parent' as const };
const stack = { place: 'week' as const, date: null, week_start: TODAY };
const tray = { place: 'tray' as const, date: null };

test('open on today: start, how did it go, move, edit (his picks), drop or ask', () => {
  assert.deepEqual(cardActions(card({}), TODAY, 'kid'), ['start', 'resolve', 'move', 'edit', 'drop']);
  assert.deepEqual(cardActions(card(must), TODAY, 'kid'), ['start', 'resolve', 'move', 'ask_drop']);
  assert.deepEqual(cardActions(card({ doing_since: '2026-12-21T17:45:00Z' }), TODAY, 'kid'),
    ['stop', 'resolve', 'move', 'edit', 'drop']);
  assert.deepEqual(cardActions(card(must), TODAY, 'parent'), ['start', 'resolve', 'move', 'edit', 'drop']);
});

test('open on a later day: move, edit (his picks), drop or ask', () => {
  const later = { date: '2026-12-23' };
  assert.deepEqual(cardActions(card(later), TODAY, 'kid'), ['move', 'edit', 'drop']);
  assert.deepEqual(cardActions(card({ ...later, ...must }), TODAY, 'kid'), ['move', 'ask_drop']);
  assert.deepEqual(cardActions(card({ ...later, ...must }), TODAY, 'parent'), ['move', 'edit', 'drop']);
});

test('open on an earlier day: how did it go and move (parents may also edit)', () => {
  const earlier = { date: '2026-12-19' };
  assert.deepEqual(cardActions(card(earlier), TODAY, 'kid'), ['resolve', 'move']);
  assert.deepEqual(cardActions(card({ ...earlier, ...must }), TODAY, 'kid'), ['resolve', 'move']);
  assert.deepEqual(cardActions(card({ ...earlier, ...must }), TODAY, 'parent'), ['resolve', 'move', 'edit']);
});

test('open in the stack: to today, move, edit (his picks), drop or ask', () => {
  assert.deepEqual(cardActions(card(stack), TODAY, 'kid'), ['to_today', 'move', 'edit', 'drop']);
  assert.deepEqual(cardActions(card({ ...stack, ...must }), TODAY, 'kid'), ['to_today', 'move', 'ask_drop']);
  assert.deepEqual(cardActions(card({ ...stack, ...must }), TODAY, 'parent'), ['to_today', 'move', 'edit', 'drop']);
});

test('open in the tray: give it a time, drop or ask (parents also edit)', () => {
  assert.deepEqual(cardActions(card(tray), TODAY, 'kid'), ['give_time', 'drop']);
  assert.deepEqual(cardActions(card({ ...tray, ...must }), TODAY, 'kid'), ['give_time', 'ask_drop']);
  assert.deepEqual(cardActions(card({ ...tray, ...must }), TODAY, 'parent'), ['give_time', 'edit', 'drop']);
});

test('resolved: undo for today and yesterday (him), any day (parents)', () => {
  const done = { status: 'resolved' as const, pct: 50 };
  assert.deepEqual(cardActions(card(done), TODAY, 'kid'), ['undo']);
  assert.deepEqual(cardActions(card({ ...done, date: '2026-12-20' }), TODAY, 'kid'), ['undo']);
  assert.deepEqual(cardActions(card({ ...done, date: '2026-12-19' }), TODAY, 'kid'), []);
  assert.deepEqual(cardActions(card({ ...done, date: '2026-12-01' }), TODAY, 'parent'), ['undo']);
});

test('drop requested: no drop or ask button; dropped: nothing', () => {
  const asked = { ...must, drop_requested_at: '2026-12-21T18:00:00Z' };
  assert.deepEqual(cardActions(card(asked), TODAY, 'kid'), ['start', 'resolve', 'move']);
  assert.deepEqual(cardActions(card({ ...asked, ...tray }), TODAY, 'kid'), ['give_time']);
  assert.deepEqual(cardActions(card({ ...asked, ...tray }), TODAY, 'parent'), ['give_time', 'edit']);
  assert.deepEqual(cardActions(card({ status: 'dropped' }), TODAY, 'parent'), []);
});

test('resolveText: the three preview cases', () => {
  assert.deepEqual(resolveText(45, 50), { done: 'About 23 min done.', left: '25 min left over.' });
  assert.deepEqual(resolveText(60, 0), { done: 'Nothing done this time.', left: '1 h left over.' });
  assert.deepEqual(resolveText(60, 100), { done: 'All 1 h done. Nice work.', left: 'Nothing left over.' });
  // The words follow previewResolve, the same arithmetic as the server.
  const p = previewResolve(30, 25);
  assert.deepEqual(resolveText(30, 25), { done: `About ${p.spent} min done.`, left: `${p.left} min left over.` });
});

test('placeDays: today and the next six days', () => {
  const days = placeDays(TODAY);
  assert.equal(days.length, 7);
  assert.deepEqual(days[0], { date: TODAY, label: 'Today' });
  assert.deepEqual(days[1], { date: '2026-12-22', label: 'Tue 22' });
  assert.deepEqual(days[6], { date: '2026-12-27', label: 'Sun 27' });
  assert.equal(placeDays('2026-12-30')[3].label, 'Sat 2');
});

test('dayName and whereText', () => {
  assert.equal(dayName(TODAY, TODAY), 'Today');
  assert.equal(dayName('2026-12-22', TODAY), 'Tomorrow');
  assert.equal(dayName('2026-12-20', TODAY), 'Yesterday');
  assert.equal(dayName('2026-12-24', TODAY), 'Thursday 24');
  assert.equal(whereText(card({ start_min: 600, minutes: 45 }), TODAY), 'Today · 10:00 AM · 45 min');
  assert.equal(whereText(card({ minutes: 15 }), TODAY), 'Today · Any time · 15 min');
  assert.equal(whereText(card(stack), TODAY), "This week's stack · 30 min");
  assert.equal(whereText(card(tray), TODAY), 'Catch-up tray · 30 min left');
});

test('suggestStart: from now on today, from the day start elsewhere, null when full', () => {
  const base = { today: TODAY, nowMin: 606, day_start_min: 480, day_end_min: 1200 };
  const day = [
    card({ start_min: 540, minutes: 30 }), card({ start_min: 600, minutes: 45 }),
    card({ start_min: 660, minutes: 30 }), card({ start_min: 780, minutes: 60 }),
  ];
  const me = card({ minutes: 30, place: 'tray', date: null });
  assert.equal(roundUp5(606), 610);
  assert.equal(suggestStart({ ...base, card: me, date: TODAY, dayCards: day }), 690);
  assert.equal(suggestStart({ ...base, card: me, date: '2026-12-22', dayCards: [] }), 480);
  assert.equal(suggestStart({ ...base, card: me, date: '2026-12-30', dayCards: null }), 480);
  // A card is never in its own way.
  const self = day[1];
  assert.equal(suggestStart({ ...base, card: self, date: '2026-12-22', dayCards: [{ ...self, start_min: 480 }] }), 480);
  // Before the day starts, today begins at the day start.
  assert.equal(suggestStart({ ...base, nowMin: 400, card: me, date: TODAY, dayCards: [] }), 480);
  // Nothing fits late in the evening.
  assert.equal(suggestStart({ ...base, nowMin: 1190, card: me, date: TODAY, dayCards: [] }), null);
});
