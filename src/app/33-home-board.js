/* ================= 0.24.0: Home's event board, summoning campaigns and a sidebar =================
   Under the greeting: NA's current and upcoming events as big banner cards, a strip of summoning campaigns (current
   and upcoming, each marked as an event's campaign or another kind), and beside them a sidebar with the server times,
   the game's version and the latest NA update.
   Where it comes from, while live updates are on: the events and banners Atlas Academy has in NA's data (On NA now),
   the wiki's Current and Upcoming Event (US) pages (their headers: banner, dates, requirement, new servants), the
   App Store's version of the game (NA and JP), and the wiki's Latest Updates list. It's all kept in this browser and
   asked for again every few hours. With live updates off only the clocks run. */
const HB_FRESH = 3 * 3600e3, HB_V = 1;
const HB_APPS = {na: ["1183802626", "us"], jp: ["1015521325", "jp"]};
const HB = {wiki: null, app: null, busy: false, err: "", tick: 0};
const hbDate = (ts) => new Date(ts * 1000).toLocaleDateString("en-GB", {day: "numeric", month: "short"});
const hbWhen = (ts, both) => { const d = new Date(ts * 1000); return d.toLocaleDateString("en-GB", {weekday: "short", day: "numeric", month: "short"}) + (both ? ", " + d.toLocaleTimeString("en-GB", {hour: "2-digit", minute: "2-digit"}) : ""); };
function hbLeft(ts) {
  const s = ts - Date.now() / 1000; if (s <= 0) return "now";
  const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.max(1, Math.floor(s % 3600 / 60));
  return d ? d + "d " + h + "h" : h ? h + "h " + m + "m" : m + "m";
}

/* ---------- the wiki: which events are on and coming, and what they bring ---------- */
// "November 12th 2026 01:00" in PST (UTC-8) or PDT (UTC-7); without a zone, the one in force on that date
function hbTime(t, tz) {
  const x = /([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/i.exec(String(t || "")); if (!x) return 0;
  const mo = MONTHS.indexOf(x[1].toLowerCase()); if (mo < 0) return 0;
  let off = /pdt/i.test(tz || "") ? 7 : /pst/i.test(tz || "") ? 8 : /jst/i.test(tz || "") ? -9 : /utc|gmt/i.test(tz || "") ? 0 : (mo > 2 && mo < 10 ? 7 : 8);
  return Date.UTC(+x[3], mo, +x[2], (+x[4] || 0) + off, +x[5] || 0) / 1000;
}
const hbClean = (s) => liveText(String(s || "").replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, "$1").replace(/'''?|<[^>]*>|\{\{[^{}]*\}\}/g, " ")).trim();
function hbHeader(title, wt) {
  const s = String(wt || ""), x = /\{\{\s*EventHeader\w*([\s\S]*?)\n\s*\}\}/i.exec(s) || /\{\{\s*EventHeader\w*([\s\S]*?)\}\}/i.exec(s); if (!x) return null;
  const h = {}; ("\n" + x[1]).split(/\n\s*\|/).forEach((l) => { const i = l.indexOf("="); if (i > 0) h[l.slice(0, i).trim().toLowerCase()] = l.slice(i + 1).trim(); });
  // the new servants under the header: "{{Star}}… {{Archer}} [[Tutankhamun]] {{LimitedS}}"
  const pick = [], seen = new Set();
  s.replace(/\{\{(Saber|Archer|Lancer|Rider|Caster|Assassin|Berserker|Ruler|Avenger|Moon ?Cancer|Alter ?Ego|Foreigner|Pretender|Shielder|Beast)\}\}\s*\[\[([^\]|]+)(?:\|[^\]]*)?\]\]\s*(\{\{(LimitedS|EventR|Limited|StoryS)\}\})?/gi, (m, c, n, t, kind) => {
    n = n.trim(); if (seen.has(n)) return m; seen.add(n);
    pick.push({n: n, c: c.replace(/(Moon|Alter)\s?(Cancer|Ego)/i, "$1 $2"), k: /event/i.test(kind || "") ? "reward" : "pickup"}); return m;
  });
  const name = hbClean(h.name) || title.replace(/\s*\((US|NA)\)\s*$/i, "");
  return {t: title, n: name, img: (h.image || "").replace(/^(file|image):/i, "").trim(), s: hbTime(h.start, h.timezone), e: hbTime(h.end, h.timezone),
    req: hbClean(h.requirement).slice(0, 80), story: hbClean(h.story).slice(0, 80), pick: pick.slice(0, 6)};
}
// the wiki's Latest Updates (NA): strengthening quests, new servants, Craft Essences, Command Codes, items
function hbUpdates(wt) {
  const s = String(wt || ""), out = {sq: [], sv: [], ce: [], cc: [], it: []};
  s.split(/\n/).forEach((l) => {
    const m = /^\s*\|\s*(squest|newserv|newce|newcc|newitem)\d+\s*=\s*(.+)$/.exec(l); if (!m) return;
    const v = m[2], inner = (re) => { const x = re.exec(v); return x ? x[1].trim() : ""; };
    if (m[1] === "squest") { const n = inner(/\{\{\s*Inum\s*\|\s*\{\{\s*([^|{}]+?)\s*[|}]/i) || inner(/\{\{\s*([^|{}]+?)\s*[|}]/); if (n) out.sq.push({n: n, k: /ITL/.test(v) ? "Interlude" : /NP Icon/i.test(v) ? "NP" : /Skill Icon/i.test(v) ? "Skill" : ""}); }
    else if (m[1] === "newserv") { const n = inner(/\{\{\s*Inum\s*\|\s*\{\{\s*([^|{}]+?)\s*[|}]/i) || inner(/\{\{\s*([^|{}]+?)\s*[|}]/); if (n) out.sv.push({n: n, k: /EventR/.test(v) ? "Event" : /LimitedS/.test(v) ? "Limited" : ""}); }
    else if (m[1] === "newce") { const x = /Craft Essence Icon\s*\|\s*([^|{}]+?)\s*\|\s*(\d+)/i.exec(v); if (x) out.ce.push({n: x[1], no: +x[2]}); }
    else if (m[1] === "newcc") { const x = /Command Code Icon\s*\|\s*([^|{}]+?)\s*\|\s*(\d+)/i.exec(v); if (x) out.cc.push({n: x[1], no: +x[2]}); }
    else { const n = inner(/\{\{\s*([^|{}]+?)\s*[|}]/); if (n) out.it.push({n: n}); }
  });
  return out;
}
async function hbWikiLoad() {
  const mem = async (cat) => { const j = await wikiJSON({action: "query", list: "categorymembers", cmtitle: "Category:" + cat, cmlimit: "20", cmnamespace: "0"}); return ((j.query || {}).categorymembers || []).map((x) => x.title); };
  const [cur, up] = await Promise.all([mem("Current Event (US)"), mem("Upcoming Event (US)")]);
  const titles = cur.concat(up).slice(0, 40).concat(["Template:GameUpdatesNA"]);
  const r = await wikiJSON({action: "query", prop: "revisions", rvprop: "content", rvslots: "main", rvsection: "0", titles: titles.join("|")});
  const txt = {}; ((r.query || {}).pages || []).forEach((p) => { txt[p.title] = p.revisions && p.revisions[0] ? ((p.revisions[0].slots || {}).main || {}).content || p.revisions[0].content || "" : ""; });
  const evs = cur.concat(up).map((t) => hbHeader(t, txt[t])).filter((x) => x && x.s);
  const files = [...new Set(evs.map((x) => x.img).filter(Boolean))];
  if (files.length) {
    const im = await wikiJSON({action: "query", prop: "imageinfo", iiprop: "url", iiurlwidth: "640", titles: files.map((f) => "File:" + f).join("|")});
    const url = {}; ((im.query || {}).pages || []).forEach((p) => { const i = p.imageinfo && p.imageinfo[0]; if (i) url[p.title.replace(/^File:/, "")] = i.thumburl || i.url; });
    // the API answers with spaces where the page wrote underscores
    evs.forEach((x) => { x.url = url[x.img] || url[x.img.replace(/_/g, " ")] || ""; });
  }
  return {v: HB_V, at: Date.now(), ev: evs, upd: hbUpdates(txt["Template:GameUpdatesNA"])};
}
async function hbAppLoad() {
  const one = async ([id, cc]) => {
    const j = await evJSON("https://itunes.apple.com/lookup?id=" + id + "&country=" + cc), x = j && j.results && j.results[0]; if (!x) return null;
    return {v: String(x.version || ""), at: Date.parse(x.currentVersionReleaseDate) / 1000 || 0, notes: String(x.releaseNotes || "").slice(0, 600)};
  };
  const [na, jp] = await Promise.all([one(HB_APPS.na).catch(() => null), one(HB_APPS.jp).catch(() => null)]);
  if (!na && !jp) throw new Error("no answer");
  return {v: HB_V, at: Date.now(), na: na, jp: jp};
}
async function hbLoad(force) {
  if (HB.busy) return;
  if (!HB.wiki) { const c = await kv.get("hb:wiki"); if (c && c.v === HB_V) HB.wiki = c; }
  if (!HB.app) { const c = await kv.get("hb:app"); if (c && c.v === HB_V) HB.app = c; }
  const old = (x) => !x || Date.now() - x.at > HB_FRESH;
  if (!liveOn() || (!force && !old(HB.wiki) && !old(HB.app))) { hbPaint(); return; }
  HB.busy = true; HB.err = ""; hbPaint();
  try {
    const [w, a] = await Promise.all([force || old(HB.wiki) ? hbWikiLoad().catch(() => null) : null, force || old(HB.app) ? hbAppLoad().catch(() => null) : null]);
    if (w) { HB.wiki = w; await kv.set("hb:wiki", w); }
    if (a) { HB.app = a; await kv.set("hb:app", a); }
    if (!w && (force || !HB.wiki)) HB.err = navigator.onLine === false ? "You're offline." : "The wiki didn't answer.";
  } finally { HB.busy = false; hbPaint(); }
}

/* ---------- what's on: the wiki's events matched with NA's data ---------- */
function hbEvents() {
  const now = Date.now() / 1000, d = live.data, at = d ? d.ev.filter((x) => x.k === "event" && x.e > now) : [];
  const out = [], used = new Set();
  (HB.wiki ? HB.wiki.ev : []).forEach((w) => {
    if (w.e && w.e <= now) return;
    const wt = evToks(w.n), m = at.find((x) => !used.has(x.id) && (Math.abs(x.s - w.s) < 3 * 3600 || [...evToks(x.n)].filter((t) => wt.has(t)).length >= 2) && Math.abs(x.s - w.s) < 3 * 86400);
    if (m) used.add(m.id);
    out.push({n: w.n, s: w.s || (m && m.s), e: w.e || (m && m.e), img: w.url, req: w.req, story: w.story, pick: w.pick, wiki: w.t, id: m ? m.id : 0});
  });
  at.forEach((x) => { if (!used.has(x.id) && !/^(recollection quest|.*download.*campaign)$/i.test(x.n)) out.push({n: x.n, s: x.s, e: x.e, img: "", req: "", story: "", pick: [], wiki: "", id: x.id}); });
  const cur = out.filter((x) => x.s <= now).sort((a, b) => a.e - b.e), up = out.filter((x) => x.s > now).sort((a, b) => a.s - b.s);
  return {cur: cur, up: up};
}
// a banner belongs to an event when it shares words with its name or starts with it
function hbCampaigns(evs) {
  const now = Date.now() / 1000, d = live.data, all = evs.cur.concat(evs.up), out = [];
  const evOf = (b) => all.find((x) => { const bt = evToks(b.n), xt = evToks(x.n); return (b.s < x.e && b.e > x.s - 86400) && ([...bt].some((t) => xt.has(t)) || Math.abs(b.s - x.s) < 3600); });
  (d ? d.ba : []).filter((b) => b.e > now && b.t !== "Friend Points").forEach((b) => { const ev = evOf(b); out.push({n: b.n, s: b.s, e: b.e, ft: b.ft, ev: ev ? ev.n : "", id: b.id, src: "na"}); });
  // events the wiki has announced bring their pickups; shown when NA's data has no banner for them yet
  all.filter((x) => x.s > now && x.pick.some((p) => p.k === "pickup")).forEach((x) => {
    if (out.some((b) => b.ev === x.n)) return;
    out.push({n: x.n + " Summoning Campaign", s: x.s, e: x.e, ft: x.pick.filter((p) => p.k === "pickup").map((p) => { const a = hbAtlas(p.n); return a ? {no: a.no, n: a.n, c: a.c, r: a.r, f: a.f} : {n: p.n, c: p.c}; }), ev: x.n, id: 0, src: "wiki"});
  });
  return out.sort((a, b) => (a.s > now) - (b.s > now) || (a.s > now ? a.s - b.s : a.e - b.e));
}

/* ---------- drawing it ---------- */
// a wiki name to an NA servant: "Yagyū Munenori" is "Yagyu Tajima-no-kami Munenori" in the data
const hbAtlas = (n) => ATLAS_S.find((y) => nname(y.n) === nname(n)) || (typeof autoMatch === "function" ? autoMatch({name: n, cls: "", rarity: 0}) : null);
const hbFace = (x) => { const a = x.no ? ATLAS_BY_NO.get(x.no) : null, f = (a && a.f) || x.f; return f ? `<img src="${esc(aimg(f))}" alt="${esc(x.n || "")}" title="${esc(x.n || "")}" loading="lazy" decoding="async">` : `<i class="hb-noface" title="${esc(x.n || "")}">${esc((x.n || "?").slice(0, 1))}</i>`; };
function hbCard(x, up, i) {
  const now = Date.now() / 1000, span = Math.max(1, x.e - x.s), p = up ? 0 : clamp((now - x.s) / span, 0, 1);
  const soon = up ? x.s - now < 3 * 86400 : x.e - now < 86400;
  const faces = x.pick.length ? `<span class="hb-faces">${x.pick.map((p) => { const a = hbAtlas(p.n); return `<span class="hb-pk ${p.k}">${hbFace(a ? {no: a.no, n: a.n} : {n: p.n})}<i>${p.k === "reward" ? "Free" : "Pickup"}</i></span>`; }).join("")}</span>` : "";
  const open = x.id ? `data-action="ev-open" data-ev="${x.id}"` : x.wiki ? `data-action="hb-wiki" data-t="${esc(x.wiki)}"` : "";
  return `<article class="hb-ev${up ? " up" : " now"}${soon ? " soon" : ""}${x.img ? "" : " noimg"}" style="--i:${i};--p:${p.toFixed(3)}">
    <button type="button" class="hb-hit" ${open} aria-label="${esc(x.n)}${x.id ? ": open the Event page" : x.wiki ? ": open it on the wiki" : ""}"${open ? "" : " disabled"}>
      <span class="hb-art">${x.img ? `<img src="${esc(x.img)}" alt="" loading="lazy" decoding="async">` : `<span class="hb-ph" aria-hidden="true">${esc(x.n)}</span>`}<i class="hb-shine" aria-hidden="true"></i>
        <span class="hb-badge">${up ? (soon ? "Soon" : "Upcoming") : "<b class=\"hb-dot\"></b>Now on"}</span></span>
      <span class="hb-body"><b class="hb-n">${esc(x.n)}</b>
        <span class="hb-when"><time>${esc(hbWhen(x.s, true))}</time> → <time>${esc(hbWhen(x.e, true))}</time></span>
        <span class="hb-left">${up ? "starts in " : "ends in "}<b data-hb-t="${up ? x.s : x.e}">${esc(hbLeft(up ? x.s : x.e))}</b></span>
        ${up ? "" : `<span class="hb-bar" aria-hidden="true"><i></i></span>`}
        ${x.req || x.story ? `<span class="hb-req">${x.req ? `Needs <b>${esc(x.req)}</b> cleared` : ""}${x.req && x.story ? " · " : ""}${x.story ? `story after <b>${esc(x.story)}</b>` : ""}</span>` : ""}
        ${faces}</span>
    </button>
    ${x.wiki ? `<a class="hb-wl" href="${esc(WIKI + "/wiki/" + encodeURIComponent(x.wiki.replace(/ /g, "_")))}" target="_blank" rel="noopener">Wiki ↗</a>` : ""}
  </article>`;
}
function hbBoardHTML() {
  if (!liveOn()) return `<section class="hb-events off"><h3 class="hb-h">Events</h3><p class="tr-none">Turn on live updates to see NA's events, upcoming events and summoning campaigns here.</p><div><button type="button" class="btn sm" data-action="live-on">Turn on live updates</button></div></section>`;
  const evs = hbEvents(), camps = hbCampaigns(evs), now = Date.now() / 1000;
  const empty = (t) => `<p class="tr-none hb-empty">${t}</p>`;
  const wait = HB.busy && !HB.wiki ? "Getting the events from the wiki…" : "";
  const camp = (b) => `<li class="hb-camp${b.s > now ? " up" : ""}"><span class="hb-cf">${b.ft.slice(0, 4).map(hbFace).join("") || `<i class="hb-noface">?</i>`}</span>
      <span class="hb-cm"><b>${esc(liveText(b.n))}</b><span class="hb-ctag ${b.ev ? "ev" : "oth"}">${b.ev ? "Event campaign" : "Other campaign"}</span><small>${b.s > now ? "starts in " : "ends in "}<b data-hb-t="${b.s > now ? b.s : b.e}">${esc(hbLeft(b.s > now ? b.s : b.e))}</b>${b.src === "wiki" ? " · announced on the wiki" : ""}</small></span>
      ${b.id && b.e > now && b.ft.some((x) => x.no && !x.ce) ? `<button type="button" class="btn sm ghost" data-action="ev-sim" data-g="${b.id}">Simulate</button>` : ""}</li>`;
  return `<section class="hb-events" aria-label="Events">
    <div class="hb-hrow"><h3 class="hb-h">Events <small>NA</small></h3>${HB.err ? `<span class="hb-err">${esc(HB.err)}</span>` : ""}</div>
    <h4 class="hb-sub">Now on</h4>
    <div class="hb-grid">${evs.cur.map((x, i) => hbCard(x, false, i)).join("") || empty(wait || "No event running right now.")}</div>
    <h4 class="hb-sub">Coming up</h4>
    <div class="hb-grid up">${evs.up.map((x, i) => hbCard(x, true, i)).join("") || empty(wait || "Nothing announced for NA yet.")}</div>
  </section>
  <section class="hb-camps" aria-label="Summoning campaigns">
    <h3 class="hb-h">Summoning campaigns <small>now and coming</small></h3>
    ${camps.length ? `<ul class="hb-clist">${camps.map(camp).join("")}</ul>` : empty(live.data ? "No limited summoning campaign right now." : "Waiting for NA's data…")}
  </section>`;
}
function hbClockHTML() {
  return `<section class="hb-side-b hb-clock"><h3 class="hb-h">Server time</h3>
    <dl><div><dt>NA</dt><dd><b data-hb-clk="America/Los_Angeles">--:--</b><small data-hb-z="America/Los_Angeles"></small></dd></div>
      <div><dt>JP</dt><dd><b data-hb-clk="Asia/Tokyo">--:--</b><small>JST</small></dd></div>
      <div><dt>You</dt><dd><b data-hb-clk="">--:--</b><small data-hb-z=""></small></dd></div></dl></section>`;
}
function hbVersionHTML() {
  const a = HB.app, dv = /@(\d+)/.exec(live.ver || ""), row = (k, t) => { const x = a && a[k]; return `<div><dt>${t}</dt><dd>${x ? `<b>${esc(x.v)}</b><small>since ${esc(hbDate(x.at))}</small>` : `<b>—</b>`}</dd></div>`; };
  const notes = a && a.na && a.na.notes ? a.na.notes.replace(/^\s*\[?ver[\d.]+\]?\s*update contents\s*/i, "").replace(/thank you for (playing|your continuous support)[^.]*\.\s*/gi, "").trim() : "";
  return `<section class="hb-side-b hb-ver"><h3 class="hb-h">Game version</h3>
    ${liveOn() ? `<dl>${row("na", "NA")}${row("jp", "JP")}</dl>${notes ? `<details class="hb-notes"><summary>What NA's update changed</summary><p>${esc(notes).replace(/\n+/g, "<br>")}</p></details>` : ""}
    ${dv ? `<p class="hb-small">NA's game data last changed ${esc(hbWhen(+dv[1], true))} (Atlas Academy).</p>` : ""}<p class="hb-small">From the App Store.</p>` : `<p class="tr-none">Shown with live updates on.</p>`}</section>`;
}
function hbUpdatesHTML() {
  const u = HB.wiki && HB.wiki.upd; if (!liveOn()) return "";
  if (!u) return `<section class="hb-side-b hb-upd"><h3 class="hb-h">Latest NA update</h3><p class="tr-none">${HB.busy ? "Loading…" : "Not loaded yet."}</p></section>`;
  const sv = (x) => { const a = hbAtlas(x.n); return `<li>${a ? `<button type="button" class="hb-u" data-action="pc-open" data-no="${a.no}">${hbFace({no: a.no, n: a.n})}<span>${esc(a.n)}</span>${x.k ? `<i>${esc(x.k)}</i>` : ""}</button>` : `<span class="hb-u">${hbFace({n: x.n})}<span>${esc(x.n)}</span>${x.k ? `<i>${esc(x.k)}</i>` : ""}</span>`}</li>`; };
  const ce = (x) => { const c = CE_BY_NO.get(x.no); return `<li>${c ? `<button type="button" class="hb-u" data-action="ce-open" data-no="${c.no}"><img src="${esc(ceFace(c))}" alt="" loading="lazy"><span>${esc(c.n)}</span></button>` : `<span class="hb-u"><i class="hb-noface">CE</i><span>${esc(x.n)}</span></span>`}</li>`; };
  const part = (t, list, fn) => list.length ? `<h4>${t}</h4><ul class="hb-ul">${list.map(fn).join("")}</ul>` : "";
  return `<section class="hb-side-b hb-upd"><h3 class="hb-h">Latest NA update</h3>
    ${part("Strengthening quests", u.sq, sv)}${part("New servants", u.sv, sv)}${part("New Craft Essences", u.ce.slice(0, 8), ce)}
    ${u.cc.length ? `<h4>Command Codes</h4><p class="hb-small">${u.cc.map((x) => esc(x.n)).join(", ")}</p>` : ""}${u.it.length ? `<h4>New items</h4><p class="hb-small">${u.it.map((x) => esc(x.n)).join(", ")}</p>` : ""}
    <p class="hb-small">From the wiki's Latest Updates. <a href="${WIKI}/wiki/Fate/Grand_Order_Wikia" target="_blank" rel="noopener">Wiki ↗</a></p></section>`;
}
function hbHTML() {
  return `<div class="hb">
    <div class="hb-main">${hbBoardHTML()}</div>
    <aside class="hb-side" aria-label="Server time, game version and updates">${hbClockHTML()}${hbVersionHTML()}${hbUpdatesHTML()}</aside>
  </div>`;
}
let hbDrawn = false;
function hbPaint() {
  const home = document.getElementById("home"); if (!home || S.tab !== "home") return;
  const old = home.querySelector(".hb"), hero = home.querySelector(".hm-hero");
  const t = document.createElement("div"); t.innerHTML = hbHTML(); const nu = t.firstElementChild;
  if (hbDrawn) nu.classList.add("seen");
  if (old) old.replaceWith(nu); else if (hero) hero.insertAdjacentElement("afterend", nu); else home.prepend(nu);
  hbDrawn = true; hbClock();
}
// the clocks and countdowns move once a second while Home is open
function hbClock() {
  const home = document.getElementById("home"); if (!home || S.tab !== "home" || document.hidden) return;
  const now = new Date();
  home.querySelectorAll("[data-hb-clk]").forEach((el) => {
    const z = el.dataset.hbClk, o = {hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false}; if (z) o.timeZone = z;
    try { el.textContent = now.toLocaleTimeString("en-GB", o); } catch (e) { el.textContent = now.toLocaleTimeString("en-GB"); }
  });
  home.querySelectorAll("[data-hb-z]").forEach((el) => {
    if (el.textContent) return;
    const z = el.dataset.hbZ, o = {timeZoneName: "short"}; if (z) o.timeZone = z;
    try { el.textContent = (now.toLocaleTimeString("en-US", o).split(" ").pop()) || ""; } catch (e) {}
  });
  if (now.getSeconds() === 0 || !hbClock.done) home.querySelectorAll("[data-hb-t]").forEach((el) => { el.textContent = hbLeft(+el.dataset.hbT); });
  hbClock.done = true;
}
setInterval(hbClock, 1000);
const renderHome24b = renderHome;
renderHome = function () {
  const r = renderHome24b.apply(this, arguments);
  if (S.tab === "home" && document.querySelector("#home .hm-hero")) { hbPaint(); hbLoad(false); }
  return r;
};
// On NA now's data feeds the board too
const liveRefresh24b = liveRefresh;
liveRefresh = function () { liveRefresh24b(); if (S.tab === "home" && !liveBusy) hbPaint(); };
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest("[data-action]"); if (!b) return;
  const a = b.dataset.action;
  if (a === "live-check") setTimeout(() => hbLoad(true), 0);
  if (a === "live-on") setTimeout(() => hbLoad(true), 0);
  if (a === "hb-wiki") window.open(WIKI + "/wiki/" + encodeURIComponent(b.dataset.t.replace(/ /g, "_")), "_blank", "noopener");
});
