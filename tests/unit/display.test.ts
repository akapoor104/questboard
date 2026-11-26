import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Card } from '../../src/api/types.ts';
import { isEmpty, markText, nowAndNext, startText } from '../../src/lib/display.ts';

let seq = 0;
const card = (o: Partial<Card>): Card => ({
  id: 'c' + ++seq, child_id: 'k', title: 't', category_id: 'academics', minutes: 30, kind: 'choice', created_by: 'kid',
  place: 'day', date: '2026-12-21', start_min: null, week_start: null, due_date: null, status: 'open', pct: null,
  resolved_at: null, note: null, doing_since: null, drop_requested_at: null, drop_reason: null, root_id: 'r',
  carried_from_id: null, library_item_id: null, goal_id: null, details: null, sort: 0, created_at: '', updated_at: '',
  seq, ...o,
});
const ids = (cs: Card[]) => cs.map((c) => c.id);

test('now is the timed card whose slot holds the time; next starts after it', () => {
  const a = card({ start_min: 540, minutes: 60 });   // 9:00-10:00
  const b = card({ start_min: 600, minutes: 60 });   // 10:00-11:00
  const c = card({ start_min: 660, minutes: 45 });   // 11:00
  const d = card({ start_min: 780, minutes: 60 });   // 1:00 PM
  const any = card({});
  const v = nowAndNext([d, any, c, b, a], 606);
  assert.equal(v.now, b);
  assert.equal(v.next, c);
  assert.deepEqual(ids(v.later), ids([a, d]));
  assert.deepEqual(ids(v.anytime), ids([any]));
});

test('a started card is now, even outside its slot or without a time', () => {
  const started = card({ start_min: 540, minutes: 30, doing_since: '2026-12-21T17:00:00Z' });
  const inSlot = card({ start_min: 600, minutes: 60 });
  const v = nowAndNext([inSlot, started], 610);
  assert.equal(v.now, started);
  assert.equal(v.next, null);
  assert.deepEqual(ids(v.later), ids([inSlot]));

  const anyStarted = card({ doing_since: '2026-12-21T18:00:00Z' });
  const other = card({});
  const w = nowAndNext([anyStarted, other], 610);
  assert.equal(w.now, anyStarted);
  assert.deepEqual(ids(w.anytime), ids([other]));
});

test('of two started cards the one started last wins', () => {
  const early = card({ doing_since: '2026-12-21T17:00:00Z' });
  const late = card({ doing_since: '2026-12-21T18:00:00Z' });
  assert.equal(nowAndNext([late, early], 0).now, late);
  assert.deepEqual(ids(nowAndNext([late, early], 0).anytime), ids([early]));
});

test('a slot ends at its end minute: at 10:00 the 9:00 hour card is over', () => {
  const a = card({ start_min: 540, minutes: 60 });
  const b = card({ start_min: 600, minutes: 30 });
  assert.equal(nowAndNext([a, b], 599).now, a);
  assert.equal(nowAndNext([a, b], 599).next, b);
  assert.equal(nowAndNext([a, b], 600).now, b);
  assert.equal(nowAndNext([a, b], 600).next, null);
});

test('between cards nothing is now; the next one is next', () => {
  const a = card({ start_min: 540, minutes: 30 });
  const b = card({ start_min: 660, minutes: 30 });
  const v = nowAndNext([a, b], 600);
  assert.equal(v.now, null);
  assert.equal(v.next, b);
  assert.deepEqual(ids(v.later), ids([a]));
});

test('resolved and dropped cards are left out', () => {
  const done = card({ start_min: 600, minutes: 60, status: 'resolved', pct: 100 });
  const dropped = card({ start_min: 660, status: 'dropped' });
  const anyDone = card({ status: 'resolved', pct: 50 });
  const v = nowAndNext([done, dropped, anyDone], 610);
  assert.equal(v.now, null);
  assert.equal(v.next, null);
  assert.deepEqual(v.later, []);
  assert.deepEqual(v.anytime, []);
  assert.equal(isEmpty(v), true);
  assert.equal(isEmpty(nowAndNext([card({})], 0)), false);
});

test('two cards at the same time keep their order (seq)', () => {
  const first = card({ start_min: 660 });
  const second = card({ start_min: 660 });
  const v = nowAndNext([second, first], 600);
  assert.equal(v.next, first);
  assert.deepEqual(ids(v.later), ids([second]));
});

test('startText and markText', () => {
  assert.equal(startText(card({ start_min: 660 })), '11:00 AM');
  assert.equal(startText(card({})), 'Any time');
  assert.equal(markText({ child_id: 'k', date: '2026-12-21', kind: 'rest', note: null }), 'Rest day');
  assert.equal(markText({ child_id: 'k', date: '2026-12-21', kind: 'away', note: 'Trip' }), 'Away');
});
