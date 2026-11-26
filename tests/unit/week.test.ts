import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Card, Goal, LibraryItem } from '../../src/api/types.ts';
import {
  activeCount, dayPlannedMinutes, filterLibrary, isMonday, loadState, loadText, newCardProblem, weekFocus,
  weekFromParam, weekPlaceDays,
} from '../../src/lib/week.ts';

const TODAY = '2026-12-21';
let seq = 0;
const card = (o: Partial<Card>): Card => ({
  id: 'c' + ++seq, child_id: 'k', title: 't', category_id: 'academics', minutes: 30, kind: 'choice', created_by: 'kid',
  place: 'day', date: TODAY, start_min: null, week_start: null, due_date: null, status: 'open', pct: null,
  resolved_at: null, note: null, doing_since: null, drop_requested_at: null, drop_reason: null, root_id: 'r',
  carried_from_id: null, library_item_id: null, goal_id: null, details: null, sort: 0, created_at: '', updated_at: '',
  seq, ...o,
});
const item = (id: string, category_id: string): LibraryItem => ({
  id, title: id, category_id, minutes: 30, description: null, tags: [], source: 'guide', plan_ref: null, active: true,
  created_at: '',
});
const goal = (o: Partial<Goal>): Goal => ({
  id: 'g' + ++seq, child_id: 'k', scope: 'week', period_start: TODAY, title: 'g', category_id: null, note: null,
  status: 'active', sort: 0, created_by: 'kid', created_at: '', seq, ...o,
});

test('loadState: spare under 80%, full 80 to 100%, over above', () => {
  assert.deepEqual(loadState(0, 540), { ratio: 0, level: 'spare', overBy: 0 });
  assert.equal(loadState(431, 540).level, 'spare');
  assert.equal(loadState(432, 540).level, 'full');
  assert.equal(loadState(540, 540).level, 'full');
  assert.deepEqual(loadState(600, 540), { ratio: 600 / 540, level: 'over', overBy: 60 });
});

test('loadState: a guide of 0 is always spare', () => {
  assert.deepEqual(loadState(900, 0), { ratio: 0, level: 'spare', overBy: 0 });
});

test('loadText: the three sentences', () => {
  assert.equal(loadText(loadState(100, 540)), 'Room to spare. Leave some of it empty.');
  assert.equal(loadText(loadState(500, 540)), 'A full week. Nothing more needs adding.');
  assert.equal(loadText(loadState(615, 540)), 'Over the guide by 1 h 15 min. What could wait?');
});

test('dayPlannedMinutes leaves out dropped cards', () => {
  assert.equal(dayPlannedMinutes([]), 0);
  assert.equal(dayPlannedMinutes([card({ minutes: 30 }), card({ minutes: 45, status: 'resolved', pct: 50 }),
    card({ minutes: 60, status: 'dropped' })]), 75);
});

test('filterLibrary keeps order and filters by category', () => {
  const items = [item('a', 'story'), item('b', 'music'), item('c', 'story')];
  assert.deepEqual(filterLibrary(items, null).map((i) => i.id), ['a', 'b', 'c']);
  assert.deepEqual(filterLibrary(items, 'story').map((i) => i.id), ['a', 'c']);
  assert.deepEqual(filterLibrary(items, 'none'), []);
});

test('isMonday', () => {
  assert.equal(isMonday('2026-12-21'), true);
  assert.equal(isMonday('2026-12-23'), false);
  assert.equal(isMonday('2026-12-28'), true);
  assert.equal(isMonday('not-a-date'), false);
  assert.equal(isMonday('2026-02-30'), false);
});

test('weekFromParam: Mondays stay, other dates go to their Monday, junk goes to /week', () => {
  assert.deepEqual(weekFromParam(undefined, '2026-12-23'), { week: '2026-12-21', redirect: null });
  assert.deepEqual(weekFromParam('2026-12-28', TODAY), { week: '2026-12-28', redirect: null });
  assert.deepEqual(weekFromParam('2026-12-23', TODAY), { week: '2026-12-21', redirect: '/week/2026-12-21' });
  assert.deepEqual(weekFromParam('2027-01-03', TODAY), { week: '2026-12-28', redirect: '/week/2026-12-28' });
  assert.deepEqual(weekFromParam('soon', TODAY), { week: '2026-12-21', redirect: '/week' });
});

test('weekFocus: this week only, dropped left out; activeCount counts active', () => {
  const goals = [
    goal({ title: 'a' }), goal({ title: 'b', status: 'done' }), goal({ title: 'c', status: 'dropped' }),
    goal({ title: 'd', period_start: '2026-12-28' }), goal({ title: 'e', scope: 'month', period_start: '2026-12-01' }),
  ];
  const focus = weekFocus(goals, TODAY);
  assert.deepEqual(focus.map((g) => g.title), ['a', 'b']);
  assert.equal(activeCount(focus), 1);
});

test('newCardProblem: title 1 to 120 characters, minutes 5 to 480 in steps of 5', () => {
  assert.equal(newCardProblem('Paint minis', 45), null);
  assert.equal(newCardProblem('   ', 45), 'title');
  assert.equal(newCardProblem('x'.repeat(121), 45), 'title');
  assert.equal(newCardProblem('x'.repeat(120), 480), null);
  assert.equal(newCardProblem('a', 0), 'minutes');
  assert.equal(newCardProblem('a', 485), 'minutes');
  assert.equal(newCardProblem('a', 42), 'minutes');
  assert.equal(newCardProblem('a', Number.NaN), 'minutes');
  assert.equal(newCardProblem('a', 5), null);
});

test('weekPlaceDays: the shown week from today on', () => {
  assert.deepEqual(weekPlaceDays(TODAY, '2026-12-23').map((d) => d.label), ['Today', 'Thu 24', 'Fri 25', 'Sat 26', 'Sun 27']);
  assert.deepEqual(weekPlaceDays('2026-12-28', TODAY).map((d) => d.label), ['Mon 28', 'Tue 29', 'Wed 30', 'Thu 31', 'Fri 1', 'Sat 2', 'Sun 3']);
  assert.deepEqual(weekPlaceDays('2026-12-14', TODAY), []);
  assert.equal(weekPlaceDays(TODAY, TODAY)[2].date, '2026-12-23');
});
