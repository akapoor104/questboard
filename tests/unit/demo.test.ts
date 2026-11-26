/* eslint-disable @typescript-eslint/no-explicit-any */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createApi } from '../../src/api/client.ts';
import { alignPlan, createDemoConnection, DEMO_PIN, DEMO_START_KEY, type KeyValueStore } from '../../src/api/demo.ts';

const read = (name: string) => JSON.parse(readFileSync(new URL(`../../seed/${name}`, import.meta.url), 'utf8'));
const seed = { base: read('base.json'), plan: read('starter-plan.json') };

function memoryStorage(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => { data.set(k, v); },
    removeItem: (k) => { data.delete(k); },
  };
}

test('demo mode: a ready family, his device linked, PIN 1234, data kept between visits', async () => {
  const storage = memoryStorage();
  const now = () => Date.parse('2026-12-21T17:00:00Z');
  const conn = createDemoConnection(storage, seed, { now });
  assert.equal(conn.mode, 'demo');
  await conn.ensureDeviceSession();
  const kid = createApi(conn.device);
  const me = await kid.whoami();
  assert.equal(me.role, 'none');                          // linked, but locked until the PIN
  assert.equal(me.device?.status, 'approved');
  const childId = me.children[0].id;
  assert.equal((await kid.kidUnlock(DEMO_PIN)).ok, true);
  assert.equal((await kid.whoami()).role, 'kid');
  const board = await kid.getBoard(childId, '2026-12-21', '2026-12-27');
  assert.ok(board.pool.length > 10);          // the first plan week, moved to this week
  const [mine] = await kid.addCards(childId, [{ title: 'Paint minis', category_id: 'fun', minutes: 45, place: 'day', date: '2026-12-21' }]);
  assert.equal(mine.kind, 'choice');

  assert.equal(await conn.parentSession(), null);
  await conn.signInParent();
  const parent = createApi(conn.parent);
  assert.equal((await parent.whoami()).role, 'parent');
  assert.equal((await parent.deviceList()).length, 1);

  // A second visit with the same storage sees the same data and the same parent sign-in.
  const again = createDemoConnection(storage, seed, { now });
  const kid2 = createApi(again.device);
  assert.equal((await kid2.whoami()).role, 'kid');
  const board2 = await kid2.getBoard(childId, '2026-12-21', '2026-12-27');
  assert.ok(board2.cards.some((c) => c.title === 'Paint minis'));
  assert.notEqual(await again.parentSession(), null);
  await again.signOutParent();
  assert.equal(await again.parentSession(), null);
  await assert.rejects(() => createApi(again.parent).deviceList(), /QB:not_signed_in/);

  again.reset();
  const fresh = createDemoConnection(storage, seed, { now });
  const board3 = await createApi(fresh.device).getBoard(childId, '2026-12-21', '2026-12-27').catch((e) => String(e));
  assert.match(String(board3), /QB:not_found|QB:locked/);  // a new family: the old child id is gone
});

test('demo mode: the starter plan is moved so its first week is this week', async () => {
  const moved = alignPlan(seed.plan, '2027-03-10') as { goals: any[]; cards: any[] };   // a Wednesday
  assert.equal(moved.cards.length, seed.plan.cards.length);
  const weeks = [...new Set(moved.cards.map((c) => c.week_start).filter(Boolean))].sort();
  assert.deepEqual(weeks, ['2027-03-08', '2027-03-15', '2027-03-22']);
  assert.ok(moved.goals.filter((g) => g.scope === 'month').every((g) => g.period_start === '2027-03-10'));
  assert.deepEqual([...new Set(moved.goals.filter((g) => g.scope === 'week').map((g) => g.period_start))].sort(),
    ['2027-03-08', '2027-03-15', '2027-03-22']);
  assert.equal(seed.plan.cards[0].week_start, '2026-12-14');          // the input is not changed

  // Opened on any date, the demo board for the current week is full.
  const now = () => Date.parse('2027-03-10T18:00:00Z');
  const conn = createDemoConnection(memoryStorage(), seed, { now });
  const kid = createApi(conn.device);
  await kid.kidUnlock(DEMO_PIN);
  const childId = (await kid.whoami()).children[0].id;
  const board = await kid.getBoard(childId, '2027-03-08', '2027-03-14');
  assert.ok(board.pool.length > 10);
  assert.equal(board.goals.filter((g) => g.scope === 'month').length, 2);
  assert.equal(board.goals.filter((g) => g.scope === 'week' && g.period_start === '2027-03-08').length, 2);
});

test('demo mode: the board starts lived-in (campfire, tray, a card in progress, a due-soon must-do)', async () => {
  const now = () => Date.parse('2026-12-21T18:06:00Z');                 // Monday 10:06 in Los Angeles
  const conn = createDemoConnection(memoryStorage(), seed, { now });
  const kid = createApi(conn.device);
  assert.equal((await kid.whoami()).role, 'none');                    // still locked: the demo opens on the PIN pad
  await kid.kidUnlock(DEMO_PIN);
  const childId = (await kid.whoami()).children[0].id;
  const today = await kid.getToday(childId);
  assert.equal(today.date, '2026-12-21');
  assert.deepEqual(today.streak, { current: 2, best: 2 });
  assert.equal(today.parent_note, 'Proud of how you planned yesterday.');
  assert.deepEqual(today.alerts, [{ type: 'tray', count: 1, minutes: 30 }, { type: 'due_soon', count: 1 }]);
  const board = await kid.getBoard(childId, '2026-12-21', '2026-12-27');
  const mine = board.cards.filter((c) => c.date === '2026-12-21');
  assert.deepEqual(mine.map((c) => [c.title, c.start_min, c.status]), [
    ['Math Academy lesson', 540, 'resolved'],
    ['Outline the winter one-shot', 600, 'open'],
    ['micro:bit: first programs', 660, 'open'],
    ['Outside time', 780, 'open'],
    ['Help cook dinner', null, 'open'],
  ]);
  assert.notEqual(mine[1].doing_since, null);
  assert.deepEqual(board.tray.map((c) => [c.title, c.minutes]), [['Mr Math problem set', 30]]);
  assert.deepEqual([...new Set(board.pool.map((c) => c.title))],
    ['Read for fun', 'Music practice', 'Plan the break together', 'Pack for the trip']);
  assert.equal(board.pool.length, 13);
  assert.equal(board.unconfirmed.length, 0);

  const plain = createDemoConnection(memoryStorage(), seed, { now, livedIn: false });
  const kid2 = createApi(plain.device);
  await kid2.kidUnlock(DEMO_PIN);
  assert.deepEqual((await kid2.getToday(childId).catch(() => null)) ?? null, null);   // a different family: other ids
  const id2 = (await kid2.whoami()).children[0].id;
  assert.deepEqual((await kid2.getToday(id2)).streak, { current: 0, best: 0 });
});

test('demo mode: an unlinked start shows the pairing flow from the beginning', async () => {
  const storage = memoryStorage();
  storage.setItem(DEMO_START_KEY, 'unlinked');
  const conn = createDemoConnection(storage, seed, { now: () => Date.parse('2026-12-21T18:06:00Z') });
  const device = createApi(conn.device);
  assert.equal((await device.whoami()).device, null);
  const pairing = await device.deviceStartPairing('Kitchen tablet');
  assert.match(String(pairing.pair_code), /^[A-Z2-9]{6}$/);
  assert.equal((await device.whoami()).device?.status, 'pending');

  await conn.signInParent();
  const parent = createApi(conn.parent);
  const me = await parent.whoami();
  await parent.deviceApprove(String(pairing.pair_code).toLowerCase(), me.children[0].id, 'kid');
  assert.equal((await device.whoami()).device?.status, 'approved');
  assert.equal((await device.kidUnlock(DEMO_PIN)).ok, true);
  assert.equal((await device.getToday(me.children[0].id)).streak.current, 2);      // the lived-in board is there too
});
