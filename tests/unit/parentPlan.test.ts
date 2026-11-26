import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Card } from '../../src/api/types.ts';
import { groupMustDos } from '../../src/lib/board.ts';
import {
  groupKey, markLabel, mustDoCards, mustDoMeta, mustDoStatus, nextMark, planWeek, removable,
} from '../../src/lib/parentPlan.ts';

const WEEK = '2026-12-21';
let seq = 0;
const card = (o: Partial<Card>): Card => ({
  id: 'c' + ++seq, child_id: 'k', title: 'Read for fun', category_id: 'reading', minutes: 30, kind: 'must',
  created_by: 'parent', place: 'week', date: null, start_min: null, week_start: WEEK, due_date: null, status: 'open',
  pct: null, resolved_at: null, note: null, doing_since: null, drop_requested_at: null, drop_reason: null, root_id: 'r',
  carried_from_id: null, library_item_id: null, goal_id: null, details: null, sort: 0, created_at: '', updated_at: '',
  seq, ...o,
});
const onDay = (date: string) => ({ place: 'day' as const, date, week_start: null });

test('mustDoCards makes one must-do per time, all in the week stack', () => {
  const cards = mustDoCards({ title: 'Tidy desk', category_id: 'home', minutes: 10, times: 3, due_date: null }, WEEK);
  assert.equal(cards.length, 3);
  for (const c of cards) {
    assert.deepEqual(c, {
      title: 'Tidy desk', category_id: 'home', minutes: 10, kind: 'must', place: 'week', week_start: WEEK, due_date: null,
    });
  }
  assert.equal(mustDoCards({ title: 'x', category_id: 'home', minutes: 10, times: 7, due_date: '2026-12-24' }, WEEK)
    .filter((c) => c.due_date === '2026-12-24').length, 7);
  assert.equal(mustDoCards({ title: 'x', category_id: 'home', minutes: 10, times: 0, due_date: null }, WEEK).length, 0);
});

test('mustDoStatus: to place, all placed, some done, all done', () => {
  assert.equal(mustDoStatus({ total: 7, placed: 0, toPlace: 7, done: 0 }), '0 placed, 7 to place');
  assert.equal(mustDoStatus({ total: 5, placed: 2, toPlace: 3, done: 0 }), '2 placed, 3 to place');
  assert.equal(mustDoStatus({ total: 5, placed: 5, toPlace: 0, done: 0 }), 'all 5 placed');
  assert.equal(mustDoStatus({ total: 5, placed: 5, toPlace: 0, done: 3 }), '3 of 5 done');
  assert.equal(mustDoStatus({ total: 5, placed: 5, toPlace: 0, done: 5 }), 'all done');
});

test('mustDoStatus for a single card does not count to one', () => {
  assert.equal(mustDoStatus({ total: 1, placed: 0, toPlace: 1, done: 0 }), 'to place');
  assert.equal(mustDoStatus({ total: 1, placed: 1, toPlace: 0, done: 0 }), 'placed');
  assert.equal(mustDoStatus({ total: 1, placed: 1, toPlace: 0, done: 1 }), 'all done');
});

test('mustDoStatus works on real groups', () => {
  const groups = groupMustDos([
    card({}), card({}), card({ ...onDay('2026-12-22') }),
    card({ ...onDay('2026-12-21'), status: 'resolved', pct: 100 }),
  ]);
  assert.equal(groups.length, 1);
  assert.equal(mustDoStatus(groups[0]), '1 of 4 done');
});

test('mustDoMeta says once for one, times otherwise', () => {
  assert.equal(mustDoMeta({ minutes: 30, total: 7 }), '30 min, 7 times');
  assert.equal(mustDoMeta({ minutes: 60, total: 1 }), '1 h, once');
});

test('nextMark cycles none, rest, away, none', () => {
  assert.equal(nextMark(null), 'rest');
  assert.equal(nextMark('rest'), 'away');
  assert.equal(nextMark('away'), null);
});

test('markLabel names the weekday and the mark', () => {
  assert.equal(markLabel('Thursday', null), 'Thursday: no mark');
  assert.equal(markLabel('Thursday', 'rest'), 'Thursday: Rest day');
  assert.equal(markLabel('Thursday', 'away'), 'Thursday: Away');
});

test('removable: open cards only, the ones without a day first', () => {
  const placed = card({ ...onDay('2026-12-22') });
  const stack1 = card({});
  const done = card({ ...onDay('2026-12-21'), status: 'resolved', pct: 100 });
  const partial = card({ ...onDay('2026-12-21'), status: 'resolved', pct: 50 });
  const stack2 = card({});
  assert.deepEqual(removable({ cards: [placed, stack1, done, partial, stack2] }).map((c) => c.id),
    [stack1.id, stack2.id, placed.id]);
  assert.deepEqual(removable({ cards: [done, partial] }), []);
});

test('groupKey matches groups by title, category and minutes', () => {
  assert.equal(groupKey({ title: 'a', category_id: 'b', minutes: 5 }), groupKey({ title: 'a', category_id: 'b', minutes: 5 }));
  assert.notEqual(groupKey({ title: 'a', category_id: 'b', minutes: 5 }), groupKey({ title: 'a', category_id: 'b', minutes: 10 }));
});

test('planWeek: default this week, snaps to Monday, bad dates go home', () => {
  assert.deepEqual(planWeek(null, '2026-12-23'), { week: WEEK, redirect: null });
  assert.deepEqual(planWeek('2026-12-14', '2026-12-23'), { week: '2026-12-14', redirect: null });
  assert.deepEqual(planWeek('2026-12-16', '2026-12-23'), { week: '2026-12-14', redirect: '/parent/plan?week=2026-12-14' });
  assert.deepEqual(planWeek('soon', '2026-12-23'), { week: WEEK, redirect: '/parent/plan' });
});
