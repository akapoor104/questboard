// Contract tests: daily content, streak, stats, weekly review, backup, automation, starter plan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './fixture.ts';
import { KID, KITCHEN, LAPTOP, MOM, PIN, failsWith, worlds } from './world.ts';

const T0 = '2026-12-21T17:00:00Z';            // Monday Dec 21, 9:00 AM in Los Angeles
const MON = '2026-12-21';
const day = (n: number) => `2026-12-${String(n).padStart(2, '0')}`;
const at = (n: number) => `${day(n)}T17:00:00Z`;
/* eslint-disable @typescript-eslint/no-explicit-any */

for (const w of worlds()) {
  const start = (now = T0) => {
    w.setNow(now);
    w.reset(fixture());
    w.call(MOM, 'claim_parent');
    const p = w.call(LAPTOP, 'device_start_pairing', { p_label: 'Laptop' });
    w.call(MOM, 'device_approve', { p_code: p.pair_code, p_child_id: KID });
    w.call(LAPTOP, 'kid_unlock', { p_pin: PIN });
  };
  const add = (card: any, who: any = MOM) => w.call(who, 'add_cards', { p_child_id: KID, p_cards: [card] })[0];
  const card = (extra: any = {}) =>
    ({ place: 'day', date: MON, title: 'Math Academy lesson', category_id: 'academics', minutes: 30, ...extra });
  const resolve = (id: string, pct: number, extra: any = {}) =>
    w.call(MOM, 'resolve_card', { p_card_id: id, p_pct: pct, ...extra });
  const today = (who: any = LAPTOP) => w.call(who, 'get_today', { p_child_id: KID });

  test(`[${w.name}] today: one encouragement and one word per date, the same on every device`, () => {
    start();
    const t = today();
    assert.equal(t.date, MON);
    assert.equal(t.encouragement, 'A plan is a map, not a cage.');
    assert.deepEqual(t.word, { id: 1, word: 'tenacious', part_of_speech: 'adjective', definition: 'Not giving up.',
      example: 'A tenacious ranger.', used: false });
    assert.deepEqual(t.streak, { current: 0, best: 0 });
    assert.deepEqual(t.alerts, []);
    assert.equal(t.parent_note, null);
    assert.deepEqual(w.call(LAPTOP, 'mark_word_used', { p_child_id: KID, p_used: true }), { used: true });
    assert.equal(today().word.used, true);
    w.call(LAPTOP, 'mark_word_used', { p_child_id: KID, p_used: false });
    assert.equal(today(MOM).word.used, false);
    w.setNow(at(22));
    w.call(LAPTOP, 'kid_unlock', { p_pin: PIN });
    assert.equal(today().word.word, 'lucid');
    assert.equal(today().encouragement, 'Small steps add up.');
    w.setNow(at(23));
    w.call(LAPTOP, 'kid_unlock', { p_pin: PIN });
    assert.equal(today().word.word, 'forage');
    assert.equal(today().encouragement, 'A plan is a map, not a cage.');
    failsWith(() => today(null), 'not_signed_in');
  });

  test(`[${w.name}] a parent's note shows on its day`, () => {
    start();
    assert.deepEqual(w.call(MOM, 'set_parent_note', { p_child_id: KID, p_date: MON, p_text: '  Proud of you.  ' }),
      { date: MON, text: 'Proud of you.' });
    w.call(MOM, 'set_parent_note', { p_child_id: KID, p_date: day(22), p_text: 'Tomorrow note' });
    assert.equal(today().parent_note, 'Proud of you.');
    assert.deepEqual(w.call(MOM, 'set_parent_note', { p_child_id: KID, p_date: MON, p_text: '  ' }), { date: MON, text: null });
    assert.equal(today().parent_note, null);
    failsWith(() => w.call(LAPTOP, 'set_parent_note', { p_child_id: KID, p_date: MON, p_text: 'hi' }), 'not_parent');
  });

  test(`[${w.name}] alerts: unconfirmed cards, the tray, must-dos due soon, drop requests`, () => {
    start();
    add(card({ date: day(20) }));                                         // Sunday, never confirmed
    const half = add(card({ minutes: 60 }));
    resolve(half.id, 50);                                                 // 30 min into the tray
    resolve(add(card({ minutes: 20 })).id, 0);                            // 20 min into the tray
    add({ place: 'week', title: 'Pack for the trip', category_id: 'home', minutes: 15, due_date: day(23) });
    add(card({ title: 'Placed in time', due_date: day(23), date: day(22) }));      // fine: on a day before it is due
    add(card({ title: 'Placed too late', due_date: day(22), date: day(24) }));     // on a day after it is due
    add(card({ title: 'Due later', due_date: day(30), date: day(31) }));           // not within two days yet
    const must = add(card({ title: 'Mr Math set' }));
    w.call(LAPTOP, 'drop_card', { p_card_id: must.id, p_reason: 'No time' });
    assert.deepEqual(today().alerts, [
      { type: 'unconfirmed', count: 1 }, { type: 'tray', count: 2, minutes: 50 }, { type: 'due_soon', count: 2 },
    ]);
    assert.deepEqual(today(MOM).alerts[3], { type: 'drop_requests', count: 1 });
  });

  test(`[${w.name}] the streak counts closed-out days and skips Away and Rest days`, () => {
    start(at(14));
    const close = (n: number) => { w.setNow(at(n)); w.call(MOM, 'close_day', { p_child_id: KID }); };
    close(14); close(15);
    w.setNow(at(16));
    assert.deepEqual(today(MOM).streak, { current: 2, best: 2 });         // today not closed yet: still alive
    w.setNow(at(17));
    assert.deepEqual(today(MOM).streak, { current: 0, best: 2 });         // the 16th was skipped: broken
    close(17); close(18);
    w.call(MOM, 'set_day_mark', { p_child_id: KID, p_date: day(19), p_kind: 'away' });
    w.call(MOM, 'set_day_mark', { p_child_id: KID, p_date: day(20), p_kind: 'rest' });
    close(21);
    assert.deepEqual(today(MOM).streak, { current: 3, best: 3 });         // 17, 18, (19-20 skipped), 21
    w.setNow(at(22));
    assert.deepEqual(w.call(MOM, 'get_stats', { p_child_id: KID, p_from: day(14), p_to: day(22) }).streak,
      { current: 3, best: 3 });
  });

  test(`[${w.name}] stats: planned and spent minutes by category and by day`, () => {
    start();
    resolve(add(card({ minutes: 30 })).id, 100);                                              // academics: 30 of 30
    resolve(add(card({ minutes: 45, title: 'Mr Math set' })).id, 50);                         // academics: 23 of 45 (22.5 rounds up)
    resolve(add(card({ minutes: 20, category_id: 'music', title: 'Drums' })).id, 0);          // music: missed
    add(card({ minutes: 120, category_id: 'fun', title: 'D&D', kind: 'choice' }));            // fun: still open today
    add(card({ minutes: 60, category_id: 'outdoors', title: 'Outside', date: day(20) }));     // Sunday: unconfirmed
    add(card({ minutes: 30, category_id: 'story', title: 'Recap', date: day(22) }));          // Tuesday: open
    const gone = add(card({ minutes: 90, title: 'Dropped' }));
    w.call(MOM, 'drop_card', { p_card_id: gone.id });                                         // not counted
    add({ place: 'week', title: 'Pool', category_id: 'music', minutes: 20 });                 // not on a day: not counted
    w.call(MOM, 'close_day', { p_child_id: KID, p_date: day(19) });
    w.call(MOM, 'set_day_mark', { p_child_id: KID, p_date: day(22), p_kind: 'rest' });
    const s = w.call(LAPTOP, 'get_stats', { p_child_id: KID, p_from: day(20), p_to: day(22) });
    assert.deepEqual(s.totals, {
      planned_min: 305, spent_min: 53, structured_planned_min: 125, structured_spent_min: 53,
      done: 1, partial: 1, missed: 1, unconfirmed: 1, open: 2, must_planned: 5, must_done: 1,
    });
    assert.deepEqual(s.by_category, [
      { category_id: 'academics', planned_min: 75, spent_min: 53 },
      { category_id: 'fun', planned_min: 120, spent_min: 0 },
      { category_id: 'music', planned_min: 20, spent_min: 0 },
      { category_id: 'outdoors', planned_min: 60, spent_min: 0 },
      { category_id: 'story', planned_min: 30, spent_min: 0 },
    ]);
    assert.deepEqual(s.by_day, [
      { date: day(20), planned_min: 60, spent_min: 0, done: 0, partial: 0, missed: 0, unconfirmed: 1, open: 0, closed: false, mark: null },
      { date: MON, planned_min: 215, spent_min: 53, done: 1, partial: 1, missed: 1, unconfirmed: 0, open: 1, closed: false, mark: null },
      { date: day(22), planned_min: 30, spent_min: 0, done: 0, partial: 0, missed: 0, unconfirmed: 0, open: 1, closed: false, mark: 'rest' },
    ]);
    assert.deepEqual(s.tray, { count: 2, minutes: 45 });                  // 25 left of the set + 20 of drums
    assert.equal(s.structured_weekly_max_min, 540);
    assert.equal(s.today, MON);
    failsWith(() => w.call(MOM, 'get_stats', { p_child_id: KID, p_from: day(22), p_to: day(20) }), 'bad_input');
    failsWith(() => w.call(MOM, 'get_stats', { p_child_id: KID, p_from: '2025-01-01', p_to: day(22) }), 'bad_input');
  });

  test(`[${w.name}] the weekly check-in: keep, change, stop, start`, () => {
    start();
    assert.equal(w.call(LAPTOP, 'get_review', { p_child_id: KID, p_week_start: MON }), null);
    const r = w.call(LAPTOP, 'save_review', { p_child_id: KID, p_week_start: day(24), p_review: {
      keep: 'Morning focus block', change: 'Music before lunch', stop: '', start: 'Recap right after the session' } });
    assert.equal(r.week_start, MON);
    assert.equal(r.keep, 'Morning focus block');
    assert.equal(r.stop, null);
    assert.equal(r.notes, null);
    w.call(MOM, 'save_review', { p_child_id: KID, p_week_start: MON, p_review: { keep: 'Morning block', notes: 'Agreed' } });
    const got = w.call(MOM, 'get_review', { p_child_id: KID, p_week_start: day(27) });
    assert.equal(got.keep, 'Morning block');
    assert.equal(got.change, null);                       // saving replaces the whole review
    assert.equal(got.notes, 'Agreed');
    failsWith(() => w.call(MOM, 'save_review', { p_child_id: KID, p_week_start: MON, p_review: 'text' }), 'bad_input');
  });

  test(`[${w.name}] backup: export, wipe by import, and get the same board back`, () => {
    start();
    const g = w.call(MOM, 'save_goal', { p_child_id: KID, p_goal: { scope: 'week', title: 'Write a one-shot', category_id: 'story' } });
    const a = add(card({ minutes: 60, goal_id: g.id, start_min: 540 }));
    resolve(a.id, 50, { p_note: 'Half' });
    add({ place: 'week', title: 'Music practice', category_id: 'music', minutes: 20 });
    w.call(MOM, 'set_day_mark', { p_child_id: KID, p_date: day(26), p_kind: 'away' });
    w.call(MOM, 'close_day', { p_child_id: KID, p_date: day(20), p_mood: 4 });
    w.call(MOM, 'set_parent_note', { p_child_id: KID, p_date: MON, p_text: 'Hello' });
    w.call(LAPTOP, 'mark_word_used', { p_child_id: KID, p_used: true });
    w.call(MOM, 'save_review', { p_child_id: KID, p_week_start: MON, p_review: { keep: 'k' } });
    w.call(MOM, 'rotate_automation_token');
    const doc = w.call(MOM, 'export_data');
    assert.equal(doc.version, 1);
    assert.equal(doc.tables.cards.length, 3);
    assert.equal(doc.tables.cards[1].carried_from_id, a.id);
    assert.equal(JSON.stringify(doc).includes('pin_hash'), false);         // secrets never leave
    assert.equal(JSON.stringify(doc).includes('automation_token'), false);
    assert.equal(JSON.stringify(doc).includes('example.com'), false);
    assert.deepEqual(Object.keys(doc.tables).sort(), ['app_config', 'cards', 'categories', 'children', 'closeouts',
      'day_marks', 'encouragements', 'goals', 'library_items', 'parent_notes', 'reviews', 'word_uses', 'words']);

    add(card({ title: 'Added after the backup' }));
    const counts = w.call(MOM, 'import_data', { p_data: doc });
    assert.deepEqual(counts, { children: 1, categories: 9, library_items: 3, words: 3, encouragements: 2, goals: 1, cards: 3 });
    const again = w.call(MOM, 'export_data');
    assert.deepEqual(again.tables, doc.tables);
    assert.equal(w.call(LAPTOP, 'whoami').role, 'kid');                    // devices and the PIN survive a restore
    failsWith(() => w.call(LAPTOP, 'export_data'), 'not_parent');
    failsWith(() => w.call(MOM, 'import_data', { p_data: { version: 2, tables: {} } }), 'bad_input');
    failsWith(() => w.call(MOM, 'import_data', { p_data: { version: 1, tables: { cards: [{ id: KID, child_id: KID, title: 'x' }] } } }), 'bad_input');
    assert.deepEqual(w.call(MOM, 'export_data').tables, doc.tables);       // a failed import changes nothing
  });

  test(`[${w.name}] automation calls need the key`, () => {
    start();
    const range = { p_from: day(21), p_to: day(27) };
    failsWith(() => w.call(null, 'automation_summary', { p_token: 'x'.repeat(64), ...range }), 'bad_token');
    const { token } = w.call(MOM, 'rotate_automation_token');
    failsWith(() => w.call(null, 'automation_summary', { p_token: 'x'.repeat(64), ...range }), 'bad_token');
    failsWith(() => w.call(null, 'automation_export', { p_token: 'short' }), 'bad_token');
    failsWith(() => w.call(null, 'automation_schedule', { p_token: null, ...range }), 'bad_token');

    const half = add(card({ minutes: 60, start_min: 540 }));
    resolve(half.id, 50, { p_note: 'Play date' });
    add(card({ title: 'No clock time' }));
    add(card({ title: 'Outside', category_id: 'outdoors', date: day(22), start_min: 780, minutes: 60, kind: 'choice' }));
    const must = add({ place: 'week', title: 'Pack', category_id: 'home', minutes: 15, due_date: day(23) });
    w.call(LAPTOP, 'drop_card', { p_card_id: must.id, p_reason: 'Not going' });
    w.call(MOM, 'save_goal', { p_child_id: KID, p_goal: { scope: 'week', title: 'Write a one-shot', category_id: 'story' } });
    w.call(MOM, 'save_review', { p_child_id: KID, p_week_start: MON, p_review: { keep: 'Mornings' } });

    const s = w.call(null, 'automation_summary', { p_token: token, ...range });
    assert.equal(s.family_name, 'Our family');
    assert.deepEqual(s.parent_emails, ['mom@example.com', 'dad@example.com']);
    assert.equal(s.catchup_alert_threshold, 5);
    assert.equal(s.today, MON);
    assert.equal(s.categories.length, 9);
    assert.equal(s.children.length, 1);
    const kid = s.children[0];
    assert.deepEqual(kid.child, { id: KID, name: 'Anush', avatar: 'd20', theme: 'forest' });
    assert.equal(kid.stats.totals.planned_min, 150);
    assert.deepEqual(kid.tray, [{ title: 'Math Academy lesson', minutes: 30, kind: 'must', category_id: 'academics' }]);
    assert.deepEqual(kid.drop_requests, [{ title: 'Pack', reason: 'Not going' }]);
    assert.deepEqual(kid.must_open.map((m: any) => m.title), ['Pack', 'Math Academy lesson', 'No clock time']);
    assert.deepEqual(kid.goals, [{ title: 'Write a one-shot', scope: 'week', status: 'active', category_id: 'story' }]);
    assert.deepEqual(kid.partial_notes, [{ date: MON, title: 'Math Academy lesson', pct: 50, note: 'Play date' }]);
    assert.equal(kid.review.keep, 'Mornings');

    const sched = w.call(null, 'automation_schedule', { p_token: token, ...range });
    assert.deepEqual(sched.map((x: any) => [x.title, x.date, x.start_min, x.minutes, x.status, x.category_name, x.child_name]), [
      ['Math Academy lesson', MON, 540, 60, 'resolved', 'Math & School', 'Anush'],
      ['Outside', day(22), 780, 60, 'open', 'Outdoors & Scouts', 'Anush'],
    ]);
    assert.equal(w.call(null, 'automation_export', { p_token: token }).version, 1);
    failsWith(() => w.call(null, 'automation_summary', { p_token: token, p_from: day(27), p_to: day(21) }), 'bad_input');
    const next = w.call(MOM, 'rotate_automation_token').token;
    failsWith(() => w.call(null, 'automation_export', { p_token: token }), 'bad_token');     // the old key stops working
    assert.equal(w.call(null, 'automation_export', { p_token: next }).version, 1);
  });

  test(`[${w.name}] the starter plan loads once`, () => {
    start();
    const plan = {
      goals: [{ scope: 'week', period_start: day(23), title: 'Write a one-shot', category_id: 'story' },
        { scope: 'month', period_start: day(23), title: 'Run my one-shot' }],
      cards: [
        { title: 'Music practice', category_id: 'music', minutes: 20, kind: 'must', place: 'week', week_start: day(22), count: 3 },
        { title: 'Outline the one-shot', category_id: 'story', minutes: 30, place: 'day', date: MON, start_min: 585 },
      ],
    };
    assert.deepEqual(w.starterPlan(KID, plan), { skipped: false, goals: 2, cards: 4 });
    const b = w.call(MOM, 'get_board', { p_child_id: KID, p_from: MON, p_to: day(27) });
    assert.equal(b.pool.length, 3);
    assert.equal(b.pool[0].kind, 'must');
    assert.equal(b.pool[0].created_by, 'parent');
    assert.equal(b.pool[0].week_start, MON);
    assert.equal(b.cards[0].created_by, 'system');
    assert.equal(b.cards[0].kind, 'choice');
    assert.deepEqual(b.goals.map((g: any) => [g.scope, g.period_start, g.created_by]),
      [['month', '2026-12-01', 'system'], ['week', MON, 'system']]);
    assert.deepEqual(w.starterPlan(KID, plan), { skipped: true, goals: 0, cards: 0 });
  });

  test(`[${w.name}] the kitchen display sees today and stats, read-only`, () => {
    start();
    const p = w.call(KITCHEN, 'device_start_pairing', { p_label: 'Kitchen' });
    w.call(MOM, 'device_approve', { p_code: p.pair_code, p_child_id: KID, p_kind: 'display' });
    assert.equal(today(KITCHEN).date, MON);
    assert.equal(w.call(KITCHEN, 'get_stats', { p_child_id: KID, p_from: MON, p_to: MON }).by_day.length, 1);
    failsWith(() => w.call(KITCHEN, 'mark_word_used', { p_child_id: KID, p_used: true }), 'not_allowed');
    failsWith(() => w.call(KITCHEN, 'save_review', { p_child_id: KID, p_week_start: MON, p_review: {} }), 'not_allowed');
  });
}
