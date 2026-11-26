// The real seed data (seed/*.json) must load cleanly into both backends.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { KID, LAPTOP, MOM, PIN, worlds } from './world.ts';
/* eslint-disable @typescript-eslint/no-explicit-any */

const read = (name: string) => JSON.parse(readFileSync(new URL(`../../seed/${name}`, import.meta.url), 'utf8'));
const base = read('base.json');
const plan = read('starter-plan.json');

test('seed files are well formed', () => {
  const t = base.tables;
  assert.equal(base.version, 1);
  const catIds = new Set(t.categories.map((c: any) => c.id));
  assert.equal(catIds.size, 9);
  for (const it of t.library_items) {
    assert.ok(catIds.has(it.category_id), `library item ${it.id} has an unknown category`);
    assert.ok(it.minutes >= 5 && it.minutes <= 480 && it.minutes % 5 === 0, `library item ${it.id} minutes`);
    assert.ok(it.title.length >= 1 && it.title.length <= 120);
  }
  assert.equal(new Set(t.library_items.map((i: any) => i.id)).size, t.library_items.length);
  assert.equal(new Set(t.library_items.map((i: any) => i.title)).size, t.library_items.length);
  assert.deepEqual(t.words.map((w: any) => w.id), t.words.map((_: any, i: number) => i + 1));
  assert.equal(new Set(t.words.map((w: any) => w.word)).size, t.words.length);
  for (const w of t.words) {
    assert.ok(['noun', 'verb', 'adjective', 'adverb'].includes(w.part_of_speech), w.word);
    assert.ok(w.definition.endsWith('.') && w.example.length > 10, w.word);
  }
  assert.deepEqual(t.encouragements.map((e: any) => e.id), t.encouragements.map((_: any, i: number) => i + 1));
  for (const c of plan.cards) {
    assert.ok(catIds.has(c.category_id), `plan card "${c.title}" has an unknown category`);
    assert.ok(c.place === 'week' ? c.week_start : c.date, `plan card "${c.title}" needs a week or a date`);
  }
});

for (const w of worlds()) {
  test(`[${w.name}] the seed data and starter plan load, and loading twice changes nothing`, () => {
    w.setNow('2026-12-14T16:00:00Z');
    w.reset({ version: 1, tables: { children: [{ id: KID, name: 'Anush' }], ...base.tables },
      test: { parent_emails: ['mom@example.com'], pins: { [KID]: PIN } } });
    assert.deepEqual(w.starterPlan(KID, plan), { skipped: false, goals: 10, cards: 83 });
    assert.deepEqual(w.starterPlan(KID, plan), { skipped: true, goals: 0, cards: 0 });
    w.call(MOM, 'claim_parent');
    const lib = w.call(MOM, 'get_library');
    assert.equal(lib.categories.length, 9);
    assert.equal(lib.items.length, 95);
    const b = w.call(MOM, 'get_board', { p_child_id: KID, p_from: '2026-12-14', p_to: '2027-01-03' });
    assert.equal(b.pool.length, 80);
    assert.equal(b.cards.length, 3);                                  // the three Sunday check-ins
    assert.equal(b.goals.length, 10);
    const p = w.call(LAPTOP, 'device_start_pairing');
    w.call(MOM, 'device_approve', { p_code: p.pair_code, p_child_id: KID });
    w.call(LAPTOP, 'kid_unlock', { p_pin: PIN });
    const t = w.call(LAPTOP, 'get_today', { p_child_id: KID });
    assert.equal(typeof t.word.word, 'string');
    assert.equal(typeof t.encouragement, 'string');
    assert.deepEqual(w.call(MOM, 'import_data', { p_data: w.call(MOM, 'export_data') }),
      { children: 1, categories: 9, library_items: 95, words: 100, encouragements: 60, goals: 10, cards: 83 });
  });
}
