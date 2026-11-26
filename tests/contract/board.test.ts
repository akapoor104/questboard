// Contract tests: cards, placing, percent done with carry-over, close-out, goals, library.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './fixture.ts';
import { KID, KITCHEN, LAPTOP, MOM, PIN, TABLET, failsWith, sameInstant, worlds } from './world.ts';

const T0 = '2026-12-21T17:00:00Z';            // Monday Dec 21, 9:00 AM in Los Angeles
const MON = '2026-12-21';
const TUE = '2026-12-22';
const SUN = '2026-12-20';
/* eslint-disable @typescript-eslint/no-explicit-any */

for (const w of worlds()) {
  /** Fresh family: Mom is a parent, the laptop is linked and unlocked. */
  const start = () => {
    w.setNow(T0);
    w.reset(fixture());
    w.call(MOM, 'claim_parent');
    const p = w.call(LAPTOP, 'device_start_pairing', { p_label: 'Laptop' });
    w.call(MOM, 'device_approve', { p_code: p.pair_code, p_child_id: KID });
    w.call(LAPTOP, 'kid_unlock', { p_pin: PIN });
  };
  const add = (who: any, card: any) => w.call(who, 'add_cards', { p_child_id: KID, p_cards: [card] })[0];
  const dayCard = (extra: any = {}) =>
    ({ place: 'day', date: MON, title: 'Math Academy lesson', category_id: 'academics', minutes: 30, ...extra });
  const board = (who: any = MOM, from = MON, to = '2026-12-27') =>
    w.call(who, 'get_board', { p_child_id: KID, p_from: from, p_to: to });
  const titles = (cards: any[]) => cards.map((c) => c.title);

  test(`[${w.name}] a parent adds must-dos to a day or to the week`, () => {
    start();
    const [a, b] = w.call(MOM, 'add_cards', { p_child_id: KID, p_cards: [
      dayCard({ start_min: 540, title: '  Math Academy lesson ', due_date: '2026-12-23', details: 'Unit 4' }),
      { place: 'week', week_start: '2026-12-24', title: 'Music practice', category_id: 'music', minutes: 20,
        kind: 'choice', library_item_id: 'lib-recap', sort: 2.5 },
    ] });
    assert.equal(a.title, 'Math Academy lesson');
    assert.equal(a.kind, 'must');
    assert.equal(a.created_by, 'parent');
    assert.equal(a.place, 'day');
    assert.equal(a.date, MON);
    assert.equal(a.start_min, 540);
    assert.equal(a.status, 'open');
    assert.equal(a.pct, null);
    assert.equal(a.root_id, a.id);
    assert.equal(a.due_date, '2026-12-23');
    assert.equal(a.details, 'Unit 4');
    assert.ok(sameInstant(a.created_at, T0));
    assert.equal(b.place, 'week');
    assert.equal(b.week_start, MON);                    // any date in the week becomes its Monday
    assert.equal(b.date, null);
    assert.equal(b.kind, 'choice');
    assert.equal(b.sort, 2.5);
    assert.equal(b.library_item_id, 'lib-recap');
    for (const bad of [
      { ...dayCard(), place: 'moon' }, { ...dayCard(), date: undefined }, { ...dayCard(), date: 'tomorrow' },
      dayCard({ minutes: 3 }), dayCard({ minutes: 481 }), dayCard({ minutes: 'lots' }), dayCard({ minutes: undefined }),
      dayCard({ start_min: 7 }), dayCard({ start_min: 1440 }), dayCard({ category_id: 'nope' }),
      dayCard({ title: '   ' }), dayCard({ title: undefined }), dayCard({ kind: 'maybe' }),
      dayCard({ library_item_id: 'nope' }), dayCard({ goal_id: KID }), 'not a card',
    ]) {
      failsWith(() => w.call(MOM, 'add_cards', { p_child_id: KID, p_cards: [bad] }), 'bad_input');
    }
    failsWith(() => w.call(MOM, 'add_cards', { p_child_id: KID, p_cards: [] }), 'bad_input');
    failsWith(() => w.call(MOM, 'add_cards', { p_child_id: KID, p_cards: Array(61).fill(dayCard()) }), 'bad_input');
    failsWith(() => w.call(MOM, 'add_cards', { p_child_id: MOM.sub, p_cards: [dayCard()] }), 'not_found');
    assert.equal(board().cards.length, 1);              // failed batches add nothing
  });

  test(`[${w.name}] his own cards are always "choice", and never in the past`, () => {
    start();
    const c = add(LAPTOP, dayCard({ kind: 'must', title: 'Draw a map', category_id: 'story' }));
    assert.equal(c.kind, 'choice');
    assert.equal(c.created_by, 'kid');
    failsWith(() => add(LAPTOP, dayCard({ date: SUN })), 'past_date');
    failsWith(() => add(LAPTOP, { ...dayCard(), place: 'week', week_start: '2026-12-14' }), 'past_date');
    assert.equal(add(LAPTOP, { ...dayCard(), place: 'week', date: undefined }).week_start, MON);
    assert.equal(add(MOM, dayCard({ date: SUN })).date, SUN);       // a parent may backfill
  });

  test(`[${w.name}] the board groups cards by day, week stack, tray and unconfirmed`, () => {
    start();
    add(MOM, dayCard({ title: 'B no time' }));
    add(MOM, dayCard({ title: 'A at 9', start_min: 540 }));
    add(MOM, dayCard({ title: 'C at 8', start_min: 480 }));
    add(MOM, dayCard({ title: 'D first by sort', sort: -1 }));
    add(MOM, dayCard({ title: 'Tuesday', date: TUE }));
    add(MOM, dayCard({ title: 'Sunday leftover', date: SUN }));
    add(MOM, { place: 'week', title: 'This week', category_id: 'music', minutes: 20 });
    add(MOM, { place: 'week', week_start: '2026-12-28', title: 'Next week', category_id: 'music', minutes: 20 });
    const dropped = add(MOM, dayCard({ title: 'Dropped' }));
    w.call(MOM, 'drop_card', { p_card_id: dropped.id });
    const b = board();
    assert.equal(b.today, MON);
    assert.deepEqual(titles(b.cards), ['C at 8', 'A at 9', 'D first by sort', 'B no time', 'Tuesday']);
    assert.deepEqual(titles(b.pool), ['This week']);
    assert.deepEqual(titles(b.unconfirmed), ['Sunday leftover']);
    assert.deepEqual(b.tray, []);
    assert.deepEqual(titles(board(MOM, '2026-12-23', '2026-12-30').pool), ['This week', 'Next week']);
    failsWith(() => board(MOM, TUE, MON), 'bad_input');
    failsWith(() => board(MOM, '2026-10-01', '2026-12-31'), 'bad_input');
    w.call(LAPTOP, 'kid_lock');
    failsWith(() => board(LAPTOP), 'locked');
    failsWith(() => board(TABLET), 'not_allowed');
    failsWith(() => board(null), 'not_signed_in');
  });

  test(`[${w.name}] editing: parents edit anything, he edits only his own picks`, () => {
    start();
    const must = add(MOM, dayCard());
    const mine = add(LAPTOP, dayCard({ title: 'Draw a map', category_id: 'story' }));
    const up = w.call(MOM, 'update_card', { p_card_id: must.id, p_patch: {
      title: ' Mr Math set ', minutes: 45, kind: 'choice', details: 'p. 12', due_date: TUE } });
    assert.equal(up.title, 'Mr Math set');
    assert.equal(up.minutes, 45);
    assert.equal(up.kind, 'choice');
    assert.equal(up.due_date, TUE);
    w.call(MOM, 'update_card', { p_card_id: must.id, p_patch: { kind: 'must', details: null, due_date: null } });
    failsWith(() => w.call(LAPTOP, 'update_card', { p_card_id: must.id, p_patch: { minutes: 5 } }), 'not_allowed');
    failsWith(() => w.call(LAPTOP, 'update_card', { p_card_id: mine.id, p_patch: { kind: 'must' } }), 'not_allowed');
    assert.equal(w.call(LAPTOP, 'update_card', { p_card_id: mine.id, p_patch: { minutes: 40 } }).minutes, 40);
    for (const bad of [{ minutes: 0 }, { title: '' }, { category_id: 'nope' }, { due_date: 'soon' }, { goal_id: KID }]) {
      failsWith(() => w.call(MOM, 'update_card', { p_card_id: mine.id, p_patch: bad }), 'bad_input');
    }
    failsWith(() => w.call(MOM, 'update_card', { p_card_id: KID, p_patch: {} }), 'not_found');
    w.call(MOM, 'resolve_card', { p_card_id: mine.id, p_pct: 100 });
    failsWith(() => w.call(MOM, 'update_card', { p_card_id: mine.id, p_patch: { minutes: 10 } }), 'not_open');
  });

  test(`[${w.name}] placing a card on a day and a clock time`, () => {
    start();
    const c = add(MOM, { place: 'week', title: 'Music practice', category_id: 'music', minutes: 20 });
    const d = w.call(LAPTOP, 'place_card', { p_card_id: c.id, p_place: 'day', p_date: TUE, p_start_min: 600, p_sort: 3 });
    assert.equal(d.place, 'day');
    assert.equal(d.date, TUE);
    assert.equal(d.start_min, 600);
    assert.equal(d.week_start, null);
    assert.equal(d.sort, 3);
    assert.equal(w.call(LAPTOP, 'place_card', { p_card_id: c.id, p_place: 'day', p_date: TUE }).start_min, null);
    failsWith(() => w.call(LAPTOP, 'place_card', { p_card_id: c.id, p_place: 'day', p_date: SUN }), 'past_date');
    failsWith(() => w.call(LAPTOP, 'place_card', { p_card_id: c.id, p_place: 'day' }), 'bad_input');
    failsWith(() => w.call(LAPTOP, 'place_card', { p_card_id: c.id, p_place: 'day', p_date: TUE, p_start_min: 601 }), 'bad_input');
    failsWith(() => w.call(LAPTOP, 'place_card', { p_card_id: c.id, p_place: 'shelf' }), 'bad_input');
    failsWith(() => w.call(LAPTOP, 'place_card', { p_card_id: c.id, p_place: 'week', p_week_start: '2026-12-14' }), 'past_date');
    const back = w.call(LAPTOP, 'place_card', { p_card_id: c.id, p_place: 'week', p_week_start: '2026-12-30' });
    assert.equal(back.place, 'week');
    assert.equal(back.week_start, '2026-12-28');
    assert.equal(back.date, null);
    assert.equal(back.sort, 3);
    assert.equal(w.call(MOM, 'place_card', { p_card_id: c.id, p_place: 'day', p_date: SUN }).date, SUN);
  });

  test(`[${w.name}] only one card is "doing" at a time`, () => {
    start();
    const a = add(MOM, dayCard({ start_min: 540 }));
    const b = add(MOM, { place: 'week', title: 'Music practice', category_id: 'music', minutes: 20 });
    const a1 = w.call(LAPTOP, 'start_card', { p_card_id: a.id });
    assert.ok(sameInstant(a1.doing_since, T0));
    assert.equal(a1.start_min, 540);
    w.setNow('2026-12-21T17:20:00Z');
    const b1 = w.call(LAPTOP, 'start_card', { p_card_id: b.id });
    assert.equal(b1.place, 'day');
    assert.equal(b1.date, MON);
    assert.equal(b1.start_min, null);
    const cards = board().cards;
    assert.deepEqual(cards.filter((c: any) => c.doing_since !== null).map((c: any) => c.title), ['Music practice']);
    assert.equal(w.call(LAPTOP, 'stop_card', { p_card_id: b.id }).doing_since, null);
    w.call(LAPTOP, 'start_card', { p_card_id: a.id });
    const moved = w.call(LAPTOP, 'place_card', { p_card_id: a.id, p_place: 'day', p_date: TUE });
    assert.equal(moved.doing_since, null);              // moving it off today stops it
  });

  test(`[${w.name}] percent done: the remainder is carried, rounded to 5 minutes`, () => {
    start();
    const hour = add(MOM, dayCard({ title: 'Self-study', minutes: 60, start_min: 840, due_date: TUE }));
    const r = w.call(LAPTOP, 'resolve_card', { p_card_id: hour.id, p_pct: 50, p_note: '  Play date ran long  ' });
    assert.equal(r.card.status, 'resolved');
    assert.equal(r.card.pct, 50);
    assert.equal(r.card.note, 'Play date ran long');
    assert.equal(r.card.start_min, 840);
    assert.ok(sameInstant(r.card.resolved_at, T0));
    assert.equal(r.carry.place, 'tray');
    assert.equal(r.carry.minutes, 30);
    assert.equal(r.carry.kind, 'must');
    assert.equal(r.carry.title, 'Self-study');
    assert.equal(r.carry.root_id, hour.id);
    assert.equal(r.carry.carried_from_id, hour.id);
    assert.equal(r.carry.due_date, TUE);
    assert.equal(r.carry.status, 'open');
    assert.deepEqual(titles(board().tray), ['Self-study']);
    failsWith(() => w.call(LAPTOP, 'resolve_card', { p_card_id: hour.id, p_pct: 100 }), 'not_open');

    const rounding: Array<[number, number, number]> = [
      [45, 50, 25], [45, 0, 45], [10, 99, 5], [20, 75, 5], [90, 25, 70], [7, 0, 5], [480, 1, 475],
    ];
    for (const [minutes, pct, left] of rounding) {
      const c = add(MOM, dayCard({ minutes }));
      assert.equal(w.call(MOM, 'resolve_card', { p_card_id: c.id, p_pct: pct }).carry.minutes, left,
        `${minutes} min at ${pct}%`);
    }
    const done = add(MOM, dayCard());
    assert.equal(w.call(LAPTOP, 'resolve_card', { p_card_id: done.id, p_pct: 100 }).carry, null);
    for (const pct of [-1, 101, null]) {
      const c = add(MOM, dayCard());
      failsWith(() => w.call(MOM, 'resolve_card', { p_card_id: c.id, p_pct: pct }), 'bad_input');
    }
  });

  test(`[${w.name}] the remainder can go to a new day, or be let go`, () => {
    start();
    const a = add(MOM, dayCard({ minutes: 40 }));
    const r = w.call(LAPTOP, 'resolve_card', { p_card_id: a.id, p_pct: 25, p_remainder: 'day',
      p_new_date: TUE, p_new_start_min: 600 });
    assert.equal(r.carry.place, 'day');
    assert.equal(r.carry.date, TUE);
    assert.equal(r.carry.start_min, 600);
    assert.equal(r.carry.minutes, 30);
    const b = add(MOM, dayCard());
    failsWith(() => w.call(LAPTOP, 'resolve_card', { p_card_id: b.id, p_pct: 50, p_remainder: 'day' }), 'bad_input');
    failsWith(() => w.call(LAPTOP, 'resolve_card', { p_card_id: b.id, p_pct: 50, p_remainder: 'day', p_new_date: SUN }), 'bad_input');
    failsWith(() => w.call(LAPTOP, 'resolve_card', { p_card_id: b.id, p_pct: 50, p_remainder: 'bin' }), 'bad_input');
    failsWith(() => w.call(LAPTOP, 'resolve_card', { p_card_id: b.id, p_pct: 50, p_remainder: 'let_go' }), 'must_needs_parent');
    assert.equal(w.call(MOM, 'resolve_card', { p_card_id: b.id, p_pct: 50, p_remainder: 'let_go' }).carry, null);
    const mine = add(LAPTOP, dayCard({ title: 'Draw a map', category_id: 'story' }));
    assert.equal(w.call(LAPTOP, 'resolve_card', { p_card_id: mine.id, p_pct: 0, p_remainder: 'let_go' }).carry, null);
    assert.equal(w.call(LAPTOP, 'resolve_card', { p_card_id: add(MOM, dayCard()).id, p_pct: 100, p_remainder: 'let_go' }).card.pct, 100);
  });

  test(`[${w.name}] cards from the week stack, the tray and past days can be resolved; future ones cannot`, () => {
    start();
    const pool = add(MOM, { place: 'week', title: 'Music practice', category_id: 'music', minutes: 20 });
    const p = w.call(LAPTOP, 'resolve_card', { p_card_id: pool.id, p_pct: 100 });
    assert.equal(p.card.place, 'day');
    assert.equal(p.card.date, MON);
    assert.equal(p.card.week_start, null);
    const old = add(MOM, dayCard({ date: SUN, minutes: 60 }));
    const o = w.call(LAPTOP, 'resolve_card', { p_card_id: old.id, p_pct: 0 });
    assert.equal(o.card.date, SUN);                      // stays on the day it was planned
    assert.equal(o.carry.minutes, 60);
    const t = w.call(LAPTOP, 'resolve_card', { p_card_id: o.carry.id, p_pct: 50 });
    assert.equal(t.card.date, MON);
    assert.equal(t.carry.minutes, 30);
    assert.equal(t.carry.root_id, old.id);               // the chain keeps its origin
    assert.equal(t.carry.carried_from_id, o.carry.id);
    const future = add(MOM, dayCard({ date: TUE }));
    failsWith(() => w.call(LAPTOP, 'resolve_card', { p_card_id: future.id, p_pct: 100 }), 'future_card');
  });

  test(`[${w.name}] reopening undoes a percent, unless the leftover was already used`, () => {
    start();
    const a = add(MOM, dayCard({ minutes: 60 }));
    const r = w.call(LAPTOP, 'resolve_card', { p_card_id: a.id, p_pct: 50 });
    const back = w.call(LAPTOP, 'reopen_card', { p_card_id: a.id });
    assert.equal(back.status, 'open');
    assert.equal(back.pct, null);
    assert.equal(back.note, null);
    assert.deepEqual(board().tray, []);
    failsWith(() => w.call(LAPTOP, 'reopen_card', { p_card_id: a.id }), 'not_resolved');
    failsWith(() => w.call(LAPTOP, 'reopen_card', { p_card_id: r.carry.id }), 'not_found');

    const r2 = w.call(LAPTOP, 'resolve_card', { p_card_id: a.id, p_pct: 50 });
    w.call(LAPTOP, 'resolve_card', { p_card_id: r2.carry.id, p_pct: 100 });
    failsWith(() => w.call(LAPTOP, 'reopen_card', { p_card_id: a.id }), 'carry_in_use');

    const sat = add(MOM, dayCard({ date: '2026-12-19' }));
    w.call(MOM, 'resolve_card', { p_card_id: sat.id, p_pct: 100 });
    failsWith(() => w.call(LAPTOP, 'reopen_card', { p_card_id: sat.id }), 'not_allowed');   // older than yesterday
    assert.equal(w.call(MOM, 'reopen_card', { p_card_id: sat.id }).status, 'open');
  });

  test(`[${w.name}] dropping: his own picks go at once, must-dos need a parent`, () => {
    start();
    const mine = add(LAPTOP, dayCard({ title: 'Draw a map', category_id: 'story' }));
    const d = w.call(LAPTOP, 'drop_card', { p_card_id: mine.id, p_reason: ' Changed my mind ' });
    assert.equal(d.requested, false);
    assert.equal(d.card.status, 'dropped');
    assert.equal(d.card.drop_reason, 'Changed my mind');
    failsWith(() => w.call(LAPTOP, 'drop_card', { p_card_id: mine.id }), 'not_open');

    const must = add(MOM, dayCard());
    const q = w.call(LAPTOP, 'drop_card', { p_card_id: must.id, p_reason: 'Guests all weekend' });
    assert.equal(q.requested, true);
    assert.equal(q.card.status, 'open');
    assert.ok(sameInstant(q.card.drop_requested_at, T0));
    assert.deepEqual(titles(board().drop_requests), ['Math Academy lesson']);
    failsWith(() => w.call(LAPTOP, 'decide_drop', { p_card_id: must.id, p_approve: true }), 'not_parent');
    const kept = w.call(MOM, 'decide_drop', { p_card_id: must.id, p_approve: false });
    assert.equal(kept.status, 'open');
    assert.equal(kept.drop_requested_at, null);
    assert.equal(kept.drop_reason, null);
    failsWith(() => w.call(MOM, 'decide_drop', { p_card_id: must.id, p_approve: true }), 'not_found');
    w.call(LAPTOP, 'drop_card', { p_card_id: must.id, p_reason: 'Still no time' });
    const gone = w.call(MOM, 'decide_drop', { p_card_id: must.id, p_approve: true });
    assert.equal(gone.status, 'dropped');
    assert.equal(gone.drop_reason, 'Still no time');
    assert.equal(w.call(MOM, 'drop_card', { p_card_id: add(MOM, dayCard()).id }).card.status, 'dropped');

    const del = add(MOM, dayCard());
    failsWith(() => w.call(LAPTOP, 'delete_card', { p_card_id: del.id }), 'not_parent');
    assert.deepEqual(w.call(MOM, 'delete_card', { p_card_id: del.id }), { ok: true });
    failsWith(() => w.call(MOM, 'delete_card', { p_card_id: del.id }), 'not_found');
  });

  test(`[${w.name}] a day can be closed out only when every card has a percent`, () => {
    start();
    const a = add(MOM, dayCard());
    failsWith(() => w.call(LAPTOP, 'close_day', { p_child_id: KID }), 'open_cards');
    w.call(LAPTOP, 'resolve_card', { p_card_id: a.id, p_pct: 50 });
    const c = w.call(LAPTOP, 'close_day', { p_child_id: KID, p_mood: 4, p_note: ' Good day ' });
    assert.equal(c.date, MON);
    assert.equal(c.mood, 4);
    assert.equal(c.note, 'Good day');
    assert.ok(sameInstant(c.closed_at, T0));
    assert.equal(board().closeouts.length, 1);
    assert.equal(w.call(LAPTOP, 'close_day', { p_child_id: KID, p_date: SUN }).date, SUN);   // an empty day
    failsWith(() => w.call(LAPTOP, 'close_day', { p_child_id: KID, p_date: TUE }), 'bad_input');
    failsWith(() => w.call(LAPTOP, 'close_day', { p_child_id: KID, p_mood: 6 }), 'bad_input');
    w.call(LAPTOP, 'reopen_card', { p_card_id: a.id });
    assert.deepEqual(board(MOM, SUN).closeouts.map((x: any) => x.date), [SUN]);   // reopening un-closes that day
  });

  test(`[${w.name}] parents mark days as Away or Rest`, () => {
    start();
    const m = w.call(MOM, 'set_day_mark', { p_child_id: KID, p_date: '2026-12-26', p_kind: 'away', p_note: ' Trip ' });
    assert.deepEqual(m, { child_id: KID, date: '2026-12-26', kind: 'away', note: 'Trip' });
    w.call(MOM, 'set_day_mark', { p_child_id: KID, p_date: '2026-12-26', p_kind: 'rest' });
    w.call(MOM, 'set_day_mark', { p_child_id: KID, p_date: '2026-12-24', p_kind: 'rest' });
    assert.deepEqual(board().day_marks.map((x: any) => [x.date, x.kind, x.note]),
      [['2026-12-24', 'rest', null], ['2026-12-26', 'rest', null]]);
    assert.equal(w.call(MOM, 'set_day_mark', { p_child_id: KID, p_date: '2026-12-24', p_kind: null }), null);
    assert.equal(board().day_marks.length, 1);
    failsWith(() => w.call(MOM, 'set_day_mark', { p_child_id: KID, p_date: '2026-12-24', p_kind: 'party' }), 'bad_input');
    failsWith(() => w.call(LAPTOP, 'set_day_mark', { p_child_id: KID, p_date: '2026-12-24', p_kind: 'rest' }), 'not_parent');
  });

  test(`[${w.name}] weekly focus areas and monthly goals`, () => {
    start();
    const g = w.call(MOM, 'save_goal', { p_child_id: KID, p_goal: {
      scope: 'week', period_start: '2026-12-23', title: ' Write a one-shot ', category_id: 'story', note: 'For family' } });
    assert.equal(g.period_start, MON);
    assert.equal(g.title, 'Write a one-shot');
    assert.equal(g.status, 'active');
    assert.equal(g.created_by, 'parent');
    const m = w.call(LAPTOP, 'save_goal', { p_child_id: KID, p_goal: { scope: 'month', title: 'Run my one-shot' } });
    assert.equal(m.period_start, '2026-12-01');
    assert.equal(m.created_by, 'kid');
    const c = add(MOM, dayCard({ goal_id: g.id }));
    assert.equal(c.goal_id, g.id);
    assert.deepEqual(titles(board().goals), ['Run my one-shot', 'Write a one-shot']);
    const done = w.call(LAPTOP, 'save_goal', { p_child_id: KID, p_goal: { id: g.id, status: 'done', note: null, sort: 2 } });
    assert.equal(done.status, 'done');
    assert.equal(done.note, null);
    assert.equal(done.title, 'Write a one-shot');
    assert.equal(done.sort, 2);
    w.call(MOM, 'save_goal', { p_child_id: KID, p_goal: { id: m.id, status: 'dropped' } });
    assert.deepEqual(titles(board().goals), ['Write a one-shot']);
    for (const bad of [{ scope: 'year', title: 'x' }, { scope: 'week' }, { scope: 'week', title: '' },
      { scope: 'week', title: 'x', category_id: 'nope' }, { id: g.id, status: 'paused' }]) {
      failsWith(() => w.call(MOM, 'save_goal', { p_child_id: KID, p_goal: bad }), 'bad_input');
    }
    failsWith(() => w.call(MOM, 'save_goal', { p_child_id: KID, p_goal: { id: KID, title: 'x' } }), 'not_found');
  });

  test(`[${w.name}] the library: everyone reads, he manages only his own ideas`, () => {
    start();
    const lib = w.call(LAPTOP, 'get_library');
    assert.equal(lib.categories.length, 9);
    assert.deepEqual(lib.categories.slice(0, 3).map((c: any) => c.id), ['academics', 'rest', 'build']);
    assert.deepEqual(titles(lib.items), ['Math Academy lesson', 'Write a session recap']);   // by category order; no retired items
    const mine = w.call(LAPTOP, 'save_library_item', { p_item: {
      title: ' Paint minis ', category_id: 'fun', minutes: 45, description: 'Two goblins', tags: ['art', 'dnd'] } });
    assert.equal(mine.source, 'kid');
    assert.equal(mine.title, 'Paint minis');
    assert.deepEqual(mine.tags, ['art', 'dnd']);
    assert.equal(mine.active, true);
    assert.equal(w.call(LAPTOP, 'save_library_item', { p_item: { id: mine.id, minutes: 30, tags: [] } }).minutes, 30);
    failsWith(() => w.call(LAPTOP, 'save_library_item', { p_item: { id: 'lib-math', minutes: 5 } }), 'not_allowed');
    failsWith(() => w.call(LAPTOP, 'archive_library_item', { p_id: 'lib-math' }), 'not_allowed');
    assert.equal(w.call(MOM, 'save_library_item', { p_item: { id: 'lib-math', minutes: 25, description: '' } }).description, null);
    assert.equal(w.call(MOM, 'save_library_item', { p_item: { title: 'Pack', category_id: 'home', minutes: 15 } }).source, 'parent');
    for (const bad of [{ title: 'x', category_id: 'nope', minutes: 10 }, { title: 'x', category_id: 'fun' },
      { category_id: 'fun', minutes: 10 }, { title: 'x', category_id: 'fun', minutes: 2 }]) {
      failsWith(() => w.call(MOM, 'save_library_item', { p_item: bad }), 'bad_input');
    }
    failsWith(() => w.call(MOM, 'save_library_item', { p_item: { id: 'ghost', minutes: 10 } }), 'not_found');
    assert.deepEqual(w.call(LAPTOP, 'archive_library_item', { p_id: mine.id }), { ok: true });
    assert.ok(!titles(w.call(MOM, 'get_library').items).includes('Paint minis'));
    failsWith(() => w.call(null, 'get_library'), 'not_allowed');
  });

  test(`[${w.name}] categories are a parent's job`, () => {
    start();
    const c = w.call(MOM, 'save_category', { p_cat: { id: 'chess', name: ' Chess ', color: 'slate', icon: 'die', kind: 'free', sort: 10 } });
    assert.deepEqual(c, { id: 'chess', name: 'Chess', color: 'slate', icon: 'die', kind: 'free', sort: 10, active: true });
    const u = w.call(MOM, 'save_category', { p_cat: { id: 'chess', name: 'Chess club', color: 'blue', icon: 'die', active: false } });
    assert.equal(u.name, 'Chess club');
    assert.equal(u.kind, 'free');
    assert.equal(u.sort, 10);
    assert.equal(u.active, false);
    for (const bad of [{ name: 'No id', color: 'blue', icon: 'x' }, { id: 'Bad Id', name: 'x', color: 'blue', icon: 'x' },
      { id: 'chess', name: 'Only a name' }, { id: 'go', name: 'Go', color: 'blue', icon: 'x', kind: 'odd' }]) {
      failsWith(() => w.call(MOM, 'save_category', { p_cat: bad }), 'bad_input');
    }
    failsWith(() => w.call(LAPTOP, 'save_category', { p_cat: { id: 'go', name: 'Go', color: 'blue', icon: 'x' } }), 'not_parent');
  });

  test(`[${w.name}] the kitchen display reads the board but cannot change it`, () => {
    start();
    const p = w.call(KITCHEN, 'device_start_pairing', { p_label: 'Kitchen' });
    w.call(MOM, 'device_approve', { p_code: p.pair_code, p_child_id: KID, p_kind: 'display' });
    const a = add(MOM, dayCard());
    assert.deepEqual(titles(board(KITCHEN).cards), ['Math Academy lesson']);
    assert.equal(w.call(KITCHEN, 'get_library').categories.length, 9);
    failsWith(() => add(KITCHEN, dayCard()), 'not_allowed');
    failsWith(() => w.call(KITCHEN, 'resolve_card', { p_card_id: a.id, p_pct: 100 }), 'not_allowed');
    failsWith(() => w.call(KITCHEN, 'start_card', { p_card_id: a.id }), 'not_allowed');
    failsWith(() => w.call(KITCHEN, 'close_day', { p_child_id: KID }), 'not_allowed');
    failsWith(() => w.call(KITCHEN, 'save_library_item', { p_item: { title: 'x', category_id: 'fun', minutes: 10 } }), 'not_allowed');
  });
}
