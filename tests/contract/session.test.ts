// Contract tests: who is calling, device pairing, PIN unlock, settings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './fixture.ts';
import {
  DAD, EMAIL_LOGIN, KID, KITCHEN, LAPTOP, MOM, PIN, STRANGER, TABLET, failsWith, sameInstant, worlds,
} from './world.ts';

const T0 = '2026-12-21T17:00:00Z';            // Monday 9:00 AM in Los Angeles

for (const w of worlds()) {
  const start = () => { w.setNow(T0); w.reset(fixture()); };
  const pair = (dev = LAPTOP, kind = 'kid', label = 'Laptop') => {
    w.call(MOM, 'claim_parent');
    const p = w.call(dev, 'device_start_pairing', { p_label: label });
    return w.call(MOM, 'device_approve', { p_code: p.pair_code, p_child_id: KID, p_kind: kind });
  };

  test(`[${w.name}] signed-out callers learn nothing about the family`, () => {
    start();
    const me = w.call(null, 'whoami');
    assert.equal(me.role, 'none');
    assert.equal(me.family_name, null);
    assert.deepEqual(me.children, []);
    assert.equal(me.today, '2026-12-21');
    assert.equal(me.timezone, 'America/Los_Angeles');
    assert.ok(sameInstant(me.now, T0));
    failsWith(() => w.call(null, 'claim_parent'), 'not_signed_in');
    failsWith(() => w.call(null, 'get_settings'), 'not_allowed');
    failsWith(() => w.call(null, 'device_list'), 'not_signed_in');
  });

  test(`[${w.name}] only allowlisted Google accounts become parents`, () => {
    start();
    const before = w.call(MOM, 'whoami');
    assert.equal(before.role, 'none');
    assert.equal(before.can_claim_parent, true);
    assert.equal(before.email, 'mom@example.com');
    const me = w.call(MOM, 'claim_parent');
    assert.equal(me.role, 'parent');
    assert.equal(me.family_name, 'Our family');
    assert.deepEqual(me.children, [{ id: KID, name: 'Anush', avatar: 'd20', theme: 'forest', pin_set: true }]);
    assert.equal(w.call(MOM, 'claim_parent').role, 'parent');       // safe to repeat
    failsWith(() => w.call(STRANGER, 'claim_parent'), 'not_allowlisted');
    failsWith(() => w.call(EMAIL_LOGIN, 'claim_parent'), 'not_allowlisted');
    failsWith(() => w.call(LAPTOP, 'claim_parent'), 'not_allowlisted');
    failsWith(() => w.call(STRANGER, 'device_list'), 'not_parent');
  });

  test(`[${w.name}] a device is paired by code, then unlocked by PIN`, () => {
    start();
    w.call(MOM, 'claim_parent');
    failsWith(() => w.call(MOM, 'device_start_pairing'), 'not_allowed');        // parents are not devices
    failsWith(() => w.call(STRANGER, 'device_start_pairing'), 'not_allowed');   // must be an anonymous session
    const p = w.call(LAPTOP, 'device_start_pairing', { p_label: '  Anush laptop  ' });
    assert.equal(p.status, 'pending');
    assert.match(p.pair_code, /^[A-HJKMNP-Z2-9]{6}$/);
    assert.ok(sameInstant(p.pair_expires_at, '2026-12-21T17:15:00Z'));
    const pending = w.call(LAPTOP, 'whoami');
    assert.equal(pending.role, 'none');
    assert.equal(pending.device.status, 'pending');
    assert.equal(pending.device.pair_code, p.pair_code);
    assert.equal(pending.device.label, 'Anush laptop');
    assert.deepEqual(pending.children, []);

    failsWith(() => w.call(MOM, 'device_approve', { p_code: 'ZZZZZZ', p_child_id: KID }), 'bad_code');
    failsWith(() => w.call(MOM, 'device_approve', { p_code: p.pair_code, p_child_id: KID, p_kind: 'robot' }), 'bad_input');
    failsWith(() => w.call(MOM, 'device_approve', { p_code: p.pair_code, p_child_id: MOM.sub }), 'not_found');
    failsWith(() => w.call(TABLET, 'device_approve', { p_code: p.pair_code, p_child_id: KID }), 'not_parent');
    const typed = p.pair_code.slice(0, 3).toLowerCase() + '-' + p.pair_code.slice(3);
    const row = w.call(MOM, 'device_approve', { p_code: typed, p_child_id: KID });
    assert.equal(row.status, 'approved');
    assert.equal(row.kind, 'kid');
    assert.equal(row.user_id, LAPTOP.sub);
    assert.equal(row.unlocked, false);

    const locked = w.call(LAPTOP, 'whoami');
    assert.equal(locked.role, 'none');
    assert.equal(locked.device.status, 'approved');
    assert.equal(locked.device.pair_code, null);
    assert.equal(locked.children[0].name, 'Anush');
    failsWith(() => w.call(LAPTOP, 'get_settings'), 'not_allowed');
    failsWith(() => w.call(LAPTOP, 'update_child', { p_child_id: KID, p_patch: { avatar: 'star' } }), 'locked');

    assert.deepEqual(w.call(LAPTOP, 'kid_unlock', { p_pin: '0000' }), { ok: false, attempts_left: 4, locked_until: null });
    const ok = w.call(LAPTOP, 'kid_unlock', { p_pin: PIN });
    assert.equal(ok.ok, true);
    assert.ok(sameInstant(ok.unlocked_until, '2026-12-22T05:00:00Z'));           // 12 hours
    assert.equal(w.call(LAPTOP, 'whoami').role, 'kid');
    assert.equal(w.call(LAPTOP, 'device_start_pairing').status, 'approved');     // already linked
    w.setNow('2026-12-22T05:00:01Z');
    assert.equal(w.call(LAPTOP, 'whoami').role, 'none');                         // unlock ran out
    w.call(LAPTOP, 'kid_unlock', { p_pin: PIN });
    assert.equal(w.call(LAPTOP, 'whoami').role, 'kid');
    w.call(LAPTOP, 'kid_lock');
    assert.equal(w.call(LAPTOP, 'whoami').role, 'none');
  });

  test(`[${w.name}] a pairing code expires after 15 minutes`, () => {
    start();
    w.call(MOM, 'claim_parent');
    const p = w.call(LAPTOP, 'device_start_pairing');
    w.setNow('2026-12-21T17:15:01Z');
    failsWith(() => w.call(MOM, 'device_approve', { p_code: p.pair_code, p_child_id: KID }), 'bad_code');
    const p2 = w.call(LAPTOP, 'device_start_pairing');
    assert.equal(w.call(MOM, 'device_approve', { p_code: p2.pair_code, p_child_id: KID }).status, 'approved');
  });

  test(`[${w.name}] five wrong PINs lock the child for five minutes`, () => {
    start();
    pair();
    for (const left of [4, 3, 2, 1]) {
      assert.equal(w.call(LAPTOP, 'kid_unlock', { p_pin: '1111' }).attempts_left, left);
    }
    const fifth = w.call(LAPTOP, 'kid_unlock', { p_pin: '1111' });
    assert.equal(fifth.ok, false);
    assert.ok(sameInstant(fifth.locked_until, '2026-12-21T17:05:00Z'));
    assert.equal(w.call(LAPTOP, 'kid_unlock', { p_pin: PIN }).ok, false);        // right PIN, still locked
    w.setNow('2026-12-21T17:05:01Z');
    assert.equal(w.call(LAPTOP, 'kid_unlock', { p_pin: PIN }).ok, true);
    failsWith(() => w.call(TABLET, 'kid_unlock', { p_pin: PIN }), 'not_allowed'); // not a linked device
    failsWith(() => w.call(null, 'kid_unlock', { p_pin: PIN }), 'not_signed_in');
  });

  test(`[${w.name}] a display device can read but never write`, () => {
    start();
    const row = pair(KITCHEN, 'display', 'Kitchen');
    assert.equal(row.kind, 'display');
    const me = w.call(KITCHEN, 'whoami');
    assert.equal(me.role, 'display');
    assert.equal(me.device.unlocked, false);
    const s = w.call(KITCHEN, 'get_settings');
    assert.equal(s.parent_emails, undefined);
    assert.equal(s.children.length, 1);
    failsWith(() => w.call(KITCHEN, 'update_child', { p_child_id: KID, p_patch: { avatar: 'star' } }), 'not_allowed');
    failsWith(() => w.call(KITCHEN, 'kid_unlock', { p_pin: PIN }), 'not_allowed');
  });

  test(`[${w.name}] changing the PIN locks every device`, () => {
    start();
    pair();
    w.call(LAPTOP, 'kid_unlock', { p_pin: PIN });
    failsWith(() => w.call(LAPTOP, 'set_child_pin', { p_child_id: KID, p_pin: '1357' }), 'not_parent');
    failsWith(() => w.call(MOM, 'set_child_pin', { p_child_id: KID, p_pin: '12' }), 'bad_input');
    failsWith(() => w.call(MOM, 'set_child_pin', { p_child_id: KID, p_pin: '12a4' }), 'bad_input');
    failsWith(() => w.call(MOM, 'set_child_pin', { p_child_id: MOM.sub, p_pin: '1357' }), 'not_found');
    assert.deepEqual(w.call(MOM, 'set_child_pin', { p_child_id: KID, p_pin: '1357' }), { ok: true });
    assert.equal(w.call(LAPTOP, 'whoami').role, 'none');
    assert.equal(w.call(LAPTOP, 'kid_unlock', { p_pin: PIN }).ok, false);
    assert.equal(w.call(LAPTOP, 'kid_unlock', { p_pin: '1357' }).ok, true);
  });

  test(`[${w.name}] settings: parents see and change everything, within limits`, () => {
    start();
    w.call(MOM, 'claim_parent');
    w.setNow('2026-12-21T17:01:00Z');
    w.call(DAD, 'claim_parent');
    const s = w.call(MOM, 'get_settings');
    assert.deepEqual(s.parent_emails, ['mom@example.com', 'dad@example.com']);
    assert.equal(s.unlock_minutes, 720);
    assert.equal(s.catchup_alert_threshold, 5);
    assert.equal(s.structured_weekly_max_min, 540);
    assert.equal(s.automation_token_set, false);
    assert.deepEqual(s.parents, [
      { email: 'mom@example.com', display_name: 'Mom K' }, { email: 'dad@example.com', display_name: 'Dad K' },
    ]);
    for (const bad of [
      { timezone: 'Mars/Olympus' }, { family_name: '   ' }, { day_start_min: 900, day_end_min: 600 },
      { unlock_minutes: 2 }, { catchup_alert_threshold: 'many' }, { parent_emails: ['dad@example.com'] },
      { parent_emails: ['mom@example.com', 'not-an-email'] }, { parent_emails: 'mom@example.com' },
    ]) {
      failsWith(() => w.call(MOM, 'update_settings', { p_patch: bad }), 'bad_input');
    }
    failsWith(() => w.call(MOM, 'update_settings', { p_patch: [] }), 'bad_input');
    const s2 = w.call(MOM, 'update_settings', { p_patch: {
      family_name: '  The Example Family ', timezone: 'America/New_York', day_start_min: 480, unlock_minutes: 60,
      catchup_alert_threshold: 3, parent_emails: [' MOM@example.com ', 'gran@example.com'],
    } });
    assert.equal(s2.family_name, 'The Example Family');
    assert.equal(s2.timezone, 'America/New_York');
    assert.equal(s2.day_start_min, 480);
    assert.equal(s2.day_end_min, 1260);
    assert.deepEqual(s2.parent_emails, ['gran@example.com', 'mom@example.com']);
    assert.deepEqual(s2.parents.map((p: { email: string }) => p.email), ['mom@example.com']);
    assert.equal(w.call(DAD, 'whoami').role, 'none');                 // removed from the allowlist
    assert.equal(w.call(DAD, 'whoami').can_claim_parent, false);
    assert.equal(w.call(MOM, 'whoami').today, '2026-12-21');          // noon in New York, same date
  });

  test(`[${w.name}] the child can restyle himself; only a parent renames`, () => {
    start();
    pair();
    w.call(LAPTOP, 'kid_unlock', { p_pin: PIN });
    const c = w.call(LAPTOP, 'update_child', { p_child_id: KID, p_patch: { avatar: 'shield', theme: 'ember' } });
    assert.deepEqual(c, { id: KID, name: 'Anush', avatar: 'shield', theme: 'ember', pin_set: true });
    failsWith(() => w.call(LAPTOP, 'update_child', { p_child_id: KID, p_patch: { name: 'Boss' } }), 'not_allowed');
    failsWith(() => w.call(MOM, 'update_child', { p_child_id: KID, p_patch: { theme: 'Not Valid!' } }), 'bad_input');
    failsWith(() => w.call(MOM, 'update_child', { p_child_id: KID, p_patch: { name: '' } }), 'bad_input');
    assert.equal(w.call(MOM, 'update_child', { p_child_id: KID, p_patch: { name: ' Anush K ' } }).name, 'Anush K');
  });

  test(`[${w.name}] a removed device loses access at once`, () => {
    start();
    pair();
    pair(TABLET, 'kid', 'Tablet');
    w.call(LAPTOP, 'kid_unlock', { p_pin: PIN });
    assert.deepEqual(w.call(MOM, 'device_list').map((d: { label: string }) => d.label), ['Laptop', 'Tablet']);
    assert.equal(w.call(MOM, 'device_list')[0].unlocked, true);
    assert.equal(w.call(MOM, 'device_revoke', { p_device_id: LAPTOP.sub }).status, 'revoked');
    failsWith(() => w.call(MOM, 'device_revoke', { p_device_id: MOM.sub }), 'not_found');
    const me = w.call(LAPTOP, 'whoami');
    assert.equal(me.role, 'none');
    assert.equal(me.device.status, 'revoked');
    assert.deepEqual(me.children, []);
    assert.deepEqual(w.call(MOM, 'device_list').map((d: { label: string }) => d.label), ['Tablet']);
    failsWith(() => w.call(LAPTOP, 'kid_unlock', { p_pin: PIN }), 'not_allowed');
  });

  test(`[${w.name}] the automation key is shown once and only its hash is kept`, () => {
    start();
    w.call(MOM, 'claim_parent');
    const { token } = w.call(MOM, 'rotate_automation_token');
    assert.match(token, /^[0-9a-f]{64}$/);
    assert.equal(w.call(MOM, 'get_settings').automation_token_set, true);
    failsWith(() => w.call(LAPTOP, 'rotate_automation_token'), 'not_parent');
  });

  test(`[${w.name}] unknown functions and arguments are refused`, () => {
    start();
    failsWith(() => w.call(MOM, 'drop_all_tables'), 'no_such_function');
    failsWith(() => w.call(MOM, 'whoami', { p_extra: 1 }), 'unknown_argument');
  });
}
