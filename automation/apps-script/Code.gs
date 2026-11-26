/**
 * Questboard automation for Google Apps Script (script.google.com).
 *
 * What it does, from a parent's own Google account, at no cost:
 *   weeklySummary()  Sunday evening e-mail to the parents on the allowlist
 *   driveBackup()    weekly backup file in Google Drive (folder "Questboard backups")
 *   keepAwake()      one small request a day, so a free Supabase project is never paused for inactivity
 *   calendarSync()   Phase 2 only: copies timed cards into a Google Calendar the kitchen display can show
 *
 * Setup (docs/02-setup-guide.md, part 6): paste this file, fill in Script properties
 *   SUPABASE_URL   https://xxxx.supabase.co
 *   SUPABASE_KEY   the publishable key (sb_publishable_...)
 *   QB_TOKEN       the automation key from Settings > "Weekly e-mail and Drive backup" > New key
 *   APP_URL        (optional) the address of your Questboard, shown as a link in the e-mail
 * then run install() once.
 *
 * Everything above the line "Apps Script glue" is plain JavaScript and is
 * tested in tests/unit/automation.test.ts.
 */

// ---------------------------------------------------------------------------
// Pure helpers (no Google services)
// ---------------------------------------------------------------------------

function qbAddDays(dateStr, n) {
  var d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 1 = Monday ... 7 = Sunday */
function qbWeekday(dateStr) {
  var d = new Date(dateStr + 'T00:00:00Z').getUTCDay();
  return d === 0 ? 7 : d;
}

/**
 * The week to report on. On a Sunday: this week (Monday to today).
 * On any other day: the last full week (Monday to Sunday).
 */
function qbWeekRange(todayStr) {
  var wd = qbWeekday(todayStr);
  var monday = qbAddDays(todayStr, 1 - wd);
  if (wd === 7) return { from: monday, to: todayStr };
  return { from: qbAddDays(monday, -7), to: qbAddDays(monday, -1) };
}

function qbMinutes(min) {
  if (min < 60) return min + ' min';
  var h = Math.floor(min / 60);
  var m = min % 60;
  return m === 0 ? h + ' h' : h + ' h ' + m + ' min';
}

var QB_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
var QB_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function qbShortDate(dateStr) {
  var parts = dateStr.split('-');
  return QB_MONTHS[Number(parts[1]) - 1] + ' ' + Number(parts[2]);
}

function qbDayLabel(dateStr) {
  return QB_DAYS[qbWeekday(dateStr) - 1] + ' ' + qbShortDate(dateStr);
}

function qbEsc(text) {
  return String(text == null ? '' : text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function qbPercent(part, whole) {
  return whole > 0 ? Math.round((part * 100) / whole) : 0;
}

/** The facts the e-mail is built from, for one child. */
function qbChildFacts(summary, kid) {
  var t = kid.stats.totals;
  var days = kid.stats.by_day;
  var names = {};
  summary.categories.forEach(function (c) { names[c.id] = c.name; });
  var counted = days.filter(function (d) { return d.mark === null && d.date <= summary.today; });
  var gap = null;
  kid.stats.by_category.forEach(function (c) {
    var missing = c.planned_min - c.spent_min;
    if (c.planned_min >= 30 && (gap === null || missing > gap.missing)) {
      gap = { name: names[c.category_id] || c.category_id, missing: missing };
    }
  });
  return {
    name: kid.child.name,
    plannedMin: t.planned_min,
    spentMin: t.spent_min,
    donePct: qbPercent(t.spent_min, t.planned_min),
    daysClosed: counted.filter(function (d) { return d.closed; }).length,
    daysCounted: counted.length,
    mustDone: t.must_done,
    mustPlanned: t.must_planned,
    streak: kid.stats.streak.current,
    bestStreak: kid.stats.streak.best,
    structuredPlanned: t.structured_planned_min,
    structuredMax: kid.stats.structured_weekly_max_min,
    trayCount: kid.stats.tray.count,
    trayMinutes: kid.stats.tray.minutes,
    trayAlert: kid.stats.tray.count >= summary.catchup_alert_threshold,
    unconfirmed: t.unconfirmed,
    biggestGap: gap && gap.missing >= 30 ? gap : null,
    names: names
  };
}

/** Up to three questions for the Sunday check-in, chosen from the week's numbers. */
function qbTalkingPoints(f, kid) {
  var out = [];
  if (kid.drop_requests.length > 0) out.push('He asked to drop ' + kid.drop_requests.length + ' must-do' + (kid.drop_requests.length === 1 ? '' : 's') + '. Decide together: keep, shrink or let go?');
  if (f.trayAlert) out.push('The Catch-up tray holds ' + f.trayCount + ' cards (' + qbMinutes(f.trayMinutes) + '). What should come out of next week to make room?');
  if (f.structuredMax > 0 && f.structuredPlanned > f.structuredMax) out.push('Structured time was ' + qbMinutes(f.structuredPlanned) + ', above your ' + qbMinutes(f.structuredMax) + ' guide. What can go?');
  if (f.biggestGap) out.push(f.biggestGap.name + ' ended ' + qbMinutes(f.biggestGap.missing) + ' short of the plan. Was the plan too big, or did something get in the way?');
  if (f.daysCounted > 0 && f.daysClosed < f.daysCounted) out.push('He closed out ' + f.daysClosed + ' of ' + f.daysCounted + ' days. What would make the two-minute close-out easier?');
  if (out.length === 0) out.push('A steady week. Ask what he is proudest of, and what he wants to try next.');
  out.push('Ask first: what did you enjoy most, and what would you change?');
  return out.slice(0, 3);
}

function qbRow(cells, header) {
  var tag = header ? 'th' : 'td';
  return '<tr>' + cells.map(function (c, i) {
    return '<' + tag + ' style="padding:6px 10px;border-bottom:1px solid #d9dee9;text-align:' + (i === 0 ? 'left' : 'right') +
      ';font-size:14px;' + (header ? 'color:#4a5270;font-weight:600;' : '') + '">' + c + '</' + tag + '>';
  }).join('') + '</tr>';
}

function qbSection(title, bodyHtml) {
  return '<h2 style="font-size:16px;margin:24px 0 8px;color:#171c33">' + qbEsc(title) + '</h2>' + bodyHtml;
}

function qbList(items) {
  return '<ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.5">' +
    items.map(function (i) { return '<li>' + i + '</li>'; }).join('') + '</ul>';
}

/** Subject line of the weekly e-mail. */
function buildSummarySubject(summary) {
  var names = summary.children.map(function (k) { return k.child.name; }).join(' and ');
  return 'Questboard: ' + names + "'s week, " + qbShortDate(summary.from) + ' to ' + qbShortDate(summary.to);
}

/** The whole weekly e-mail as HTML. `appUrl` is optional. */
function buildSummaryHtml(summary, appUrl) {
  var html = '<div style="font-family:Arial,Helvetica,sans-serif;color:#171c33;max-width:640px">';
  summary.children.forEach(function (kid) {
    var f = qbChildFacts(summary, kid);
    html += '<h1 style="font-size:22px;margin:0 0 4px">' + qbEsc(f.name) + "'s week</h1>" +
      '<p style="margin:0 0 16px;color:#4a5270;font-size:14px">' + qbShortDate(summary.from) + ' to ' + qbShortDate(summary.to) + '</p>';
    html += '<table style="border-collapse:collapse;width:100%">' +
      qbRow(['Time done', qbMinutes(f.spentMin) + ' of ' + qbMinutes(f.plannedMin) + ' planned (' + f.donePct + '%)']) +
      qbRow(['Days closed out', f.daysClosed + ' of ' + f.daysCounted]) +
      qbRow(['Must-dos finished', f.mustDone + ' of ' + f.mustPlanned]) +
      qbRow(['Campfire streak', f.streak + ' days (best ' + f.bestStreak + ')']) +
      qbRow(['Structured time planned', qbMinutes(f.structuredPlanned) + ' (guide: ' + qbMinutes(f.structuredMax) + ')']) +
      '</table>';

    var needs = [];
    kid.drop_requests.forEach(function (d) {
      needs.push('Asked to drop <b>' + qbEsc(d.title) + '</b>' + (d.reason ? ': "' + qbEsc(d.reason) + '"' : ''));
    });
    if (f.trayCount > 0) needs.push('Catch-up tray: ' + f.trayCount + ' card' + (f.trayCount === 1 ? '' : 's') + ', ' + qbMinutes(f.trayMinutes) + (f.trayAlert ? ' <b>(at or over your alert level)</b>' : ''));
    if (f.unconfirmed > 0) needs.push(f.unconfirmed + ' card' + (f.unconfirmed === 1 ? '' : 's') + ' from past days still need a percent');
    kid.must_open.filter(function (m) { return m.due_date !== null; }).forEach(function (m) {
      needs.push('Must-do <b>' + qbEsc(m.title) + '</b> is due ' + qbDayLabel(m.due_date) + (m.place === 'day' ? ' (planned for ' + qbDayLabel(m.date) + ')' : ' and is not on a day yet'));
    });
    if (needs.length > 0) html += qbSection('Needs you', qbList(needs));

    html += qbSection('To talk about on Sunday', qbList(qbTalkingPoints(f, kid).map(qbEsc)));

    if (kid.stats.by_category.length > 0) {
      html += qbSection('Time by category', '<table style="border-collapse:collapse;width:100%">' +
        qbRow(['Category', 'Planned', 'Done'], true) +
        kid.stats.by_category.map(function (c) {
          return qbRow([qbEsc(f.names[c.category_id] || c.category_id), qbMinutes(c.planned_min), qbMinutes(c.spent_min)]);
        }).join('') + '</table>');
    }

    html += qbSection('Day by day', '<table style="border-collapse:collapse;width:100%">' +
      qbRow(['Day', 'Planned', 'Done', 'Closed out'], true) +
      kid.stats.by_day.map(function (d) {
        var state = d.mark === 'away' ? 'Away' : d.mark === 'rest' ? 'Rest day' : d.closed ? 'Yes' : d.date > summary.today ? '' : 'No';
        return qbRow([qbDayLabel(d.date), qbMinutes(d.planned_min), qbMinutes(d.spent_min), state]);
      }).join('') + '</table>');

    if (kid.partial_notes.length > 0) {
      html += qbSection('Partly done or missed, in his words', qbList(kid.partial_notes.map(function (n) {
        return qbDayLabel(n.date) + ': <b>' + qbEsc(n.title) + '</b>, ' + n.pct + '%' + (n.note ? ' ("' + qbEsc(n.note) + '")' : '');
      })));
    }
    if (kid.goals.length > 0) {
      html += qbSection('Focus areas and goals', qbList(kid.goals.map(function (g) {
        return qbEsc(g.title) + ' <span style="color:#4a5270">(' + (g.scope === 'week' ? 'this week' : 'this month') + (g.status === 'done' ? ', done' : '') + ')</span>';
      })));
    }
    if (kid.review) {
      var r = kid.review;
      var lines = [['Keep', r.keep], ['Change', r.change], ['Stop', r.stop], ['Start', r.start], ['Notes', r.notes]]
        .filter(function (x) { return x[1]; }).map(function (x) { return '<b>' + x[0] + ':</b> ' + qbEsc(x[1]); });
      if (lines.length > 0) html += qbSection('His check-in notes', qbList(lines));
    }
  });
  if (appUrl) html += '<p style="margin:24px 0 0;font-size:14px"><a href="' + qbEsc(appUrl) + '">Open Questboard</a></p>';
  html += '<p style="margin:16px 0 0;font-size:12px;color:#4a5270">Sent by your own Google Apps Script. Nobody else receives this.</p></div>';
  return html;
}

// ---------------------------------------------------------------------------
// Apps Script glue (uses Google services; not run by the automated tests)
// ---------------------------------------------------------------------------

function qbConfig_() {
  var p = PropertiesService.getScriptProperties();
  var cfg = { url: p.getProperty('SUPABASE_URL'), key: p.getProperty('SUPABASE_KEY'), token: p.getProperty('QB_TOKEN'), appUrl: p.getProperty('APP_URL') };
  if (!cfg.url || !cfg.key || !cfg.token) throw new Error('Set SUPABASE_URL, SUPABASE_KEY and QB_TOKEN in Project Settings > Script properties.');
  cfg.url = cfg.url.replace(/\/+$/, '');
  return cfg;
}

function qbFetch_(cfg, fn, args, withBearer) {
  var headers = { apikey: cfg.key };
  if (withBearer) headers.Authorization = 'Bearer ' + cfg.key;
  return UrlFetchApp.fetch(cfg.url + '/rest/v1/rpc/' + fn, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: headers, payload: JSON.stringify(args || {})
  });
}

function qbRpc_(fn, args) {
  var cfg = qbConfig_();
  var res = qbFetch_(cfg, fn, args, true);
  // Some key types are accepted only in the apikey header: try once more without the Bearer copy.
  if (res.getResponseCode() === 401) res = qbFetch_(cfg, fn, args, false);
  var code = res.getResponseCode();
  var text = res.getContentText();
  if (code < 200 || code >= 300) {
    if (text.indexOf('QB:bad_token') >= 0) throw new Error('The automation key is wrong or was replaced. Create a new key in Settings and update QB_TOKEN.');
    if (code === 401 || code === 403) throw new Error('Supabase refused the key (' + code + '). Check SUPABASE_KEY (the publishable key) and that db/migrations/005_grants.sql was run. ' + text.slice(0, 200));
    throw new Error('Questboard request failed (' + code + '): ' + text.slice(0, 300));
  }
  return text ? JSON.parse(text) : null;
}

function qbToday_() {
  var who = qbRpc_('whoami', {});
  return who.today;                       // the date in the family's time zone
}

function qbFetchSummary_() {
  var range = qbWeekRange(qbToday_());
  return qbRpc_('automation_summary', { p_token: qbConfig_().token, p_from: range.from, p_to: range.to });
}

/** Sunday evening: e-mail the week to every parent on the allowlist. */
function weeklySummary() {
  var summary = qbFetchSummary_();
  MailApp.sendEmail({
    to: summary.parent_emails.join(','),
    subject: buildSummarySubject(summary),
    htmlBody: buildSummaryHtml(summary, qbConfig_().appUrl)
  });
}

/** Sends this week's e-mail only to you, right now. Use it to check the setup. */
function sendTestToMe() {
  var summary = qbFetchSummary_();
  MailApp.sendEmail({
    to: Session.getEffectiveUser().getEmail(),
    subject: '[Test] ' + buildSummarySubject(summary),
    htmlBody: buildSummaryHtml(summary, qbConfig_().appUrl)
  });
}

/** Weekly: save a full backup file to Drive and keep the newest 12. */
function driveBackup() {
  var doc = qbRpc_('automation_export', { p_token: qbConfig_().token });
  var folders = DriveApp.getFoldersByName('Questboard backups');
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder('Questboard backups');
  var name = 'questboard-backup-' + String(doc.exported_at).slice(0, 10) + '.json';
  folder.createFile(name, JSON.stringify(doc), 'application/json');
  var files = [];
  var it = folder.getFiles();
  while (it.hasNext()) files.push(it.next());
  files.sort(function (a, b) { return b.getDateCreated().getTime() - a.getDateCreated().getTime(); });
  files.slice(12).forEach(function (f) { f.setTrashed(true); });
}

/** Daily: one tiny request, so the free Supabase project is not paused for inactivity. */
function keepAwake() {
  qbRpc_('whoami', {});
}

/**
 * Phase 2: copy timed cards for the next 7 days into the Google Calendar named
 * "Questboard", so a Nest Hub can show them and answer "what's next on my calendar?".
 * Create that calendar first (Google Calendar > Other calendars > Create new calendar).
 */
function calendarSync() {
  var cals = CalendarApp.getCalendarsByName('Questboard');
  if (cals.length === 0) throw new Error('Create a Google Calendar named "Questboard" first.');
  var cal = cals[0];
  var today = qbToday_();
  var to = qbAddDays(today, 7);
  var cards = qbRpc_('automation_schedule', { p_token: qbConfig_().token, p_from: today, p_to: to })
    .filter(function (c) { return c.status === 'open'; });
  var tz = cal.getTimeZone();
  var wanted = {};
  cards.forEach(function (c) { wanted[c.card_id] = c; });
  var start = Utilities.parseDate(today + ' 00:00', tz, 'yyyy-MM-dd HH:mm');
  var end = Utilities.parseDate(qbAddDays(to, 1) + ' 00:00', tz, 'yyyy-MM-dd HH:mm');
  cal.getEvents(start, end).forEach(function (ev) {
    var id = ev.getTag('qb_card_id');
    if (!id) return;                                  // not ours: leave it alone
    var c = wanted[id];
    if (!c) { ev.deleteEvent(); return; }
    var s = qbCardStart_(c, tz);
    if (ev.getStartTime().getTime() !== s.getTime() || ev.getTitle() !== c.title ||
        ev.getEndTime().getTime() !== s.getTime() + c.minutes * 60000) {
      ev.setTitle(c.title);
      ev.setTime(s, new Date(s.getTime() + c.minutes * 60000));
    }
    delete wanted[id];
  });
  Object.keys(wanted).forEach(function (id) {
    var c = wanted[id];
    var s = qbCardStart_(c, tz);
    var ev = cal.createEvent(c.title, s, new Date(s.getTime() + c.minutes * 60000), { description: c.category_name });
    ev.setTag('qb_card_id', id);
  });
}

function qbCardStart_(c, tz) {
  var hh = ('0' + Math.floor(c.start_min / 60)).slice(-2);
  var mm = ('0' + (c.start_min % 60)).slice(-2);
  return Utilities.parseDate(c.date + ' ' + hh + ':' + mm, tz, 'yyyy-MM-dd HH:mm');
}

/** Run once. Creates the schedules (and replaces any older ones made by this script). */
function install() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('weeklySummary').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(18).create();
  ScriptApp.newTrigger('driveBackup').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(19).create();
  ScriptApp.newTrigger('keepAwake').timeBased().everyDays(1).atHour(6).create();
  keepAwake();                                        // fails now, with a clear message, if a property is wrong
}

/** Phase 2 only: also sync the calendar every 15 minutes. */
function installCalendarSync() {
  ScriptApp.newTrigger('calendarSync').timeBased().everyMinutes(15).create();
  calendarSync();
}
