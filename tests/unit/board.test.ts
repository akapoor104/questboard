import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Card, Category } from '../../src/api/types.ts';
import {
  cardsByDate, dueSoonCards, groupMustDos, layoutDay, minutesByCategory, monthGrid, nextFreeSlot, percentDone,
  previewResolve, spentMinutes, structuredMinutes, weekDates,
} from '../../src/lib/board.ts';
import { carryMinutes } from '../../src/api/memory/board.ts';

let seq = 0;
const card = (o: Partial<Card>): Card => ({
  id: 'c' + ++seq, child_id: 'k', title: 't', category_id: 'academics', minutes: 30, kind: 'choice', created_by: 'kid',
  place: 'day', date: '2026-12-21', start_min: null, week_start: null, due_date: null, status: 'open', pct: null,
  resolved_at: null, note: null, doing_since: null, drop_requested_at: null, drop_reason: null, root_id: 'r',
  carried_from_id: null, library_item_id: null, goal_id: null, details: null, sort: 0, created_at: '', updated_at: '',
  seq, ...o,
});
const cats = [
  { id: 'academics', kind: 'structured' }, { id: 'fun', kind: 'free' }, { id: 'music', kind: 'structured' },
] as Category[];

test('weekDates lists Monday to Sunday', () => {
  assert.deepEqual(weekDates('2026-12-28'), ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31',
    '2027-01-01', '2027-01-02', '2027-01-03']);
});

test('cardsByDate groups and keeps order', () => {
  const a = card({ date: '2026-12-21' });
  const b = card({ date: '2026-12-22' });
  const c = card({ date: '2026-12-21' });
  const m = cardsByDate([a, b, c, card({ date: null, place: 'tray' })]);
  assert.deepEqual([...m.keys()], ['2026-12-21', '2026-12-22']);
  assert.deepEqual(m.get('2026-12-21'), [a, c]);
});

test('previewResolve matches the backend for every minute and percent', () => {
  assert.deepEqual(previewResolve(60, 50), { spent: 30, left: 30 });
  assert.deepEqual(previewResolve(45, 50), { spent: 23, left: 25 });
  assert.deepEqual(previewResolve(10, 99), { spent: 10, left: 5 });
  assert.deepEqual(previewResolve(30, 100), { spent: 30, left: 0 });
  assert.deepEqual(previewResolve(30, 0), { spent: 0, left: 30 });
  for (let m = 5; m <= 480; m += 1) {
    for (let p = 0; p < 100; p += 1) assert.equal(previewResolve(m, p).left, carryMinutes(m, p), `${m} min at ${p}%`);
  }
});

test('minutesByCategory and structuredMinutes ignore dropped cards', () => {
  const list = [
    card({ minutes: 60, status: 'resolved', pct: 50 }), card({ minutes: 30 }),
    card({ category_id: 'fun', minutes: 120 }), card({ category_id: 'music', minutes: 20, status: 'dropped' }),
  ];
  assert.equal(spentMinutes(list[0]), 30);
  assert.deepEqual(minutesByCategory(list, cats), [
    { category_id: 'academics', planned: 90, spent: 30 }, { category_id: 'fun', planned: 120, spent: 0 },
  ]);
  assert.equal(structuredMinutes(list, cats), 90);
});

test('layoutDay puts overlapping cards side by side', () => {
  const a = card({ start_min: 540, minutes: 60 });       // 9:00-10:00
  const b = card({ start_min: 570, minutes: 30 });       // 9:30-10:00 overlaps a
  const c = card({ start_min: 600, minutes: 30 });       // 10:00-10:30 touches, no overlap
  const d = card({ start_min: null });
  const { anytime, timed } = layoutDay([c, d, b, a]);
  assert.deepEqual(anytime, [d]);
  assert.deepEqual(timed.map((t) => [t.card.id, t.column, t.columns]), [[a.id, 0, 2], [b.id, 1, 2], [c.id, 0, 1]]);
});

test('nextFreeSlot finds the first gap on the 5-minute grid', () => {
  const day = [card({ start_min: 540, minutes: 30 }), card({ start_min: 585, minutes: 45 })];   // 9:00-9:30, 9:45-10:30
  assert.equal(nextFreeSlot(day, 15, 541, 1260), 570);     // 9:30 fits before 9:45
  assert.equal(nextFreeSlot(day, 30, 540, 1260), 630);     // needs 10:30
  assert.equal(nextFreeSlot([], 30, 422, 1260), 425);
  assert.equal(nextFreeSlot(day, 60, 1230, 1260), null);
});

test('dueSoonCards: open must-dos due within two days that are not on a day in time', () => {
  const pool = (o: Partial<Card>) => card({ place: 'week', date: null, week_start: '2026-12-21', kind: 'must', ...o });
  const board = {
    today: '2026-12-21',
    cards: [
      card({ title: 'on time', kind: 'must', due_date: '2026-12-22', date: '2026-12-22' }),
      card({ title: 'too late', kind: 'must', due_date: '2026-12-22', date: '2026-12-24' }),
      card({ title: 'done', kind: 'must', due_date: '2026-12-22', status: 'resolved', pct: 100 }),
    ],
    pool: [
      pool({ title: 'pack', due_date: '2026-12-23' }),
      pool({ title: 'far away', due_date: '2026-12-24' }),
      pool({ title: 'no date' }),
      pool({ title: 'his pick', kind: 'choice', due_date: '2026-12-21' }),
      pool({ title: 'overdue', due_date: '2026-12-19' }),
    ],
    tray: [card({ title: 'leftover', kind: 'must', place: 'tray', date: null, due_date: '2026-12-22' })],
  };
  assert.deepEqual(dueSoonCards(board).map((c) => c.title), ['too late', 'pack', 'overdue', 'leftover']);
});

test('groupMustDos: one line per repeated must-do, with placed, to place and done counts', () => {
  const music = { title: 'Music practice', category_id: 'music', minutes: 20, kind: 'must' as const };
  const groups = groupMustDos([
    card({ ...music, status: 'resolved', pct: 100 }),
    card({ ...music, date: '2026-12-22' }),
    card({ ...music, place: 'week', date: null, week_start: '2026-12-21' }),
    card({ ...music, place: 'week', date: null, week_start: '2026-12-21' }),
    card({ ...music, minutes: 30 }),                                       // other minutes: its own line
    card({ ...music, status: 'dropped' }),                                 // ignored
    card({ title: 'Paint minis', kind: 'choice' }),                        // ignored
    card({ title: 'Outside time', category_id: 'outdoors', minutes: 60, kind: 'must', status: 'resolved', pct: 50 }),
  ]);
  assert.deepEqual(groups.map((g) => [g.title, g.minutes, g.total, g.placed, g.toPlace, g.done]), [
    ['Music practice', 20, 4, 2, 2, 1],
    ['Music practice', 30, 1, 1, 0, 0],
    ['Outside time', 60, 1, 1, 0, 0],
  ]);
  assert.equal(groups[0].cards.length, 4);
});

test('percentDone and monthGrid', () => {
  assert.equal(percentDone(0, 0), 0);
  assert.equal(percentDone(350, 310), 89);
  assert.equal(percentDone(60, 90), 100);
  const dec = monthGrid('2026-12-21');
  assert.equal(dec.length, 5);
  assert.deepEqual(dec[0], ['2026-11-30', '2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-05', '2026-12-06']);
  assert.equal(dec[4][6], '2027-01-03');
  assert.equal(monthGrid('2027-02-10').length, 4);                         // February 2027 starts on a Monday
  assert.equal(monthGrid('2026-08-15').length, 6);                         // August 2026 needs six rows
});
