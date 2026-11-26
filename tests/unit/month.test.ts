import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { StatsDay } from '../../src/api/types.ts';
import {
  boardLine, cellAriaLabel, closedOfCounted, dayLabel, daysOnBoard, monthDay, monthParam, parseMonth, shiftMonth,
  shortDuration, tintStep,
} from '../../src/lib/month.ts';

const TODAY = '2026-12-21';
const day = (date: string, o: Partial<StatsDay> = {}): StatsDay => ({
  date, planned_min: 0, spent_min: 0, done: 0, partial: 0, missed: 0, unconfirmed: 0, open: 0, closed: false,
  mark: null, ...o,
});

const MONTH: StatsDay[] = [
  day('2026-12-14', { planned_min: 60, unconfirmed: 1 }),                       // not closed
  day('2026-12-19', { planned_min: 290, spent_min: 290, done: 3, closed: true }),
  day('2026-12-20', { planned_min: 200, spent_min: 170, done: 3, partial: 1, closed: true }),
  day('2026-12-21', { planned_min: 180, spent_min: 30, done: 1, open: 4 }),     // today, not closed yet
  day('2026-12-22', { planned_min: 170, open: 3 }),                             // planned
  day('2026-12-24', { mark: 'rest' }),
  day('2026-12-26', { mark: 'away', planned_min: 30, open: 1 }),
  day('2026-12-28'),                                                            // empty
  day('2026-12-10', { closed: true }),                                          // closed with no cards
  day('2026-12-12', { mark: 'rest', done: 1, planned_min: 30, spent_min: 30 }), // past, marked
];

test('daysOnBoard counts days with a card or a close-out', () => {
  assert.equal(daysOnBoard(MONTH), 8);
  assert.equal(daysOnBoard([day('2026-12-01'), day('2026-12-02', { mark: 'rest' })]), 0);
  assert.equal(daysOnBoard([]), 0);
});

test('closedOfCounted: up to today, no mark, had something', () => {
  // counted: 14, 19, 20, 21, 10 (the 12th is marked; the 22nd is in the future)
  assert.deepEqual(closedOfCounted(MONTH, TODAY), { closed: 3, counted: 5 });
  assert.deepEqual(closedOfCounted([], TODAY), { closed: 0, counted: 0 });
  // A month in the past counts every day.
  assert.deepEqual(closedOfCounted(MONTH, '2027-01-05'), { closed: 3, counted: 6 });
});

test('dayLabel', () => {
  const by = (d: string) => MONTH.find((x) => x.date === d)!;
  assert.equal(dayLabel(by('2026-12-14'), TODAY), 'not_closed');
  assert.equal(dayLabel(by('2026-12-19'), TODAY), 'closed');
  assert.equal(dayLabel(by('2026-12-21'), TODAY), 'today');
  assert.equal(dayLabel(by('2026-12-22'), TODAY), 'planned');
  assert.equal(dayLabel(by('2026-12-24'), TODAY), 'rest');
  assert.equal(dayLabel(by('2026-12-26'), TODAY), 'away');
  assert.equal(dayLabel(by('2026-12-28'), TODAY), 'empty');
  assert.equal(dayLabel(day('2026-12-01'), TODAY), 'empty');                        // past, nothing on it
  assert.equal(dayLabel(day('2026-12-21', { mark: 'rest' }), TODAY), 'today');       // today wins
});

test('tintStep: three steps against the busiest day', () => {
  assert.equal(tintStep(0, 290), 0);
  assert.equal(tintStep(30, 0), 0);
  assert.equal(tintStep(90, 290), 1);
  assert.equal(tintStep(160, 290), 1);
  assert.equal(tintStep(190, 290), 2);
  assert.equal(tintStep(215, 290), 2);
  assert.equal(tintStep(270, 290), 3);
  assert.equal(tintStep(290, 290), 3);
});

test('parseMonth', () => {
  assert.equal(parseMonth('2026-12'), '2026-12-01');
  assert.equal(parseMonth('2027-01'), '2027-01-01');
  for (const bad of ['abc', '2026-13', '2026-00', '2026-1', '2026-12-01', '', '12-2026']) {
    assert.equal(parseMonth(bad), null, bad);
  }
});

test('monthParam, shiftMonth, monthDay', () => {
  assert.equal(monthParam('2026-12-01'), '2026-12');
  assert.equal(shiftMonth('2026-12-01', 1), '2027-01-01');
  assert.equal(shiftMonth('2026-12-01', -1), '2026-11-01');
  assert.equal(shiftMonth('2027-01-01', -1), '2026-12-01');
  assert.equal(monthDay('2026-12-19'), 'December 19');
  assert.equal(monthDay('2027-01-03'), 'January 3');
});

test('boardLine and shortDuration', () => {
  assert.equal(boardLine(10), '10 days on the board so far. Here is where the time went.');
  assert.equal(boardLine(1), '1 day on the board so far. Here is where the time went.');
  assert.equal(shortDuration(290), '4h50');
  assert.equal(shortDuration(300), '5h');
  assert.equal(shortDuration(65), '1h05');
  assert.equal(shortDuration(45), '45m');
});

test('cellAriaLabel', () => {
  const by = (d: string) => MONTH.find((x) => x.date === d)!;
  assert.equal(cellAriaLabel(by('2026-12-19'), TODAY), 'December 19: 4 h 50 min, closed out');
  assert.equal(cellAriaLabel(by('2026-12-21'), TODAY), 'December 21: today');
  assert.equal(cellAriaLabel(by('2026-12-14'), TODAY), 'December 14: not closed');
  assert.equal(cellAriaLabel(by('2026-12-22'), TODAY), 'December 22: 2 h 50 min planned');
  assert.equal(cellAriaLabel(by('2026-12-24'), TODAY), 'December 24: rest day');
  assert.equal(cellAriaLabel(by('2026-12-26'), TODAY), 'December 26: away');
  assert.equal(cellAriaLabel(by('2026-12-28'), TODAY), 'December 28');
  assert.equal(cellAriaLabel(by('2026-12-10'), TODAY), 'December 10: nothing spent, closed out');
});
