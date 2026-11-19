/* ================= 0.54.0-beta: NA's events in your calendar =================
   A calendar file (.ics) of NA's events and summoning campaigns, now on and coming (the same ones Home shows: NA's
   data and the wiki), for Apple Calendar, Outlook, Google Calendar and the rest:
   - on Home, "Add to calendar" over the events opens a short list to tick, a reminder before each one ends, and the
     download;
   - on an event's page, "Add to calendar" downloads that one.
   Each one keeps the same id every time (its NA id or name, and its start), so importing a newer file updates them in
   calendars that go by it instead of adding them twice. Reminders are alarms in the file; Google Calendar drops those
   on import, so "its last day as an event of its own" puts a short event on the last day that the calendar's own
   notification covers. Kept in this browser: spirit-origin-list:v1:calendar = {rem, start, last, off: [unticked]}. */
const CAL_KEY = "spirit-origin-list:v1:calendar";
const CAL = {open: false};
const CAL_REM = [["", "No reminder"], ["PT1H", "1 hour before it ends"], ["P1D", "1 day before it ends"], ["P3D", "3 days before it ends"]];
const calPrefs = () => { try { const v = JSON.parse(lsGet(CAL_KEY) || "{}"); return v && typeof v === "object" && !Array.isArray(v) ? v : {}; } catch (e) { return {}; } };
function calSet(o) { lsSet(CAL_KEY, JSON.stringify(Object.assign(calPrefs(), o))); }
const calRem = () => { const p = calPrefs(); return CAL_REM.some((x) => x[0] === p.rem) ? p.rem : p.rem === undefined ? "P1D" : ""; };

/* ---------- the file ---------- */
const icsTime = (ts) => new Date(Math.round(ts) * 1000).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const icsEsc = (t) => String(t || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
// lines longer than 75 bytes go on, after a line break and a space
function icsFold(line) {
  const enc = new TextEncoder(); let out = "", cur = "", n = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (n + b > (out ? 74 : 75)) { out += (out ? "\r\n " : "") + cur; cur = ""; n = 0; }
    cur += ch; n += b;
  }
  return out ? out + "\r\n " + cur : cur;
}
const calSlug = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "event";
const CAL_REM_T = {PT1H: "1 hour", P1D: "1 day", P3D: "3 days"};
// items: [{k: "event" | "banner", id, n, s, e, url, d}]
function icsText(items, o) {
  o = o || {};
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Fate Grand Index//NA events//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:Fate/Grand Order NA"];
  const stamp = icsTime(Date.now() / 1000), now = Date.now() / 1000;
  items.forEach((x) => {
    if (!(x.s > 0) || !(x.e > x.s)) return;
    const uid = "fgi-" + x.k + "-" + (x.id > 0 ? x.id : calSlug(x.n)) + "-" + Math.round(x.s) + "@fategrandindex.com";
    L.push("BEGIN:VEVENT", "UID:" + uid, "DTSTAMP:" + stamp, "DTSTART:" + icsTime(x.s), "DTEND:" + icsTime(x.e), "SUMMARY:" + icsEsc(x.n), "TRANSP:TRANSPARENT");
    if (x.d) L.push("DESCRIPTION:" + icsEsc(x.d));
    if (x.url) L.push("URL:" + x.url);
    if (o.rem) L.push("BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + icsEsc(x.n + " ends in " + CAL_REM_T[o.rem]), "TRIGGER;RELATED=END:-" + o.rem, "END:VALARM");
    if (o.start && x.s > now) L.push("BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + icsEsc(x.n + " starts now"), "TRIGGER:PT0S", "END:VALARM");
    L.push("END:VEVENT");
    if (o.last && x.e - x.s > 2 * 86400) {
      L.push("BEGIN:VEVENT", "UID:last-" + uid, "DTSTAMP:" + stamp, "DTSTART:" + icsTime(x.e - 86400), "DTEND:" + icsTime(x.e), "SUMMARY:" + icsEsc("Last day: " + x.n), "TRANSP:TRANSPARENT");
      if (x.url) L.push("URL:" + x.url);
      L.push("END:VEVENT");
    }
  });
  L.push("END:VCALENDAR");
  return L.map(icsFold).join("\r\n") + "\r\n";
}
function calDownload(items, name) {
  const p = calPrefs(), txt = icsText(items, {rem: calRem(), start: !!p.start, last: !!p.last});
  localDownloads.save({data: new Blob([txt], {type: "text/calendar;charset=utf-8"}), filename: name});
  return txt;
}
const calHere = () => HOSTED ? location.origin + location.pathname : "";

/* ---------- what there is to add: Home's events and campaigns ---------- */
function calItems() {
  if (typeof live === "undefined" || typeof hbEvents !== "function") return [];
  const now = Date.now() / 1000, evs = hbEvents(), camps = hbCampaigns(evs), out = [];
  evs.cur.concat(evs.up).forEach((x) => {
    if (!(x.s > 0 && x.e > now)) return;
    const url = x.id > 0 && calHere() ? calHere() + "#event/" + x.id : x.wiki ? WIKI + "/wiki/" + encodeURIComponent(x.wiki.replace(/ /g, "_")) : "";
    out.push({key: "e:" + (x.id || calSlug(x.n)) + ":" + Math.round(x.s), k: "event", id: x.id > 0 ? x.id : 0, n: x.n, s: x.s, e: x.e, url: url,
      d: [x.req ? "Needs " + x.req + " cleared." : "", x.story ? "Story after " + x.story + "." : "", "NA's times, in your time zone. From Fate/Grand Index."].filter(Boolean).join(" ")});
  });
  camps.forEach((b) => {
    if (!(b.s > 0 && b.e > now)) return;
    const who = (b.ft || []).filter((x) => !x.ce && x.n).map((x) => x.n + (x.r ? " (★" + x.r + ")" : ""));
    out.push({key: "b:" + (b.id || calSlug(b.n)) + ":" + Math.round(b.s), k: "banner", id: b.id > 0 ? b.id : 0, n: liveText(b.n), s: b.s, e: b.e, url: "",
      d: (who.length ? "Rate-up: " + who.join(", ") + ". " : "") + "NA's times, in your time zone. From Fate/Grand Index."});
  });
  return out;
}
const calDay = (ts) => new Date(ts * 1000).toLocaleDateString("en-GB", {day: "numeric", month: "short"});
function calPanelHTML() {
  const items = calItems(), off = new Set(calPrefs().off || []), now = Date.now() / 1000, p = calPrefs(), rem = calRem();
  const row = (x) => `<li><label><input type="checkbox" data-cal-pick="${esc(x.key)}"${off.has(x.key) ? "" : " checked"}><span><b>${esc(x.n)}</b><small>${x.s > now ? "starts " + calDay(x.s) + ", " : ""}ends ${calDay(x.e)}</small></span></label></li>`;
  const ev = items.filter((x) => x.k === "event"), ba = items.filter((x) => x.k === "banner"), n = items.filter((x) => !off.has(x.key)).length;
  return `<div class="cal" role="group" aria-label="Add to your calendar">
    ${items.length ? `${ev.length ? `<p class="cal-h">Events</p><ul class="cal-list">${ev.map(row).join("")}</ul>` : ""}${ba.length ? `<p class="cal-h">Summoning campaigns</p><ul class="cal-list">${ba.map(row).join("")}</ul>` : ""}
    <div class="cal-ctl"><label class="cal-f"><span>Reminder</span><select data-cal="rem">${CAL_REM.map((x) => `<option value="${x[0]}"${x[0] === rem ? " selected" : ""}>${esc(x[1])}</option>`).join("")}</select></label>
      <label class="cal-chk"><input type="checkbox" data-cal="start"${p.start ? " checked" : ""}> Also when coming ones start</label>
      <label class="cal-chk"><input type="checkbox" data-cal="last"${p.last ? " checked" : ""}> Each one's last day as an event of its own</label></div>
    <div class="cal-acts"><button type="button" class="btn sm primary" data-action="cal-get"${n ? "" : " disabled"}>Download ${n === 1 ? "1 event" : n + " events"} (.ics)</button><button type="button" class="btn ghost sm" data-action="cal-close">Close</button></div>
    <p class="cal-note">Open the file and your calendar app adds them. Importing a newer file updates the ones already there in calendars that match them by their id. Google Calendar leaves out reminders from a file: the last-day events get its own notification.</p>`
    : `<p class="cal-note">Nothing to add yet: NA's events show here once their data or the wiki has them.</p><div class="cal-acts"><button type="button" class="btn ghost sm" data-action="cal-close">Close</button></div>`}</div>`;
}
const hbBoardHTML67 = hbBoardHTML;
hbBoardHTML = function () {
  const h = hbBoardHTML67.apply(this, arguments);
  if (typeof liveOn === "function" && !liveOn()) return h;
  const at = '<h3 class="hb-h">Events <small>NA</small></h3>';
  if (!h.includes(at)) return h;
  const btn = `<button type="button" class="btn ghost sm cal-btn" data-action="${CAL.open ? "cal-close" : "cal-open"}" aria-expanded="${CAL.open}">Add to calendar</button>`;
  return h.replace(at, at + btn).replace('<h4 class="hb-sub">Now on</h4>', (CAL.open ? calPanelHTML() : "") + '<h4 class="hb-sub">Now on</h4>');
};
function calRepaint(focus) {
  if (typeof hbPaint === "function") hbPaint();
  if (focus) { const b = document.querySelector(focus); if (b) b.focus({preventScroll: true}); }
}
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest('[data-action^="cal-"]'); if (!b) return;
  const a = b.dataset.action;
  if (a === "cal-open") { CAL.open = true; calRepaint(".cal input, .cal [data-action='cal-close']"); }
  else if (a === "cal-close") { CAL.open = false; calRepaint(".cal-btn"); }
  else if (a === "cal-get") {
    const off = new Set(calPrefs().off || []), items = calItems().filter((x) => !off.has(x.key));
    if (!items.length) return;
    calDownload(items, "fgo-na-events.ics");
    toast(plural(items.length, "event") + " in fgo-na-events.ics. Open it to add them to your calendar.");
  } else if (a === "cal-ev") {
    const m = typeof EV !== "undefined" && EV.m; if (!m || !(m.e > Date.now() / 1000)) return;
    const url = m.id > 0 && calHere() ? calHere() + "#event/" + m.id : m.wt ? wikiURL(m.wt) : "";
    calDownload([{k: "event", id: m.id > 0 ? m.id : 0, n: m.n, s: m.s, e: m.e, url: url, d: "NA's times, in your time zone. From Fate/Grand Index."}], calSlug(m.n) + ".ics");
    toast(m.n + " is in " + calSlug(m.n) + ".ics. Open it to add it to your calendar.");
  }
});
document.addEventListener("change", (e) => {
  const t = e.target; if (!t || !t.closest || !t.closest(".cal")) return;
  if (t.dataset.calPick != null) {
    const off = new Set(calPrefs().off || []); if (t.checked) off.delete(t.dataset.calPick); else off.add(t.dataset.calPick);
    calSet({off: Array.from(off).slice(-200)});
    const n = calItems().filter((x) => !off.has(x.key)).length, g = document.querySelector('.cal [data-action="cal-get"]');
    if (g) { g.textContent = "Download " + (n === 1 ? "1 event" : n + " events") + " (.ics)"; g.disabled = !n; }
  } else if (t.dataset.cal === "rem") calSet({rem: t.value});
  else if (t.dataset.cal === "start" || t.dataset.cal === "last") calSet({[t.dataset.cal]: t.checked});
});
// on an event's page
if (typeof evHTML === "function") {
  const evHTML67 = evHTML;
  evHTML = function () {
    const h = evHTML67.apply(this, arguments), m = typeof EV !== "undefined" && EV.m;
    if (!m || !(m.e > Date.now() / 1000) || !(m.s > 0)) return h;
    const at = '<button type="button" class="btn ghost sm" data-action="ev-reload"';
    return h.includes(at) ? h.replace(at, `<button type="button" class="btn ghost sm" data-action="cal-ev">Add to calendar</button>` + at) : h;
  };
}
// for the tests
window.__fgiCal = {items: () => calItems(), ics: (items, o) => icsText(items, o), fold: icsFold};
