// In-memory port of db/migrations/002_core.sql: session and settings functions.
import {
  type Ctx, type MemoryDb, type Row, access, canClaim, childJson, cleanLabel, deviceJson, fail, intOrKeep,
  isObject, isParent, isUnlocked, iso, pinHash, randomHex, requireParent, validTimeZone, viewer, weakHash, by, ms,
} from './core.ts';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function whoami(c: Ctx): Row {
  const cfg = c.s.config;
  let role = 'none';
  let device: Row | null = null;
  let canClaimParent = false;
  let children: Row[] = [];
  let known = false;
  if (c.uid !== null) {
    if (isParent(c)) {
      role = 'parent';
      known = true;
      children = [...c.s.children].sort(by((x: Row) => x.created_at, (x: Row) => x.id)).map((x) => childJson(x, true));
    } else {
      const d = c.s.devices.find((x) => x.user_id === c.uid);
      if (d) {
        const unlocked = d.status === 'approved' && d.kind === 'kid' && isUnlocked(c, d);
        if (d.status === 'approved' && d.kind === 'display') role = 'display';
        else if (unlocked) role = 'kid';
        device = {
          status: d.status, kind: d.kind, label: d.label,
          child_id: d.status === 'approved' ? d.child_id : null,
          unlocked,
          pair_code: d.status === 'pending' ? d.pair_code : null,
          pair_expires_at: d.status === 'pending' ? d.pair_expires_at : null,
        };
        if (d.status === 'approved') {
          known = true;
          children = c.s.children.filter((x) => x.id === d.child_id).map((x) => childJson(x, true));
        }
      }
      canClaimParent = canClaim(c);
    }
  }
  const email = c.claims?.email ? c.claims.email.toLowerCase() : null;
  return {
    role, email, device, can_claim_parent: canClaimParent,
    family_name: known ? cfg.family_name : null,
    timezone: cfg.timezone, day_start_min: cfg.day_start_min, day_end_min: cfg.day_end_min,
    today: c.today, now: c.nowIso, children,
  };
}

function claimParent(c: Ctx): Row {
  if (c.uid === null) fail('not_signed_in');
  if (!isParent(c)) {
    if (!canClaim(c)) fail('not_allowlisted');
    const email = (c.claims?.email ?? '').toLowerCase();
    c.s.parents = c.s.parents.filter((p) => !(p.email === email && p.user_id !== c.uid));
    c.s.parents.push({
      user_id: c.uid, email,
      display_name: c.claims?.user_metadata?.full_name ?? c.claims?.user_metadata?.name ?? null,
      created_at: c.nowIso,
    });
    c.s.devices = c.s.devices.filter((d) => d.user_id !== c.uid);
  }
  return whoami(c);
}

function deviceStartPairing(c: Ctx, a: Row): Row {
  if (c.uid === null) fail('not_signed_in');
  if (isParent(c) || (c.claims?.is_anonymous ?? false) === false) fail('not_allowed');
  const dayAgo = c.now - 86_400_000;
  c.s.devices = c.s.devices.filter((d) => !(d.status === 'pending' && ms(d.pair_expires_at) < dayAgo));
  const existing = c.s.devices.find((d) => d.user_id === c.uid);
  if (existing && existing.status === 'approved') {
    return { status: 'approved', pair_code: null, pair_expires_at: null };
  }
  let code = '';
  do {
    const bytes = new Uint8Array(6);
    globalThis.crypto.getRandomValues(bytes);
    code = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
  } while (c.s.devices.some((d) => d.pair_code === code));
  const expires = iso(c.now + 15 * 60_000);
  const label = cleanLabel(a.p_label);
  if (existing) {
    Object.assign(existing, {
      status: 'pending', pair_code: code, pair_expires_at: expires, label: label ?? existing.label,
      child_id: null, unlocked_until: null, approved_at: null,
    });
  } else {
    c.s.devices.push({
      user_id: c.uid, label, kind: 'kid', status: 'pending', child_id: null, pair_code: code,
      pair_expires_at: expires, unlocked_until: null, created_at: c.nowIso, approved_at: null,
    });
  }
  return { status: 'pending', pair_code: code, pair_expires_at: expires };
}

function deviceApprove(c: Ctx, a: Row): Row {
  requireParent(c);
  const kind = a.p_kind === undefined ? 'kid' : a.p_kind;
  if (kind !== 'kid' && kind !== 'display') fail('bad_input');
  if (!c.s.children.some((x) => x.id === a.p_child_id)) fail('not_found');
  const code = String(a.p_code ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const d = c.s.devices.find((x) => x.pair_code === code && x.status === 'pending' && ms(x.pair_expires_at) > c.now);
  if (!d) fail('bad_code');
  Object.assign(d, {
    status: 'approved', child_id: a.p_child_id, kind, label: cleanLabel(a.p_label) ?? d.label,
    approved_at: c.nowIso, pair_code: null, pair_expires_at: null, unlocked_until: null,
  });
  return deviceJson(c, d);
}

function deviceRevoke(c: Ctx, a: Row): Row {
  requireParent(c);
  const d = c.s.devices.find((x) => x.user_id === a.p_device_id);
  if (!d) fail('not_found');
  Object.assign(d, { status: 'revoked', unlocked_until: null, pair_code: null, pair_expires_at: null });
  return deviceJson(c, d);
}

function deviceList(c: Ctx): Row[] {
  requireParent(c);
  return c.s.devices.filter((d) => d.status === 'approved').sort(by((d: Row) => ms(d.created_at), (d: Row) => d.user_id))
    .map((d) => deviceJson(c, d));
}

function setChildPin(c: Ctx, a: Row): Row {
  requireParent(c);
  if (typeof a.p_pin !== 'string' || !/^[0-9]{4,6}$/.test(a.p_pin)) fail('bad_input');
  const ch = c.s.children.find((x) => x.id === a.p_child_id);
  if (!ch) fail('not_found');
  const salt = randomHex();
  Object.assign(ch, { pin_salt: salt, pin_hash: pinHash(salt, a.p_pin), pin_failed: 0, pin_locked_until: null });
  for (const d of c.s.devices) if (d.child_id === ch.id) d.unlocked_until = null;
  return { ok: true };
}

function kidUnlock(c: Ctx, a: Row): Row {
  if (c.uid === null) fail('not_signed_in');
  const d = c.s.devices.find((x) => x.user_id === c.uid && x.status === 'approved' && x.kind === 'kid');
  if (!d) fail('not_allowed');
  const ch = c.s.children.find((x) => x.id === d.child_id)!;
  if (ch.pin_hash == null) fail('pin_not_set');
  if (ch.pin_locked_until != null && ms(ch.pin_locked_until) > c.now) {
    return { ok: false, attempts_left: 0, locked_until: ch.pin_locked_until };
  }
  if (typeof a.p_pin === 'string' && pinHash(ch.pin_salt, a.p_pin) === ch.pin_hash) {
    const until = iso(c.now + c.s.config.unlock_minutes * 60_000);
    ch.pin_failed = 0;
    ch.pin_locked_until = null;
    d.unlocked_until = until;
    return { ok: true, unlocked_until: until };
  }
  const failed = ch.pin_failed + 1;
  if (failed >= 5) {
    const until = iso(c.now + 5 * 60_000);
    ch.pin_failed = 0;
    ch.pin_locked_until = until;
    return { ok: false, attempts_left: 0, locked_until: until };
  }
  ch.pin_failed = failed;
  return { ok: false, attempts_left: 5 - failed, locked_until: null };
}

function kidLock(c: Ctx): Row {
  if (c.uid === null) fail('not_signed_in');
  for (const d of c.s.devices) if (d.user_id === c.uid) d.unlocked_until = null;
  return { ok: true };
}

function getSettings(c: Ctx): Row {
  const v = viewer(c);
  if (v.role === 'none') fail('not_allowed');
  const cfg = c.s.config;
  const base = {
    family_name: cfg.family_name, timezone: cfg.timezone, day_start_min: cfg.day_start_min,
    day_end_min: cfg.day_end_min,
  };
  if (v.role !== 'parent') {
    return { ...base, children: c.s.children.filter((x) => x.id === v.child_id).map((x) => childJson(x, true)) };
  }
  return {
    ...base,
    parent_emails: [...cfg.parent_emails],
    unlock_minutes: cfg.unlock_minutes,
    catchup_alert_threshold: cfg.catchup_alert_threshold,
    structured_weekly_max_min: cfg.structured_weekly_max_min,
    automation_token_set: cfg.automation_token_hash != null,
    children: [...c.s.children].sort(by((x: Row) => x.created_at, (x: Row) => x.id)).map((x) => childJson(x, true)),
    parents: [...c.s.parents].sort(by((p: Row) => ms(p.created_at), (p: Row) => p.email))
      .map((p) => ({ email: p.email, display_name: p.display_name })),
  };
}

function inRange(v: number, lo: number, hi: number): void {
  if (v < lo || v > hi) fail('bad_input');
}

function updateSettings(c: Ctx, a: Row): Row {
  requireParent(c);
  const p = a.p_patch;
  if (!isObject(p)) fail('bad_input');
  if ('timezone' in p && !validTimeZone(p.timezone)) fail('bad_input');
  if ('family_name' in p) {
    const n = String(p.family_name ?? '').trim().length;
    if (n < 1 || n > 60) fail('bad_input');
  }
  let emails: string[] | undefined;
  if ('parent_emails' in p) {
    if (!Array.isArray(p.parent_emails)) fail('bad_input');
    emails = [...new Set((p.parent_emails as unknown[]).map((x) => String(x).trim().toLowerCase())
      .filter((x) => x !== ''))].sort();
    const me = c.s.parents.find((x) => x.user_id === c.uid)?.email;
    if (!me || !emails.includes(me) || emails.some((e) => !EMAIL_RE.test(e))) fail('bad_input');
  }
  const cfg = c.s.config;
  const next = { ...cfg };
  if (p.family_name != null) next.family_name = String(p.family_name).trim();
  if (p.timezone != null) next.timezone = p.timezone;
  const ds = intOrKeep(p.day_start_min);
  const de = intOrKeep(p.day_end_min);
  const um = intOrKeep(p.unlock_minutes);
  const ct = intOrKeep(p.catchup_alert_threshold);
  const sw = intOrKeep(p.structured_weekly_max_min);
  if (ds !== undefined) { inRange(ds, 0, 1380); next.day_start_min = ds; }
  if (de !== undefined) { inRange(de, 60, 1440); next.day_end_min = de; }
  if (um !== undefined) { inRange(um, 5, 10080); next.unlock_minutes = um; }
  if (ct !== undefined) { inRange(ct, 1, 99); next.catchup_alert_threshold = ct; }
  if (sw !== undefined) { inRange(sw, 0, 6000); next.structured_weekly_max_min = sw; }
  if (emails !== undefined) next.parent_emails = emails;
  if (next.day_start_min >= next.day_end_min) fail('bad_input');
  next.updated_at = c.nowIso;
  c.s.config = next;
  if (emails !== undefined) c.s.parents = c.s.parents.filter((x) => emails!.includes(x.email));
  return getSettings(c);
}

function updateChild(c: Ctx, a: Row): Row {
  const role = access(c, a.p_child_id, true);
  const p = a.p_patch;
  if (!isObject(p)) fail('bad_input');
  if ('name' in p && role !== 'parent') fail('not_allowed');
  if ('name' in p) {
    const n = String(p.name ?? '').trim().length;
    if (n < 1 || n > 40) fail('bad_input');
  }
  if ('avatar' in p) {
    const n = String(p.avatar ?? '').length;
    if (n < 1 || n > 16) fail('bad_input');
  }
  if ('theme' in p && !/^[a-z]{2,20}$/.test(String(p.theme ?? ''))) fail('bad_input');
  const ch = c.s.children.find((x) => x.id === a.p_child_id)!;
  if (p.name != null) ch.name = String(p.name).trim();
  if (p.avatar != null) ch.avatar = String(p.avatar);
  if (p.theme != null) ch.theme = String(p.theme);
  return childJson(ch, true);
}

function rotateAutomationToken(c: Ctx): Row {
  requireParent(c);
  const token = randomHex();
  c.s.config.automation_token_hash = weakHash(token);
  c.s.config.updated_at = c.nowIso;
  return { token };
}

export function registerSession(db: MemoryDb): void {
  db.register('whoami', [], whoami);
  db.register('claim_parent', [], claimParent);
  db.register('device_start_pairing', ['p_label'], deviceStartPairing);
  db.register('device_approve', ['p_code', 'p_child_id', 'p_kind', 'p_label'], deviceApprove);
  db.register('device_revoke', ['p_device_id'], deviceRevoke);
  db.register('device_list', [], deviceList);
  db.register('set_child_pin', ['p_child_id', 'p_pin'], setChildPin);
  db.register('kid_unlock', ['p_pin'], kidUnlock);
  db.register('kid_lock', [], kidLock);
  db.register('get_settings', [], getSettings);
  db.register('update_settings', ['p_patch'], updateSettings);
  db.register('update_child', ['p_child_id', 'p_patch'], updateChild);
  db.register('rotate_automation_token', [], rotateAutomationToken);
}
