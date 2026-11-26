import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Card } from '../../src/api/types.ts';
import { canDrop, dropPlace, slotFromOffset, targetDate } from '../../src/lib/drop.ts';

const TODAY = '2026-12-21';
const WEEK = '2026-12-21';
let seq = 0;
const card = (o: Partial<Card>): Card => ({
  id: 'c' + ++seq, child_id: 'k', title: 't', category_id: 'home', minutes: 30, kind: 'choice', created_by: 'kid',
  place: 'day', date: TODAY, start_min: null, week_start: null, due_date: null, status: 'open', pct: null,
  resolved_at: null, note: null, doing_since: null, drop_requested_at: null, drop_reason: null, root_id: 'r',
  carried_from_id: null, library_item_id: null, goal_id: null, details: null, sort: 0, created_at: '', updated_at: '',
  seq, ...o,
});

// A day from 7:00 AM (420) to 9:00 PM (1260), 15 minutes = 20px.
test('slotFromOffset: the top of the timeline is the start of the day', () => {
  assert.equal(slotFromOffset(0, 20, 420, 1260, 30), 420);
});

test('slotFromOffset: snaps to the nearest 15 minutes', () => {
  assert.equal(slotFromOffset(200, 20, 420, 1260, 30), 570);     // 10 slots: 9:30
  assert.equal(slotFromOffset(209, 20, 420, 1260, 30), 570);     // just under half a slot more
  assert.equal(slotFromOffset(211, 20, 420, 1260, 30), 585);     // just over: 9:45
  assert.equal(slotFromOffset(800, 20, 420, 1260, 15), 1020);    // 5:00 PM
});

test('slotFromOffset: snaps to the clock, not to the day start', () => {
  // A day that starts at 7:10 AM: 2 slots down is 7:40, which rounds to 7:45.
  assert.equal(slotFromOffset(40, 20, 430, 1260, 30), 465);
});

test('slotFromOffset: never before the day starts', () => {
  assert.equal(slotFromOffset(-50, 20, 420, 1260, 30), 420);
});

test('slotFromOffset: the card ends by the end of the day', () => {
  assert.equal(slotFromOffset(10_000, 20, 420, 1260, 60), 1200);  // 8:00 PM, ends 9:00 PM
  assert.equal(slotFromOffset(10_000, 20, 420, 1250, 30), 1215);  // ends 8:45, before 8:50
});

test('slotFromOffset: a card longer than the day starts at the start', () => {
  assert.equal(slotFromOffset(300, 20, 420, 480, 120), 420);
});

test('slotFromOffset: a zero slot height gives the start of the day', () => {
  assert.equal(slotFromOffset(300, 0, 420, 1260, 30), 420);
});

test('canDrop: open cards onto today and later', () => {
  assert.equal(canDrop(card({}), TODAY, TODAY, 'kid'), true);
  assert.equal(canDrop(card({}), '2026-12-23', TODAY, 'kid'), true);
});

test('canDrop: not onto a past day for him, but a parent may', () => {
  assert.equal(canDrop(card({}), '2026-12-20', TODAY, 'kid'), false);
  assert.equal(canDrop(card({}), '2026-12-20', TODAY, 'parent'), true);
});

test('canDrop: never a resolved card', () => {
  assert.equal(canDrop(card({ status: 'resolved', pct: 100 }), TODAY, TODAY, 'kid'), false);
  assert.equal(canDrop(card({ status: 'resolved', pct: 0 }), '2026-12-23', TODAY, 'parent'), false);
});

test('dropPlace: a stack card onto a day goes there at any time', () => {
  const c = card({ place: 'week', date: null, week_start: WEEK });
  assert.deepEqual(dropPlace(c, { kind: 'day', date: '2026-12-23' }, WEEK),
    { place: 'day', date: '2026-12-23', start_min: null });
});

test('dropPlace: a card moved to another day keeps its time', () => {
  const c = card({ start_min: 660 });
  assert.deepEqual(dropPlace(c, { kind: 'day', date: '2026-12-24' }, WEEK),
    { place: 'day', date: '2026-12-24', start_min: 660 });
});

test('dropPlace: onto its own day is nothing to do', () => {
  assert.equal(dropPlace(card({ start_min: 660 }), { kind: 'day', date: TODAY }, WEEK), null);
});

test('dropPlace: onto a time sets the time', () => {
  assert.deepEqual(dropPlace(card({}), { kind: 'time', date: TODAY, start_min: 1020 }, WEEK),
    { place: 'day', date: TODAY, start_min: 1020 });
  assert.deepEqual(dropPlace(card({ start_min: 600 }), { kind: 'time', date: TODAY, start_min: 1020 }, WEEK),
    { place: 'day', date: TODAY, start_min: 1020 });
  const stack = card({ place: 'week', date: null, week_start: WEEK });
  assert.deepEqual(dropPlace(stack, { kind: 'time', date: TODAY, start_min: 1020 }, WEEK),
    { place: 'day', date: TODAY, start_min: 1020 });
});

test('dropPlace: onto the time it already has is nothing to do', () => {
  assert.equal(dropPlace(card({ start_min: 1020 }), { kind: 'time', date: TODAY, start_min: 1020 }, WEEK), null);
});

test("dropPlace: a day card back to the week's stack", () => {
  assert.deepEqual(dropPlace(card({ start_min: 600 }), { kind: 'week' }, WEEK), { place: 'week', week_start: WEEK });
});

test("dropPlace: a card already in that week's stack stays; one from another week moves", () => {
  assert.equal(dropPlace(card({ place: 'week', date: null, week_start: WEEK }), { kind: 'week' }, WEEK), null);
  assert.deepEqual(dropPlace(card({ place: 'week', date: null, week_start: '2026-12-14' }), { kind: 'week' }, WEEK),
    { place: 'week', week_start: WEEK });
});

test('targetDate: the stack counts as the end of its week', () => {
  assert.equal(targetDate({ kind: 'week' }, '2026-12-27'), '2026-12-27');
  assert.equal(targetDate({ kind: 'day', date: '2026-12-23' }, '2026-12-27'), '2026-12-23');
  assert.equal(targetDate({ kind: 'time', date: TODAY, start_min: 600 }, '2026-12-27'), TODAY);
});
