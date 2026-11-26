import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatPairCode, pinMessage } from '../../src/lib/pin.ts';

test('formatPairCode: three, dash, three; anything else unchanged', () => {
  assert.equal(formatPairCode('K7M2QX'), 'K7M-2QX');
  assert.equal(formatPairCode('ABC'), 'ABC');
  assert.equal(formatPairCode(''), '');
  assert.equal(formatPairCode('K7M-2QX'), 'K7M-2QX');
});

test('pinMessage: null after a good PIN', () => {
  assert.equal(pinMessage({ ok: true, unlocked_until: '2026-12-21T22:06:00Z' }, 'America/Los_Angeles'), null);
});

test('pinMessage: tries left, plural and singular', () => {
  const tz = 'America/Los_Angeles';
  assert.equal(pinMessage({ ok: false, attempts_left: 4, locked_until: null }, tz), 'That PIN did not match. 4 tries left.');
  assert.equal(pinMessage({ ok: false, attempts_left: 1, locked_until: null }, tz), 'That PIN did not match. 1 try left.');
  assert.equal(pinMessage({ ok: false, attempts_left: 2 }, tz), 'That PIN did not match. 2 tries left.');
});

test('pinMessage: locked shows the clock time in the family time zone', () => {
  const r = { ok: false, attempts_left: 0, locked_until: '2026-12-21T18:11:00Z' };
  assert.equal(pinMessage(r, 'America/Los_Angeles'), 'Too many tries. Try again at 10:11 AM.');
  assert.equal(pinMessage(r, 'Europe/London'), 'Too many tries. Try again at 6:11 PM.');
});
