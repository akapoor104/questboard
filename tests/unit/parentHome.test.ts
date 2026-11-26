import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dropRequestLine, dueSoonLine, loadCheckText, parentWeek, trayLine, unconfirmedLine, weekRangeText,
} from '../../src/lib/parentHome.ts';

test('weekRangeText names the month once, or both months across a month end', () => {
  assert.equal(weekRangeText('2026-12-14'), 'December 14 to 20');
  assert.equal(weekRangeText('2026-12-21'), 'December 21 to 27');
  assert.equal(weekRangeText('2026-12-28'), 'December 28 to January 3');
  assert.equal(weekRangeText('2026-11-30'), 'November 30 to December 6');
});

test('loadCheckText: over, to spare, exactly, and no guide', () => {
  assert.equal(loadCheckText(580, 540),
    'Structured time planned: 9 h 40 min. Your guide is 9 h, so this week ran 40 min over.');
  assert.equal(loadCheckText(420, 540),
    'Structured time planned: 7 h. Your guide is 9 h, so there is 2 h to spare.');
  assert.equal(loadCheckText(540, 540),
    'Structured time planned: 9 h. Your guide is 9 h, so this week is exactly your guide.');
  assert.equal(loadCheckText(30, 0), 'Structured time planned: 30 min. No weekly guide is set yet.');
});

test('trayLine counts cards, and alerts at or above the threshold', () => {
  assert.deepEqual(trayLine(1, 30, 5),
    { text: 'Catch-up tray: 1 card, 30 min. You are alerted at 5 cards.', alert: false });
  assert.deepEqual(trayLine(2, 40, 5),
    { text: 'Catch-up tray: 2 cards, 40 min. You are alerted at 5 cards.', alert: false });
  assert.equal(trayLine(5, 150, 5).alert, true);
  assert.equal(trayLine(6, 150, 5).alert, true);
  assert.equal(trayLine(4, 150, 5).alert, false);
  assert.equal(trayLine(0, 0, 1).text, 'Catch-up tray: 0 cards, 0 min. You are alerted at 1 card.');
  assert.equal(trayLine(0, 0, 0).alert, false);
});

test('unconfirmedLine is singular for one card', () => {
  assert.equal(unconfirmedLine(1), '1 card from earlier days has no percent yet.');
  assert.equal(unconfirmedLine(3), '3 cards from earlier days have no percent yet.');
});

test('dueSoonLine names the weekday it is due', () => {
  assert.equal(dueSoonLine({ title: 'Pack for the trip', due_date: '2026-12-23' }),
    '"Pack for the trip" is due Wednesday and is not on a day yet.');
});

test('dropRequestLine: title, minutes (left, in the tray) and the reason in quotes', () => {
  assert.equal(dropRequestLine({ title: 'Mr Math problem set', minutes: 25, place: 'tray', drop_reason: 'We had guests all weekend.' }),
    'Mr Math problem set (25 min left). "We had guests all weekend."');
  assert.equal(dropRequestLine({ title: 'Outside time', minutes: 60, place: 'day', drop_reason: null }),
    'Outside time (1 h).');
  assert.equal(dropRequestLine({ title: 'Outside time', minutes: 60, place: 'day', drop_reason: '  ' }),
    'Outside time (1 h).');
});

test('parentWeek: default, a Monday, another day, and nonsense', () => {
  assert.deepEqual(parentWeek(null, '2026-12-21'), { week: '2026-12-21', redirect: null });
  assert.deepEqual(parentWeek(null, '2026-12-24'), { week: '2026-12-21', redirect: null });
  assert.deepEqual(parentWeek('2026-12-14', '2026-12-21'), { week: '2026-12-14', redirect: null });
  assert.deepEqual(parentWeek('2026-12-16', '2026-12-21'), { week: '2026-12-14', redirect: '/parent?week=2026-12-14' });
  assert.deepEqual(parentWeek('soon', '2026-12-21'), { week: '2026-12-21', redirect: '/parent' });
});
