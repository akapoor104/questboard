// Differential test: the same random sequence of calls is sent to the in-memory
// backend and to PostgreSQL, and every answer (or error code) must match.
// Needs both backends, so it only runs with QB_BACKEND=both.
//   QB_BACKEND=both QB_FUZZ_OPS=400 node --test tests/parity/fuzz.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from '../contract/fixture.ts';
import { KID, LAPTOP, MOM, PIN, worlds, type World } from '../contract/world.ts';
/* eslint-disable @typescript-eslint/no-explicit-any */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Replaces ids by their order of first appearance and timestamps by their instant. */
function normalizer(): (v: any) => any {
  const ids = new Map<string, string>([[KID, 'KID'], [MOM.sub, 'MOM'], [LAPTOP.sub, 'LAPTOP']]);
  const walk = (v: any): any => {
    if (Array.isArray(v)) return v.map(walk);
    // 'seq' only orders rows; PostgreSQL sequences skip numbers after a failed insert, so its value is not compared.
    if (v && typeof v === 'object') {
      return Object.fromEntries(Object.entries(v).filter(([k]) => k !== 'seq').map(([k, x]) => [k, walk(x)]));
    }
    if (typeof v === 'string') {
      if (UUID.test(v)) {
        if (!ids.has(v)) ids.set(v, 'id' + ids.size);
        return ids.get(v);
      }
      if (STAMP.test(v)) return Date.parse(v);
    }
    return v;
  };
  return walk;
}

const pair = worlds();
const enabled = pair.length === 2;

for (const seed of [1, 2, 3]) {
  test(`parity: random calls give the same answers (seed ${seed})`, { skip: !enabled && 'needs QB_BACKEND=both' }, () => {
    const ops = Number(process.env.QB_FUZZ_OPS ?? 150);
    const r = rng(seed);
    const pick = <T>(list: T[]): T => list[Math.floor(r() * list.length)];
    const int = (lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
    let now = Date.parse('2026-12-21T17:00:00Z');
    const norm = pair.map(() => normalizer());
    const cards: string[][] = pair.map(() => []);
    const goals: string[][] = pair.map(() => []);
    const day = (offset: number) => new Date(Date.parse('2026-12-21T00:00:00Z') + offset * 86_400_000).toISOString().slice(0, 10);

    const both = (who: any, fn: string, argsFor: (i: number) => any, note = ''): any[] => {
      const outs = pair.map((w: World, i) => {
        try {
          return { ok: norm[i](w.call(who, fn, argsFor(i))), raw: null as any };
        } catch (e) {
          const m = /QB:[a-z_]+/.exec(String((e as Error).message));
          return { err: m ? m[0] : String((e as Error).message) };
        }
      });
      assert.deepEqual(outs[1], outs[0], `${fn} ${note} ${JSON.stringify(argsFor(0))}`);
      return outs;
    };
    const rawBoth = (who: any, fn: string, argsFor: (i: number) => any): any[] =>
      pair.map((w, i) => { try { return w.call(who, fn, argsFor(i)); } catch { return null; } });

    for (const w of pair) { w.setNow(new Date(now).toISOString()); w.reset(fixture()); }
    both(MOM, 'claim_parent', () => ({}));
    const codes = rawBoth(LAPTOP, 'device_start_pairing', () => ({ p_label: 'Laptop' }));
    pair.forEach((w, i) => w.call(MOM, 'device_approve', { p_code: codes[i].pair_code, p_child_id: KID }));
    both(LAPTOP, 'kid_unlock', () => ({ p_pin: PIN }));

    const cardArg = (i: number) => (cards[i].length === 0 ? KID : cards[i][int(0, cards[i].length - 1)]);
    for (let n = 0; n < ops; n++) {
      const who = r() < 0.5 ? MOM : LAPTOP;
      const k = cards[0].length === 0 ? 0 : int(0, cards[0].length - 1);
      const cid = (i: number) => cards[i][k] ?? KID;
      const roll = r();
      if (roll < 0.2) {
        const place = r() < 0.7 ? 'day' : 'week';
        const item: any = {
          place, title: pick(['Math', 'Drums', 'Recap', ' Map ', '']), minutes: pick([5, 15, 20, 30, 45, 60, 90, 7, 0, 500]),
          category_id: pick(['academics', 'music', 'story', 'fun', 'outdoors', 'home', 'nope']),
        };
        if (place === 'day') { item.date = day(int(-2, 4)); if (r() < 0.6) item.start_min = pick([480, 540, 585, 600, 780, 901]); }
        else if (r() < 0.5) item.week_start = day(int(-8, 9));
        if (r() < 0.3) item.kind = pick(['must', 'choice']);
        if (r() < 0.2) item.due_date = day(int(-1, 5));
        if (r() < 0.15 && goals[0].length > 0) item.goal_idx = int(0, goals[0].length - 1);
        const raw = pair.map((w, i) => {
          const it = { ...item };
          if (it.goal_idx !== undefined) { it.goal_id = goals[i][it.goal_idx]; delete it.goal_idx; }
          try { return w.call(who, 'add_cards', { p_child_id: KID, p_cards: [it] }); } catch (e) { return String((e as Error).message).match(/QB:[a-z_]+/)?.[0] ?? String(e); }
        });
        assert.deepEqual(typeof raw[1], typeof raw[0], 'add_cards outcome ' + JSON.stringify(item));
        if (typeof raw[0] === 'string') assert.equal(raw[1], raw[0], 'add_cards error ' + JSON.stringify(item));
        else {
          raw.forEach((x, i) => cards[i].push(x[0].id));
          assert.deepEqual(norm[1](raw[1]), norm[0](raw[0]), 'add_cards');
        }
      } else if (roll < 0.32) {
        const toDay = r() < 0.7;
        const args: any = toDay ? { p_place: 'day', p_date: day(int(-2, 4)) } : { p_place: 'week' };
        if (toDay && r() < 0.6) args.p_start_min = pick([480, 540, 600, 780, 1435, 7]);
        if (!toDay && r() < 0.5) args.p_week_start = day(int(-8, 9));
        if (r() < 0.3) args.p_sort = int(-3, 3);
        both(who, 'place_card', (i) => ({ p_card_id: cid(i), ...args }));
      } else if (roll < 0.38) {
        const fn = pick(['start_card', 'stop_card']);
        both(who, fn, (i) => ({ p_card_id: cid(i) }));
      } else if (roll < 0.58) {
        const args: any = { p_pct: pick([0, 10, 25, 50, 50, 75, 99, 100, 100, 100, 101]) };
        const rem = pick(['tray', 'tray', 'day', 'let_go', undefined]);
        if (rem) args.p_remainder = rem;
        if (rem === 'day') { if (r() < 0.9) args.p_new_date = day(int(-1, 4)); if (r() < 0.5) args.p_new_start_min = pick([540, 600, 3]); }
        if (r() < 0.3) args.p_note = pick(['  Play date ', '', 'Tired']);
        const raw = pair.map((w, i) => {
          try { return w.call(who, 'resolve_card', { p_card_id: cid(i), ...args }); } catch (e) { return String((e as Error).message).match(/QB:[a-z_]+/)?.[0] ?? String(e); }
        });
        if (typeof raw[0] === 'string' || typeof raw[1] === 'string') assert.equal(raw[1], raw[0], 'resolve_card ' + JSON.stringify(args));
        else {
          raw.forEach((x, i) => { if (x.carry) cards[i].push(x.carry.id); });
          assert.deepEqual(norm[1](raw[1]), norm[0](raw[0]), 'resolve_card ' + JSON.stringify(args));
        }
      } else if (roll < 0.63) {
        both(who, 'reopen_card', (i) => ({ p_card_id: cid(i) }));
      } else if (roll < 0.69) {
        const reason = pick(['', 'No time', '  x ']);
        both(who, 'drop_card', (i) => ({ p_card_id: cid(i), p_reason: reason }));
      } else if (roll < 0.72) {
        const approve = r() < 0.5;
        both(MOM, 'decide_drop', (i) => ({ p_card_id: cid(i), p_approve: approve }));
      } else if (roll < 0.74) {
        both(who, 'delete_card', (i) => ({ p_card_id: cid(i) }));
      } else if (roll < 0.78) {
        const patch = pick([
          { minutes: 25 }, { title: ' New title ' }, { kind: 'choice' }, { kind: 'must' }, { due_date: day(2) },
          { due_date: null, details: 'd' }, { category_id: 'music' }, { minutes: 1 }]);
        both(who, 'update_card', (i) => ({ p_card_id: cid(i), p_patch: patch }));
      } else if (roll < 0.83) {
        const close = { p_child_id: KID, p_date: day(int(-3, 1)), ...(r() < 0.3 ? { p_mood: int(0, 6) } : {}) };
        both(who, 'close_day', () => close);
      } else if (roll < 0.86) {
        const mark = { p_child_id: KID, p_date: day(int(-3, 5)), p_kind: pick(['away', 'rest', null]) };
        both(who, 'set_day_mark', () => mark);
      } else if (roll < 0.9) {
        const g: any = { scope: pick(['week', 'month', 'year']), title: pick(['Goal A', 'Goal B', '']), period_start: day(int(-9, 9)) };
        const raw = pair.map((w) => {
          try { return w.call(who, 'save_goal', { p_child_id: KID, p_goal: g }); } catch (e) { return String((e as Error).message).match(/QB:[a-z_]+/)?.[0] ?? String(e); }
        });
        if (typeof raw[0] === 'string' || typeof raw[1] === 'string') assert.equal(raw[1], raw[0], 'save_goal');
        else { raw.forEach((x, i) => goals[i].push(x.id)); assert.deepEqual(norm[1](raw[1]), norm[0](raw[0]), 'save_goal'); }
      } else if (roll < 0.94) {
        now += pick([20 * 60_000, 3 * 3_600_000, 9 * 3_600_000, 26 * 3_600_000]);
        for (const w of pair) w.setNow(new Date(now).toISOString());
        both(LAPTOP, 'kid_unlock', () => ({ p_pin: PIN }));
      } else {
        both(who, 'get_board', () => ({ p_child_id: KID, p_from: day(-7), p_to: day(14) }));
        both(who, 'get_today', () => ({ p_child_id: KID }));
        both(who, 'get_stats', () => ({ p_child_id: KID, p_from: day(-7), p_to: day(14) }));
      }
      void cardArg;
    }
    both(MOM, 'get_board', () => ({ p_child_id: KID, p_from: day(-20), p_to: day(30) }));
    both(MOM, 'get_stats', () => ({ p_child_id: KID, p_from: day(-20), p_to: day(30) }));
    both(MOM, 'export_data', () => ({}));
  });
}
