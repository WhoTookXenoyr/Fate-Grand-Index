/* ================= 0.21.0: live from NA — events, campaigns, login bonuses, summon banners and new releases ================= */
// Atlas Academy publishes the NA game data as files that change with every NA update. While the page is open and online,
// at most every few hours, it asks for the tiny info.json; only when NA's data changed does it download four small lists
// (servants, Craft Essences, events, summons: about 2.3 MB) and keep the few hundred lines shown on Home. That summary is
// cached in this browser, so Home still shows it offline. Your roster is never touched.
const LIVE_KEY = "spirit-origin-list:v1:live";
const LIVE_API = "https://api.atlasacademy.io/export/NA/";
const LIVE_DB = "https://apps.atlasacademy.io/db/NA/";
const LIVE_DEFAULT = true; // tests/run.py turns this off in its copies, so a test only calls Atlas Academy (its stand-in) on purpose
const LIVE_EVERY = 6 * 3600e3, LIVE_RETRY = 30 * 60e3, LIVE_LONG = 120 * 86400;
const LIVE_CLS = {saber: "Saber", archer: "Archer", lancer: "Lancer", rider: "Rider", caster: "Caster", assassin: "Assassin", berserker: "Berserker",
  shielder: "Shielder", ruler: "Ruler", avenger: "Avenger", moonCancer: "Moon Cancer", alterEgo: "Alter Ego", foreigner: "Foreigner", pretender: "Pretender", beast: "Beast"};
const liveCls = (c) => LIVE_CLS[c] || (/^beast/i.test(c || "") ? "Beast" : String(c || "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (m) => m.toUpperCase()));
// what kind of entry an Atlas event is; unknown kinds are sorted by their name, so a new kind still shows up somewhere
const LIVE_KINDS = {eventQuest: "event", raidBoss: "event", point: "event", boxGacha: "event", boxGachaPoint: "event", warBoard: "event", pvp: "event", bank: "event",
  loginBonus: "login", loginCampaign: "login", loginCampaignRepeat: "login", loginCampaignStrict: "login", totalLogin: "login", comebackCampaign: "login",
  combineCampaign: "camp", svtequipCombineCampaign: "camp", questCampaign: "camp", interludeCampaign: "camp", serialCampaign: "camp", locationCampaign: "camp", fortuneCampaign: "camp", combineCosutumeItem: "camp"};
const LIVE_SKIP = /^(none|shop|terminalBanner|myroom|genderSelect)/;
function liveKind(e) {
  const t = String(e.type || ""), n = String(e.name || "");
  if (/login bonus|login campaign/i.test(n)) return "login";
  if (LIVE_KINDS[t]) return LIVE_KINDS[t];
  if (LIVE_SKIP.test(t)) return "";
  return /campaign|success rate|\bexp\b|\bap\b/i.test(n) ? "camp" : "event";
}
const LIVE_GACHA = {payGacha: "Saint Quartz", chargeStone: "Paid Saint Quartz", friendPoint: "Friend Points"};

let live = (() => { try { const v = JSON.parse(localStorage.getItem(LIVE_KEY)); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; } })();
const liveOn = () => live.on === undefined ? LIVE_DEFAULT : !!live.on;
function liveSave() { try { localStorage.setItem(LIVE_KEY, JSON.stringify(live)); } catch (e) {} }
let liveBusy = false, liveErr = "";
const liveMore = new Set();

async function liveJSON(name, fresh) {
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), 30000);
  try {
    const r = await fetch(LIVE_API + name, fresh ? {signal: ac.signal, cache: "no-cache"} : {signal: ac.signal});
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}

// Turn Atlas Academy's lists into the little that Home shows. `now` is in seconds.
function liveDerive(svts, ces, evs, gas, now) {
  now = now || Date.now() / 1000;
  const SV = new Map(), CE = new Map();
  for (const x of Array.isArray(svts) ? svts : []) if (x && x.collectionNo > 0 && (x.type === "normal" || x.type === "heroine"))
    SV.set(x.id, {no: x.collectionNo, n: String(x.name || ""), c: liveCls(x.className), r: x.rarity | 0, f: String(x.face || "")});
  for (const x of Array.isArray(ces) ? ces : []) if (x && x.collectionNo > 0)
    CE.set(x.id, {no: x.collectionNo, n: String(x.name || ""), r: x.rarity | 0, f: String(x.face || ""), atk: x.atkMax | 0, hp: x.hpMax | 0, ce: 1});
  const sv = [...SV.values()].sort((a, b) => b.no - a.no).slice(0, 8);
  // anniversary Craft Essences use numbers in the 400,000s; the newest ones are the highest of the ordinary numbers
  const ce = [...CE.values()].filter((c) => c.no < 100000).sort((a, b) => b.no - a.no).slice(0, 8);
  const ev = [], seen = new Set();
  for (const e of Array.isArray(evs) ? evs : []) {
    if (!e || !e.name || !(e.endedAt > now - 86400) || !(e.startedAt > 0) || e.endedAt - e.startedAt > LIVE_LONG) continue;
    const k = liveKind(e); if (!k) continue;
    const key = k + "|" + e.name + "|" + e.startedAt + "|" + e.endedAt; if (seen.has(key)) continue; seen.add(key);
    ev.push({k: k, n: String(e.name), s: e.startedAt, e: e.endedAt, a: e.noticeAt || e.startedAt});
  }
  ev.sort((a, b) => a.e - b.e);
  const ba = [], byKey = new Map();
  for (const g of Array.isArray(gas) ? gas : []) {
    if (!g || !g.name || !(g.closedAt > now - 86400) || !(g.openedAt > 0) || g.closedAt - g.openedAt > LIVE_LONG) continue;
    const ft = (g.featuredSvtIds || []).map((id) => SV.get(id) || CE.get(id)).filter(Boolean);
    const key = g.name + "|" + g.openedAt + "|" + g.closedAt, had = byKey.get(key);
    if (had) { ft.forEach((x) => { if (!had.ft.some((y) => y.no === x.no && !!y.ce === !!x.ce)) had.ft.push(x); }); continue; }
    const b = {n: String(g.name), t: LIVE_GACHA[g.type] || "Summon", s: g.openedAt, e: g.closedAt, ft: ft};
    byKey.set(key, b); ba.push(b);
  }
  ba.sort((a, b) => (a.t === "Friend Points") - (b.t === "Friend Points") || a.e - b.e);
  return {sv: sv, ce: ce, ev: ev.slice(0, 80), ba: ba.slice(0, 24)};
}

async function liveCheck(force) {
  if (!liveOn() || liveBusy) return;
  const t = Date.now();
  if (!force && (live.checkedAt && t - live.checkedAt < LIVE_EVERY || live.failedAt && t - live.failedAt < LIVE_RETRY)) return;
  liveBusy = true; liveErr = ""; liveRefresh();
  try {
    const info = await liveJSON("info.json", true);
    const ver = String(info && info.hash) + "@" + String(info && info.timestamp);
    if (!live.data || ver !== live.ver) {
      const [a, b, c, d] = await Promise.all(["basic_servant.json", "basic_equip.json", "basic_event.json", "nice_gacha.json"].map((n) => liveJSON(n)));
      live.data = liveDerive(a, b, c, d); live.ver = ver; live.dataVer = info && info.dataVer;
    }
    live.checkedAt = Date.now(); delete live.failedAt;
  } catch (e) {
    liveErr = navigator.onLine === false ? "You're offline." : "Couldn't reach Atlas Academy.";
    live.failedAt = Date.now();
  } finally {
    liveBusy = false; liveSave(); liveRefresh();
  }
}

/* ---------- Home: On NA now ---------- */
// "Tue 20 Oct, 15:03" in your own time zone
const liveWhen = (ts) => { const d = new Date(ts * 1000), o = (k) => d.toLocaleString("en-GB", k);
  return o({weekday: "short"}) + " " + o({day: "numeric"}) + " " + o({month: "short"}) + ", " + o({hour: "2-digit", minute: "2-digit", hour12: false}); };
function liveLeft(ts) {
  const s = ts - Date.now() / 1000; if (s <= 0) return "ended";
  const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.max(1, Math.floor(s % 3600 / 60));
  return d ? d + "d " + h + "h" : h ? h + "h " + m + "m" : m + "m";
}
function liveTime(x) {
  const now = Date.now() / 1000;
  if (x.s > now) return `<time data-lv-s="${x.s}" title="Starts ${esc(liveWhen(x.s))}">starts ${esc(liveWhen(x.s))}</time>`;
  return `<time data-lv-e="${x.e}" title="Ends ${esc(liveWhen(x.e))}">ends in ${esc(liveLeft(x.e))}</time>`;
}
function liveFace(x, small) {
  const inFile = x.ce ? CE_BY_NO.has(x.no) : ATLAS_BY_NO.has(x.no);
  const sub = x.ce ? [stars(x.r), [x.atk ? "ATK " + fmt(x.atk) : "", x.hp ? "HP " + fmt(x.hp) : ""].filter(Boolean).join(" ")] : [x.c, stars(x.r)];
  const label = x.n + (inFile ? "" : " (new on NA)") + ", " + sub.filter(Boolean).join(", ");
  const inner = `<span class="lv-img"><img src="${esc(aimg(x.f))}" alt="" loading="lazy">${inFile ? "" : `<i class="lv-new">NEW</i>`}</span>${small ? "" : `<span class="lv-n">${esc(x.n)}</span>`}`;
  const cls = `lv-face r${clamp(x.r, 1, 5)}${small ? " sm" : ""}`;
  return inFile
    ? `<button type="button" class="${cls}" data-action="${x.ce ? "ce-open" : "pc-open"}" data-no="${x.no}" title="${esc(label)}" aria-label="${esc(label)}">${inner}</button>`
    : `<a class="${cls}" href="${LIVE_DB}${x.ce ? "craft-essence" : "servant"}/${x.no}" target="_blank" rel="noopener" title="${esc(label)} · opens Atlas Academy" aria-label="${esc(label)}, opens Atlas Academy">${inner}</a>`;
}
function liveList(key, title, items, row, empty) {
  if (!items.length) return empty ? `<h4>${esc(title)}</h4><p class="tr-none">${esc(empty)}</p>` : "";
  const open = liveMore.has(key), cut = 5, shown = open ? items : items.slice(0, cut);
  return `<h4>${esc(title)} <small>${items.length}</small></h4><ul class="lv-list">${shown.map(row).join("")}</ul>${items.length > cut
    ? `<button type="button" class="linkish lv-more" data-action="live-more" data-k="${key}" aria-expanded="${open}">${open ? "Show fewer" : "Show all " + items.length}</button>` : ""}`;
}
function liveHTML() {
  const head = (small, act) => `<h3>On NA now <small>${small}</small>${act ? `<span class="lv-act">${act}</span>` : ""}</h3>`;
  if (!liveOn()) return `<section class="d-sec hm-block hm-b-live off">${head("live updates are off", "")}
    <p class="tr-none">Turn them on to see NA's current events, campaigns, login bonuses, summon banners and newest servants here, straight from Atlas Academy.</p>
    <div><button type="button" class="btn sm" data-action="live-on">Turn on live updates</button></div></section>`;
  const d = live.data, now = Date.now() / 1000;
  const checked = liveBusy ? "checking Atlas Academy…" : live.checkedAt ? "from Atlas Academy · checked " + ago(live.checkedAt) : "from Atlas Academy";
  const btn = `<button type="button" class="btn ghost sm" data-action="live-check"${liveBusy ? " disabled" : ""}>Check now</button>`;
  if (!d) return `<section class="d-sec hm-block hm-b-live">${head(esc(checked), btn)}
    <p class="tr-none">${liveBusy ? "Getting NA's events, banners and newest servants…" : esc(liveErr || "Nothing loaded yet.") + (liveErr ? " Home shows NA's news here once it can reach Atlas Academy." : "")}</p></section>`;
  const live1 = (x) => x.e > now && (x.s <= now || x.a <= now);
  const evs = d.ev.filter(live1), pick = (k) => evs.filter((x) => x.k === k).sort((a, b) => (a.s > now) - (b.s > now) || (a.s > now ? a.s - b.s : a.e - b.e));
  const evRow = (x) => `<li class="lv-ev${x.s > now ? " up" : x.e - now < 86400 ? " soon" : ""}"><b>${esc(x.n)}</b>${liveTime(x)}</li>`;
  const bas = d.ba.filter((b) => b.e > now && b.s <= now);
  const baRow = (b) => `<li class="lv-ev lv-ban${b.e - now < 86400 ? " soon" : ""}"><b>${esc(b.n)}</b>${liveTime(b)}<small>${esc(b.t)}</small>${b.ft.length ? `<span class="lv-faces">${b.ft.map((x) => liveFace(x, true)).join("")}</span>` : ""}</li>`;
  const note = liveErr ? `<p class="lv-warn">${esc(liveErr)} Showing what came in ${esc(ago(live.checkedAt || Date.now()))}.</p>` : "";
  return `<section class="d-sec hm-block hm-b-live">${head(esc(checked), btn)}${note}
    <div class="lv-cols">
      <div class="lv-col">${liveList("event", "Events", pick("event"), evRow, "No event running right now.")}${liveList("camp", "Campaigns", pick("camp"), evRow, "")}${liveList("login", "Login bonuses", pick("login"), evRow, "")}</div>
      <div class="lv-col">${liveList("banner", "Summon banners", bas, baRow, "No limited banner right now.")}</div>
      <div class="lv-col lv-rel"><h4>Newest servants</h4><div class="lv-grid">${d.sv.map((x) => liveFace(x)).join("")}</div>
        <h4>Newest Craft Essences</h4><div class="lv-grid">${d.ce.map((x) => liveFace(x)).join("")}</div></div>
    </div>
    <p class="lv-foot">Times are in your time zone. <b>NEW</b> means it isn't in this file's NA data yet; it opens on Atlas Academy. <button type="button" class="linkish" data-action="live-off">Turn off live updates</button></p>
  </section>`;
}
function liveRefresh() {
  const old = document.querySelector("#home .hm-b-live"); if (!old) return;
  const a = document.activeElement, act = a && old.contains(a) && a.dataset ? a.dataset.action + "|" + (a.dataset.k || "") : "";
  const t = document.createElement("div"); t.innerHTML = liveHTML(); const nu = t.firstElementChild; old.replaceWith(nu);
  if (act) { const [ac, k] = act.split("|"); const f = nu.querySelector(`[data-action="${ac}"]${k ? `[data-k="${k}"]` : ""}`) || nu.querySelector("[data-action]"); if (f) f.focus({preventScroll: true}); }
}
const renderHome20 = renderHome;
renderHome = function () {
  renderHome20();
  const g = document.querySelector("#home .hm-grid");
  if (g && !g.querySelector(".hm-b-live")) g.insertAdjacentHTML("afterbegin", liveHTML());
  if (g) liveCheck(false);
};
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest('[data-action^="live-"]'); if (!b) return;
  const a = b.dataset.action;
  if (a === "live-check") liveCheck(true);
  else if (a === "live-on") { live.on = true; liveSave(); liveRefresh(); liveCheck(true); }
  else if (a === "live-off") { live.on = false; liveSave(); liveRefresh(); toast("Live NA updates are off. Turn them back on from Home."); }
  else if (a === "live-more") { const k = b.dataset.k; if (liveMore.has(k)) liveMore.delete(k); else liveMore.add(k); liveRefresh(); }
});
// countdowns stay right while Home is open, and a stale summary is refreshed when you come back to the page
setInterval(() => {
  if (S.tab !== "home" || document.hidden) return;
  document.querySelectorAll("#home [data-lv-e]").forEach((t) => { const l = liveLeft(Number(t.dataset.lvE)); t.textContent = l === "ended" ? "ended" : "ends in " + l; });
}, 60000);
document.addEventListener("visibilitychange", () => { if (!document.hidden && S.tab === "home") liveCheck(false); });
window.addEventListener("online", () => { if (S.tab === "home") { delete live.failedAt; liveCheck(false); } });
