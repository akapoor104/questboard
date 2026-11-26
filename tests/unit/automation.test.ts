// The weekly e-mail is built by plain JavaScript inside the Apps Script file.
// This test loads that file as-is and feeds it a real summary from the backend.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createMemoryDb, testReset, type Claims } from '../../src/api/memoryBackend.ts';
import { fixture } from '../contract/fixture.ts';
import { KID, MOM } from '../contract/world.ts';
/* eslint-disable @typescript-eslint/no-explicit-any */

const code = readFileSync(new URL('../../automation/apps-script/Code.gs', import.meta.url), 'utf8');
const gs: any = {};
vm.createContext(gs);
vm.runInContext(code, gs);

test('qbWeekRange: Sunday reports this week, other days the last full week', () => {
  assert.deepEqual({ ...gs.qbWeekRange('2026-12-27') }, { from: '2026-12-21', to: '2026-12-27' });
  assert.deepEqual({ ...gs.qbWeekRange('2026-12-28') }, { from: '2026-12-21', to: '2026-12-27' });
  assert.deepEqual({ ...gs.qbWeekRange('2027-01-02') }, { from: '2026-12-21', to: '2026-12-27' });
  assert.equal(gs.qbMinutes(45), '45 min');
  assert.equal(gs.qbMinutes(120), '2 h');
  assert.equal(gs.qbMinutes(95), '1 h 35 min');
  assert.equal(gs.qbDayLabel('2026-12-27'), 'Sun Dec 27');
});

test('the weekly e-mail shows the numbers, what needs a parent, and escapes his text', () => {
  let now = Date.parse('2026-12-21T17:00:00Z');
  const db = createMemoryDb({ now: () => now });
  testReset(db, fixture() as any);
  const call = (who: Claims | null, fn: string, args: any = {}) => db.call(who, fn, args) as any;
  call(MOM, 'claim_parent');
  const add = (c: any) => call(MOM, 'add_cards', { p_child_id: KID, p_cards: [c] })[0];
  const a = add({ place: 'day', date: '2026-12-21', title: 'Self-study <b>set</b>', category_id: 'academics', minutes: 60 });
  call(MOM, 'resolve_card', { p_card_id: a.id, p_pct: 50, p_note: 'Play date & pizza' });
  const b = add({ place: 'day', date: '2026-12-21', title: 'Drums', category_id: 'music', minutes: 20 });
  call(MOM, 'resolve_card', { p_card_id: b.id, p_pct: 100 });
  add({ place: 'week', title: 'Pack for the trip', category_id: 'home', minutes: 15, due_date: '2026-12-23' });
  call(MOM, 'close_day', { p_child_id: KID });
  call(MOM, 'set_day_mark', { p_child_id: KID, p_date: '2026-12-26', p_kind: 'away' });
  call(MOM, 'save_goal', { p_child_id: KID, p_goal: { scope: 'week', title: 'Write a one-shot' } });
  call(MOM, 'save_review', { p_child_id: KID, p_week_start: '2026-12-21', p_review: { keep: 'Morning block' } });
  const { token } = call(MOM, 'rotate_automation_token');
  now = Date.parse('2026-12-27T17:00:00Z');
  const summary = call(null, 'automation_summary', { p_token: token, p_from: '2026-12-21', p_to: '2026-12-27' });

  assert.equal(gs.buildSummarySubject(summary), "Questboard: Anush's week, Dec 21 to Dec 27");
  const html: string = gs.buildSummaryHtml(summary, 'https://example.org/board');
  assert.match(html, /Anush&#?\w*;?'?s week|Anush's week/);
  assert.match(html, /50 min of 1 h 20 min planned \(63%\)/);
  assert.match(html, /Days closed out<\/td><td[^>]*>1 of 6/);              // six counted days: the Away day is left out
  assert.match(html, /Must-dos finished<\/td><td[^>]*>1 of 2/);
  assert.match(html, /Catch-up tray: 1 card, 30 min/);
  assert.match(html, /Pack for the trip<\/b> is due Wed Dec 23 and is not on a day yet/);
  assert.match(html, /Self-study &lt;b&gt;set&lt;\/b&gt;<\/b>, 50% \("Play date &amp; pizza"\)/);
  assert.ok(!html.includes('<b>set</b>'), 'his text must be escaped');
  assert.match(html, /Sat Dec 26<\/td>.*Away/s);
  assert.match(html, /Write a one-shot/);
  assert.match(html, /<b>Keep:<\/b> Morning block/);
  assert.match(html, /href="https:\/\/example.org\/board"/);
  assert.match(html, /He closed out 1 of 6 days/);
});
