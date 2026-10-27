/* ================= 0.22.0: the Event page (rebuilt as tabs in 0.22.2) ================= */
// Press an event on Home and it opens here (address #event/<id>, or #event/<id>/<tab>). The page has tabs, like the
// Fate/Grand Order wiki's own event page: one section shows at a time, and big sections have tabs of their own.
// - The tabs come from the wiki: its event page lists them (Main Info, Event Shop, Mission List, …) and names the page each
//   one is on, so each tab is fetched from the wiki when it's needed. The right wiki page is the one whose event header
//   names this event (or starts the same day).
// - Atlas Academy's NA data fills the parts it knows exactly: the shop and its totals, the calculator, missions, free-quest
//   drops, banners (with Simulate) and point rewards. Without the wiki the page is made from that data alone.
// - Wiki text goes through a strict filter: only plain formatting, lists, tables, links and wiki pictures survive, so nothing
//   from the wiki can run here. The wiki's phone-only copies and hidden tooltip text are left out (their text becomes the
//   hover text), and its tabs become tabs here. Servants, Noble Phantasms and Craft Essences open in Past Chaldea.
// Everything is kept in this browser's IndexedDB, so an event opened once also works offline.
const EV_API = "https://api.atlasacademy.io/";
const WIKI = "https://fategrandorder.fandom.com";
const EV_KEY = "spirit-origin-list:v1:event"; // calculator settings: skill target, materials and currency you have, drop bonuses
const EV_MV = 2; // how an event is made from Atlas Academy's data; an older copy is made again
const WIKI_V = 2; // how wiki text is filtered; an older copy is fetched again
const EV_FRESH = 6 * 3600e3, EV_WIKI_FRESH = 12 * 3600e3;
// events the wiki announces before NA's data has them (or that it names so differently they can't be matched) get a
// page of their own too, made from the wiki: their ids are below zero, worked out from the wiki page's title (0.24.0)
const EV_WIKI_EVS = new Map();
const wikiEvId = (title) => { let h = 2166136261; for (const ch of String(title)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; } return -(h % 1e9 + 1); };
const EV = {id: 0, m: null, err: "", wiki: null, loading: new Set(), wikiBusy: 0, dropBusy: false, tab: "", kind: "", want: "", sub: {}, more: new Set(), open: new Set(), pages: {}, pageBusy: new Set()};
let evPref = (() => { try { const v = JSON.parse(localStorage.getItem(EV_KEY)); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; } })();
if (!evPref.have || typeof evPref.have !== "object") evPref.have = {};
if (!evPref.bonus || typeof evPref.bonus !== "object") evPref.bonus = {};
if (evPref.to !== 9 && evPref.to !== "plan") evPref.to = 10;
function evPrefSave() { try { localStorage.setItem(EV_KEY, JSON.stringify(evPref)); } catch (e) {} }

async function evJSON(url) {
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), 40000);
  try { const r = await fetch(url, {signal: ac.signal}); if (!r.ok) throw new Error("HTTP " + r.status); return await r.json(); }
  finally { clearTimeout(t); }
}

/* ---------- names of things by id ---------- */
// items: [name, icon, type]; servants and Craft Essences: [collection number, name, rarity, face, class or "ce"]
async function evItems() {
  const c = await kv.get("items");
  if (c && c.map && (!live.ver || c.ver === live.ver)) return c.map;
  try {
    const list = await evJSON(LIVE_API + "nice_item.json"), map = {};
    for (const it of Array.isArray(list) ? list : []) if (it && it.id) map[it.id] = [liveText(it.name), String(it.icon || ""), String(it.type || "")];
    await kv.set("items", {ver: live.ver || "", map: map}); return map;
  } catch (e) { if (c && c.map) return c.map; throw e; }
}
async function evNames(need) {
  const c = await kv.get("names");
  let map = c && c.map ? c.map : null;
  if (!map) {
    const [a, b] = await Promise.all(["basic_servant.json", "basic_equip.json"].map((n) => evJSON(LIVE_API + n)));
    map = liveNames(a, b); await kv.set("names", {ver: live.ver || "", map: map});
  }
  // embers, Fou and the like aren't servants or Craft Essences: their names come from the list of everything, once
  if (need && need.some((id) => !map[id])) {
    let all = await kv.get("svtall");
    if (!all || !all.map) {
      try {
        const list = await evJSON(LIVE_API + "basic_svt.json"), m2 = {};
        for (const x of Array.isArray(list) ? list : []) if (x && x.id) m2[x.id] = [x.collectionNo | 0, liveText(x.name), x.rarity | 0, String(x.face || ""), x.type === "servantEquip" ? "ce" : x.type === "normal" || x.type === "heroine" ? liveCls(x.className) : "x"];
        all = {map: m2}; await kv.set("svtall", all);
      } catch (e) { all = null; }
    }
    if (all && all.map) map = Object.assign({}, all.map, map);
  }
  return map;
}

/* ---------- an event, made small ---------- */
function evGift(g, items, names) {
  if (!g) return null;
  const q = (g.num | 0) || 1, id = g.objectId | 0;
  if (g.type === "item") { const x = items[id]; return {k: "i", id: id, n: x ? x[0] : "Item " + id, ic: x ? x[1] : "", q: q}; }
  if (g.type === "servant" || g.type === "equip") {
    const x = names[id];
    if (!x) return {k: "?", id: id, n: "Reward", q: q};
    if (x[4] === "x") return {k: "i", id: id, n: x[1], ic: x[3], q: q};
    return {k: x[4] === "ce" ? "c" : "s", id: id, no: x[0], n: x[1], r: x[2], ic: x[3], c: x[4] === "ce" ? "" : x[4], q: q};
  }
  if (g.type === "commandCode") return {k: "i", id: id, n: "Command Code", ic: "", q: q};
  return {k: "?", id: id, n: "Reward", q: q};
}
function evShopGot(sh, items, names) {
  const one = (pt, id, q) => pt === "item" ? evGift({type: "item", objectId: id, num: q}, items, names)
    : pt === "servant" || pt === "equip" ? evGift({type: "servant", objectId: id, num: q}, items, names)
    : {k: "?", id: id, n: liveText(sh.name) || "Shop item", q: q};
  if (Array.isArray(sh.gifts) && sh.gifts.length) return sh.gifts.map((g) => evGift(g, items, names)).filter(Boolean);
  if (Array.isArray(sh.itemSet) && sh.itemSet.length) return sh.itemSet.map((x) => one(x.purchaseType, x.targetId, x.setNum || 1));
  return (sh.targetIds || []).map((id) => one(sh.purchaseType, id, sh.setNum || 1));
}
const evCost = (c) => c && c.item ? {id: c.item.id | 0, n: liveText(c.item.name), ic: String(c.item.icon || ""), q: c.amount | 0} : null;
function evQuests(wars) {
  const out = [], seen = new Set();
  for (const w of wars) for (const sp of (w && w.spots) || []) for (const q of sp.quests || []) {
    if (!q || !q.id || seen.has(q.id)) continue;
    const fl = q.flags || [], nm = liveText(q.name);
    if (fl.includes("branch")) continue; // the other path of a story chapter
    seen.add(q.id);
    const g = q.type === "main" ? "main"
      : /high difficulty|challenge|super recollection/i.test(nm) || (fl.includes("dropFirstTimeOnly") && fl.includes("notRetrievable")) ? "challenge"
      : q.afterClear === "repeatLast" || q.afterClear === "repeatFirst" ? "free" : "extra";
    const ph = Array.isArray(q.phases) && q.phases.length ? q.phases[q.phases.length - 1] : 1;
    out.push({id: q.id, n: nm || "Quest", g: g, ap: q.consumeType === "ap" ? q.consume | 0 : 0, lv: String(q.recommendLv || ""), sp: liveText(q.spotName), ph: ph, o: q.openedAt | 0});
  }
  return out;
}
function evDerive(e, wars, items, names) {
  const gf = (g) => evGift(g, items, names);
  const mText = (mi) => liveText(mi.name) || liveText(mi.detail) || liveText(((mi.conds || []).find((c) => c && c.missionProgressType === "clear") || {}).conditionMessage);
  const mrow = (mi) => ({no: mi.dispNo | 0, n: mText(mi), g: (mi.gifts || []).map(gf).filter(Boolean)});
  // random missions (detective missions and the like) come in ranks; the rest is the event's mission list
  const rank = new Map((e.randomMissions || []).map((r) => [r.missionId, r.missionRank | 0])), byRank = new Map();
  (e.missions || []).filter((mi) => mi.type === "random").forEach((mi) => { const r = rank.has(mi.id) ? rank.get(mi.id) : 0; if (!byRank.has(r)) byRank.set(r, []); const x = mrow(mi); if (x.n) byRank.get(r).push(x); });
  const lots = (e.lotteries || []).map((l) => {
    const by = new Map();
    for (const b of l.boxes || []) { const k = b.boxIndex | 0; if (!by.has(k)) by.set(k, []); const gg = (b.gifts || []).map(gf).filter(Boolean); if (gg.length) by.get(k).push({g: gg[0], max: b.maxNum | 0, rare: !!b.isRare}); }
    return {cost: evCost(l.cost), lim: !!l.limited, boxes: [...by.entries()].sort((a, b) => a[0] - b[0]).slice(0, 12).map(([k, v]) => ({bi: k, it: v.sort((a, b) => b.rare - a.rare)}))};
  }).filter((l) => l.boxes.length);
  const sv = [], svSeen = new Set();
  (e.svts || []).filter((x) => x && x.type === "join").forEach((x) => { const g = gf({type: "servant", objectId: x.svtId, num: 1}); if (g && g.k === "s" && !svSeen.has(g.no)) { svSeen.add(g.no); sv.push(g); } });
  return {
    id: e.id | 0, n: liveText(e.name), t: String(e.type || ""), d: liveText(e.detail) !== liveText(e.name) ? liveText(e.detail) : "",
    s: e.startedAt | 0, e: e.endedAt | 0, bn: String(e.banner || e.noticeBanner || ""), w: e.warIds || [], at: Date.now(),
    shop: (e.shop || []).map((sh) => {
      const got = evShopGot(sh, items, names);
      return {n: liveText(sh.name) || (got[0] && got[0].n) || "Shop item", got: got, cost: evCost(sh.cost), lim: sh.limitNum | 0, s: sh.openedAt | 0, e: sh.closedAt | 0, pr: sh.priority | 0};
    }).filter((x) => x.cost).sort((a, b) => a.cost.id - b.cost.id || b.pr - a.pr),
    mis: (e.missions || []).filter((mi) => mi.type !== "random").map(mrow).filter((x) => x.n).sort((a, b) => a.no - b.no),
    rmis: [...byRank.entries()].sort((a, b) => a[0] - b[0]).map(([r, list]) => ({r: r, list: list.sort((a, b) => a.no - b.no)})).filter((x) => x.list.length),
    pts: (e.rewards || []).map((r) => ({grp: r.groupId | 0, pt: r.point | 0, g: (r.gifts || []).map(gf).filter(Boolean)})).sort((a, b) => a.grp - b.grp || a.pt - b.pt),
    ptn: (e.pointGroups || []).map((g) => ({grp: g.groupId | 0, n: liveText(g.name), ic: String(g.icon || "")})),
    lots: lots, sv: sv, quests: evQuests(wars), drops: {}
  };
}
// a copy kept from an older version still shows; the parts it doesn't have are empty
const evNorm = (m) => Object.assign({sv: [], rmis: [], mis: [], shop: [], pts: [], ptn: [], lots: [], quests: [], drops: {}}, m);
function evDrops(drops, items, names) {
  return (drops || []).map((d) => {
    const g = evGift({type: d.type === "item" ? "item" : "servant", objectId: d.objectId, num: d.num}, items, names);
    const ex = Number(d.dropExpected) || (d.runs ? (d.dropCount | 0) / d.runs : 0);
    return g && ex > 0 ? Object.assign(g, {ex: ex}) : null;
  }).filter(Boolean).sort((a, b) => b.q * b.ex - a.q * a.ex);
}

/* ---------- loading from Atlas Academy ---------- */
async function evLoad(id, force) {
  if (!id || EV.loading.has(id)) return;
  if (id < 0) return evWikiEvLoad(id, force);
  EV.loading.add(id); if (EV.id === id) { EV.err = ""; evPaint(); }
  let m = null;
  try {
    const c = force ? null : await kv.get("ev:" + id);
    if (c && c.m && c.v === EV_MV && Date.now() - c.at < EV_FRESH) m = c.m;
    else {
      const [e, items] = await Promise.all([evJSON(EV_API + "nice/NA/event/" + id), evItems()]);
      const wars = (await Promise.all((e.warIds || []).slice(0, 4).map((w) => evJSON(EV_API + "nice/NA/war/" + w).catch(() => null)))).filter(Boolean);
      const ids = [];
      const walkG = (gs) => (gs || []).forEach((g) => { if (g && (g.type === "servant" || g.type === "equip")) ids.push(g.objectId); });
      (e.missions || []).forEach((x) => walkG(x.gifts)); (e.rewards || []).forEach((x) => walkG(x.gifts)); (e.shop || []).forEach((x) => { walkG(x.gifts); if (x.purchaseType === "servant") ids.push(...(x.targetIds || [])); });
      (e.lotteries || []).forEach((l) => (l.boxes || []).forEach((b) => walkG(b.gifts))); (e.svts || []).forEach((x) => { if (x) ids.push(x.svtId); });
      const names = await evNames(ids);
      m = evDerive(e, wars, items, names);
      const old = c && c.m && c.m.drops; if (old && !force) m.drops = old;
      await kv.set("ev:" + id, {at: Date.now(), v: EV_MV, m: m});
    }
    evKeep(id);
  } catch (er) {
    const c = await kv.get("ev:" + id);
    if (c && c.m) { m = evNorm(c.m); if (EV.id === id) EV.err = "Couldn't reach Atlas Academy, so this is the copy from " + ago(c.at) + "."; }
    else if (EV.id === id) EV.err = navigator.onLine === false ? "You're offline, and this event hasn't been opened in this browser before." : "Couldn't get this event from Atlas Academy.";
  } finally {
    EV.loading.delete(id);
    if (EV.id === id) { EV.m = m; evPaint(); }
  }
  if (m && EV.id === id) { evDropsLoad(id); evWikiLoad(id, force); }
}
// a wiki page by its title (Home's board already knows which page an event is on)
async function wikiByTitle(title) {
  const r = await wikiJSON({action: "query", prop: "revisions", rvprop: "content", rvslots: "main", redirects: "1", titles: title});
  const p = ((r && r.query && r.query.pages) || []).find((x) => x && x.revisions), v = p && p.revisions[0], wt = v && (v.slots ? v.slots.main && v.slots.main.content : v.content);
  return wt ? {t: p.title || title, sc: 1, wt: wt, h: wikiHeader(wt) || {name: "", req: "", start: 0}} : null;
}
// an event only the wiki has: what Home's board read from its header, kept in this browser, and the wiki page itself
async function evWikiEvLoad(id, force) {
  EV.loading.add(id); if (EV.id === id) { EV.err = ""; evPaint(); }
  let m = null;
  try {
    let w = EV_WIKI_EVS.get(id);
    if (w) await kv.set("wev:" + id, w); else w = await kv.get("wev:" + id);
    if (w) m = evNorm({id: id, n: w.n, t: "wiki", d: "", s: w.s | 0, e: w.e | 0, bn: w.img || "", w: [], wt: w.t, pick: w.pick || [], req: w.req || "", story: w.story || "", at: Date.now()});
    else if (EV.id === id) EV.err = "This event isn't saved in this browser. Open it from Home.";
  } finally {
    EV.loading.delete(id);
    if (EV.id === id) { EV.m = m; evPaint(); }
  }
  if (m && EV.id === id) evWikiLoad(id, force);
}
// the cache keeps the 30 events opened most recently, so it doesn't grow forever
async function evKeep(id) {
  try {
    const ix = Object.assign({}, (await kv.get("evlist")) || {}); ix[id] = Date.now();
    const ids = Object.keys(ix).sort((a, b) => ix[b] - ix[a]);
    for (const old of ids.slice(30)) {
      delete ix[old];
      const w = await kv.get("wiki:" + old);
      for (const t of (w && w.tabs) || []) await kv.del("wikip:" + old + ":" + wikiKey(t));
      await kv.del("ev:" + old); await kv.del("wiki:" + old);
    }
    await kv.set("evlist", ix);
  } catch (e) {}
}
async function evDropsLoad(id) {
  const m = EV.m; if (!m || EV.dropBusy || m.id !== id) return;
  const todo = m.quests.filter((q) => q.g === "free" && !(q.id in m.drops)).slice(0, 16);
  if (!todo.length) return;
  EV.dropBusy = true; evPaint();
  try {
    const items = await evItems().catch(() => ({})), names = await evNames().catch(() => ({}));
    for (let i = 0; i < todo.length && EV.id === id; i += 3) {
      await Promise.all(todo.slice(i, i + 3).map(async (q) => {
        try { const d = await evJSON(EV_API + "nice/NA/quest/" + q.id + "/" + q.ph); m.drops[q.id] = evDrops(d.drops, items, names); } catch (e) { /* tried again next time */ }
      }));
    }
    // a Refresh while these were loading made a newer copy: that one is kept, and gets its own drops
    const c = await kv.get("ev:" + m.id); if (!c || !c.m || c.m === m || (c.m.at || 0) <= (m.at || 0)) await kv.set("ev:" + m.id, {at: m.at || Date.now(), v: EV_MV, m: m});
  } finally {
    EV.dropBusy = false;
    if (EV.m && EV.m !== m) evDropsLoad(EV.id); // another event (or a newer copy) opened in the meantime
    else if (EV.id === id) evPaint();
  }
}

/* ---------- the wiki: which page, and its tabs ---------- */
const wikiURL = (title) => WIKI + "/wiki/" + encodeURIComponent(String(title).replace(/ /g, "_")).replace(/%2F/g, "/");
const wikiJSON = (params) => evJSON(WIKI + "/api.php?" + new URLSearchParams(Object.assign({format: "json", formatversion: "2", origin: "*"}, params)));
const EV_STOP = new Set(["revival", "lite", "summon", "summoning", "pickup", "limited", "time", "the", "and", "with", "from", "event", "rerun", "part", "daily", "campaign", "quest", "quests",
  "fate", "grand", "order", "banner", "servant", "servants", "special", "chaldea"]); // words most event and banner names share
const evToks = (n) => new Set(nname(n).split(" ").filter((t) => t.length > 3 && !EV_STOP.has(t)));
const W_NS = /^(talk|user|user talk|user blog|template|category|file|forum|board|thread|message wall|module|help|fate\/grand order wiki)( talk)?:/i;
const W_SUBPAGE = /\/(main info|event info|event shop|mission list|[a-z ]*missions|main quests?|free quests?|extra quests?|challenge quests?|summoning campaign|gallery|dialogue|story)$/i;
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
// the event header at the top of a wiki event page: {{EventHeaderNA |name=… |start=October 16th 2026 02:00 |requirement=…}}
function wikiHeader(wt) {
  const s = String(wt || ""), x = /\{\{\s*EventHeader\w*([\s\S]*?)\n\s*\}\}/i.exec(s) || /\{\{\s*EventHeader\w*([\s\S]*?)\}\}/i.exec(s); if (!x) return null;
  const h = {}; ("\n" + x[1]).split(/\n\s*\|/).forEach((l) => { const i = l.indexOf("="); if (i > 0) h[l.slice(0, i).trim().toLowerCase()] = l.slice(i + 1).trim(); });
  const d = /([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/i.exec(h.start || ""), mo = d ? MONTHS.indexOf(d[1].toLowerCase()) : -1;
  const req = (h.requirement || "").replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, "$1").replace(/'''?|[{}[\]<>]/g, "").trim().slice(0, 120);
  return {name: h.name || "", req: req, start: mo >= 0 ? Date.UTC(+d[3], mo, +d[2]) / 1000 : 0};
}
const wName = (s) => nname(liveText(String(s || "").replace(/<[^>]*>|'''?/g, " ")));
// the tabs of a wiki event page: <tabber> Main Info={{:Page/Main Info}} |-| Event Shop={{:Page/Event Shop}} … </tabber>
function wikiTabsOf(wt) {
  const x = /<tabber>([\s\S]*?)<\/tabber>/i.exec(String(wt || "")); if (!x) return null;
  const tabs = x[1].split(/\|-\|/).map((s) => {
    const i = s.indexOf("="); if (i < 0) return null;
    const h = s.slice(0, i).trim(), body = s.slice(i + 1).trim(), t = /^\{\{\s*:([^{}|<>[\]]+?)\s*\}\}$/.exec(body);
    return h ? {h: h.slice(0, 60), page: t ? t[1].replace(/_/g, " ").trim() : ""} : null;
  }).filter(Boolean);
  return tabs.length ? tabs : null;
}
async function wikiFind(m) {
  const base = liveText(m.n), rev = /\brevival\b|\s-\s*lite$/i.test(base);
  const q = base.replace(/^revival:\s*/i, "").replace(/\s*-\s*lite$/i, "").replace(/\s+/g, " ").trim();
  const j = await wikiJSON({action: "query", list: "search", srsearch: q, srnamespace: "0", srlimit: "10"});
  const want = evToks(q), cands = [];
  for (const hit of (j && j.query && j.query.search) || []) {
    const t = String(hit.title || ""); if (!t || W_NS.test(t) || W_SUBPAGE.test(t)) continue;
    const tt = evToks(t); let n = 0; want.forEach((w) => { if (tt.has(w)) n++; });
    let sc = want.size ? n / want.size : 0;
    if (/revival|rerun|\blite\b/i.test(t) === rev) sc += 0.15;
    if (/\(us\)$/i.test(t)) sc += 0.1;
    cands.push({t: t, sc: sc});
  }
  cands.sort((a, b) => b.sc - a.sc);
  const top = cands.slice(0, 6); if (!top.length) return null;
  const r = await wikiJSON({action: "query", prop: "revisions", rvprop: "content", rvslots: "main", redirects: "1", titles: top.map((x) => x.t).join("|")});
  const byTitle = new Map();
  ((r && r.query && r.query.pages) || []).forEach((p) => { const v = p && p.revisions && p.revisions[0], c = v && (v.slots ? v.slots.main && v.slots.main.content : v.content); if (c) byTitle.set(p.title, c); });
  ((r && r.query && r.query.redirects) || []).forEach((x) => { if (byTitle.has(x.to)) byTitle.set(x.from, byTitle.get(x.to)); });
  const pages = top.map((x) => { const wt = byTitle.get(x.t) || ""; return {t: x.t, sc: x.sc, wt: wt, h: wikiHeader(wt)}; }).filter((x) => x.h);
  // the page whose header names this event; else the one that starts closest to it (within a week: a campaign's page
  // often starts a few days before the part Atlas Academy lists)
  const named = pages.find((x) => x.h.name && wName(x.h.name) === wName(base)); if (named) return named;
  const near = pages.filter((x) => x.h.start && Math.abs(x.h.start - m.s) < 7 * 86400 && x.sc >= 0.3).sort((a, b) => Math.abs(a.h.start - m.s) - Math.abs(b.h.start - m.s));
  return near[0] || null;
}
const wikiKey = (t) => t.page || "#" + t.i;

/* ---------- the wiki: a filtered copy ---------- */
const W_OK = new Set("P BR B STRONG I EM U S SMALL SUP SUB SPAN DIV UL OL LI DL DT DD TABLE THEAD TBODY TFOOT TR TH TD CAPTION A IMG H2 H3 H4 H5 H6 BLOCKQUOTE CENTER CODE PRE HR FIGURE FIGCAPTION".split(" "));
const W_DROP = new Set("SCRIPT STYLE IFRAME OBJECT EMBED FORM INPUT BUTTON TEXTAREA SELECT OPTION LINK META NOSCRIPT SVG MATH TEMPLATE AUDIO VIDEO SOURCE TRACK CANVAS TITLE BASE FRAME FRAMESET".split(" "));
const W_IMG = /^https:\/\/(static|vignette\d*|images)\.wikia\.nocookie\.net\//;
// left out: edit links, notes, navigation boxes, the wiki's phone-only copies, hidden parts and the tooltip buttons
const W_SKIP = /\b(mw-editsection|reference|references|noprint|navbox|toc|mw-references-wrap|printfooter|mobile-only|hidden|InumWrapper|screen-reader-text|mw-collapsible-toggle|custom-tt|wds-tabs__wrapper|mw-empty-elt)\b/;
const W_HID = /(^|;)\s*(display\s*:\s*none|visibility\s*:\s*hidden)/i;
const W_HEAD = {H2: "h3", H3: "h4", H4: "h5", H5: "h6", H6: "h6"};
const W_BLOCK = "table,div,ul,ol,p,figure,h2,h3,h4,h5,h6,blockquote,pre";
function wikiTitleOf(href) {
  let h = String(href || "").trim(); if (h.startsWith(WIKI)) h = h.slice(WIKI.length);
  const x = /^\/wiki\/([^?#]+)/.exec(h); if (!x) return "";
  try { return decodeURIComponent(x[1]).replace(/_/g, " ").trim(); } catch (e) { return ""; }
}
// servants, Noble Phantasms and Craft Essences by name (the wiki writes ō where NA writes ou: Ryōma, Ryouma)
const wKey = (s) => nname(s).replace(/ou/g, "o").replace(/uu/g, "u");
let W_NAMES = null;
function wNames() {
  if (W_NAMES) return W_NAMES;
  const sv = new Map(), np = new Map(), ce = new Map();
  ATLAS_S.forEach((x) => {
    const k = wKey(x.n); if (!sv.has(k)) sv.set(k, x.no);
    [].concat(x.np || []).forEach((p) => { const n = p && p.n ? wKey(p.n) : ""; if (n && !np.has(n)) np.set(n, x.no); });
  });
  ATLAS_C.forEach((c) => { const k = wKey(c.n); if (!ce.has(k)) ce.set(k, c.no); });
  return (W_NAMES = {sv: sv, np: np, ce: ce});
}
// on a wiki page, servant and Craft Essence icons carry their numbers (S327A1Icon, CEIcon1498); a support's
// Noble Phantasm link sits in the same box as their icon
function wikiCtx(doc) {
  const sv = new Map(), ce = new Map();
  doc.querySelectorAll("a[href] img").forEach((im) => {
    const a = im.closest("a[href]"), t = wikiTitleOf(a.getAttribute("href")); if (!t) return;
    const nm = im.getAttribute("data-image-name") || im.getAttribute("alt") || "";
    let x = /^S0*(\d{1,4})(?:A\d+)?Icon\b/i.exec(nm); if (x) { if (!sv.has(t)) sv.set(t, Number(x[1])); return; }
    x = /^CEIcon0*(\d{1,5})\b/i.exec(nm); if (x && !ce.has(t)) ce.set(t, Number(x[1]));
  });
  doc.querySelectorAll(".ServantSupport").forEach((box) => {
    const a = box.querySelector(".servant_icon a[href]"), no = a ? sv.get(wikiTitleOf(a.getAttribute("href"))) : 0; if (!no) return;
    box.querySelectorAll("b").forEach((b) => { if (!/^\s*NP\b/.test(b.textContent)) return; b.querySelectorAll("a[href]").forEach((l) => { const t = wikiTitleOf(l.getAttribute("href")); if (t && !sv.has(t)) sv.set(t, no); }); });
  });
  const nm = wNames();
  return {
    svt: (t) => sv.get(t) || nm.sv.get(wKey(t)) || nm.np.get(wKey(t)) || 0,
    ce: (t) => ce.get(t) || nm.ce.get(wKey(t)) || 0
  };
}
// Builds a clean copy in a separate, inert document: no script runs, no picture loads, and only the tags above with a
// few safe attributes are copied. Styles, classes, ids, event handlers, forms and frames are all left out. The tab
// controls, the in-app links and the icon-and-number badges are this page's own markup, made here.
function wikiClean(nodes, ctx) {
  const d = document.implementation.createHTMLDocument(""), root = d.createElement("div");
  const tabs = (pairs) => {
    const box = d.createElement("div"), bar = d.createElement("div"); box.setAttribute("class", "ewt"); bar.setAttribute("class", "ewt-bar"); bar.setAttribute("role", "tablist"); box.appendChild(bar);
    pairs.forEach(([lab, src], i) => {
      const b = d.createElement("button"); b.setAttribute("type", "button"); b.setAttribute("role", "tab"); b.setAttribute("class", "ewt-b"); b.setAttribute("data-action", "ewt"); b.setAttribute("data-i", String(i));
      b.setAttribute("aria-selected", i ? "false" : "true"); b.textContent = lab.slice(0, 60); bar.appendChild(b);
      const p = d.createElement("div"); p.setAttribute("class", "ewt-p"); p.setAttribute("role", "tabpanel"); if (i) p.setAttribute("hidden", ""); walk(src.childNodes, p); box.appendChild(p);
    });
    return box;
  };
  const walk = (src, dst) => {
    for (const n of src) {
      if (n.nodeType === 3) { dst.appendChild(d.createTextNode(n.nodeValue)); continue; }
      if (n.nodeType !== 1) continue;
      const t = n.tagName, cls = typeof n.className === "string" ? n.className : "";
      if (W_DROP.has(t) || W_HID.test(n.getAttribute("style") || "")) continue;
      if (/\bInumMobileDisplay\b/.test(cls)) { // an item icon with its number
        const s = d.createElement("span"); s.setAttribute("class", "ew-n"); walk(n.childNodes, s);
        const last = s.lastChild; if (last && last.nodeType === 3 && /^\s*[\d,.]+[kKmM]?\s*$/.test(last.nodeValue)) { const b = d.createElement("b"); b.textContent = "×" + last.nodeValue.trim(); s.replaceChild(b, last); }
        dst.appendChild(s); continue;
      }
      if (W_SKIP.test(cls)) continue;
      if (/\btabber\b/.test(cls)) {
        const labs = [...n.querySelectorAll(":scope > .wds-tabs__wrapper .wds-tabs__tab")].map((x) => x.textContent.replace(/\s+/g, " ").trim());
        const panes = [...n.querySelectorAll(":scope > .wds-tab__content")];
        if (panes.length) dst.appendChild(tabs(panes.map((p, i) => [labs[i] || "Part " + (i + 1), p]))); else walk(n.childNodes, dst);
        continue;
      }
      if (!W_OK.has(t)) { walk(n.childNodes, dst); continue; }
      if (t === "IMG") {
        const raw = n.getAttribute("data-src") || n.getAttribute("src") || "";
        if (!W_IMG.test(raw)) continue;
        const im = d.createElement("img"); im.setAttribute("src", raw); im.setAttribute("alt", (n.getAttribute("alt") || "").slice(0, 200));
        ["width", "height"].forEach((k) => { const v = Number(n.getAttribute(k)); if (v > 0 && v <= 1600) im.setAttribute(k, String(Math.round(v))); });
        im.setAttribute("loading", "lazy"); im.setAttribute("referrerpolicy", "no-referrer"); dst.appendChild(im); continue;
      }
      let el;
      if (t === "A") {
        let h = (n.getAttribute("href") || "").trim();
        if (h.startsWith("/") && !h.startsWith("//")) h = WIKI + h;
        const title = wikiTitleOf(h), sv = title && ctx ? ctx.svt(title) : 0, ce = !sv && title && ctx ? ctx.ce(title) : 0, inl = !n.querySelector(W_BLOCK);
        if (((sv && ATLAS_BY_NO.has(sv)) || (ce && CE_BY_NO.has(ce))) && inl) { // opens in Past Chaldea
          el = d.createElement("button"); el.setAttribute("type", "button"); el.setAttribute("class", "ew-in"); el.setAttribute("data-action", sv ? "pc-open" : "ce-open"); el.setAttribute("data-no", String(sv || ce));
          el.setAttribute("title", (title + " · opens in Past Chaldea").slice(0, 200));
        } else if (sv || ce) { // new on NA, not in this file's data yet: Atlas Academy's page
          el = d.createElement("a"); el.setAttribute("href", LIVE_DB + (sv ? "servant/" + sv : "craft-essence/" + ce)); el.setAttribute("target", "_blank"); el.setAttribute("rel", "noopener noreferrer");
        } else if (/^https?:\/\//i.test(h)) {
          el = d.createElement("a"); el.setAttribute("href", h); el.setAttribute("target", "_blank"); el.setAttribute("rel", "noopener noreferrer");
          const ti = n.getAttribute("title"); if (ti) el.setAttribute("title", ti.slice(0, 200));
        } else el = d.createElement("span");
      } else el = d.createElement(t === "CENTER" ? "div" : W_HEAD[t] || t.toLowerCase());
      if (t === "SPAN" && /\bUnremovableStatusFrame\b/.test(cls)) el.setAttribute("class", "ew-unr");
      if (t !== "A") { const ti = n.getAttribute("title"); if (ti && /\b(text|hover)-tooltip\b/.test(cls)) { el.setAttribute("title", ti.slice(0, 300)); el.setAttribute("class", "ew-tip"); } }
      if (t === "TD" || t === "TH") ["colspan", "rowspan"].forEach((k) => { const v = n.getAttribute(k); if (v && /^\d{1,2}$/.test(v)) el.setAttribute(k, v); });
      if (t === "TABLE") { // a table the wiki stretches across the page stays that wide here
        if (/(^|;)\s*width\s*:\s*100%/i.test(n.getAttribute("style") || "") || n.getAttribute("width") === "100%") el.setAttribute("class", "ew-w");
        const box = d.createElement("div"); box.setAttribute("class", "ew-scroll"); box.appendChild(el); dst.appendChild(box); walk(n.childNodes, el); continue;
      }
      walk(n.childNodes, el); dst.appendChild(el);
    }
  };
  walk(nodes, root);
  return root.innerHTML;
}
function wikiCleanHTML(html) {
  const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
  return wikiClean((doc.body.querySelector(".mw-parser-output") || doc.body).childNodes, wikiCtx(doc));
}
// a page whose tabs aren't pages of their own: the tabs (or, failing that, the sections) of the page itself
function wikiSplit(html) {
  const doc = new DOMParser().parseFromString(String(html || ""), "text/html"), ctx = wikiCtx(doc);
  const root = doc.body.querySelector(".mw-parser-output") || doc.body, top = root.querySelector(":scope > .tabber");
  if (top) {
    const labs = [...top.querySelectorAll(":scope > .wds-tabs__wrapper .wds-tabs__tab")].map((x) => x.textContent.replace(/\s+/g, " ").trim());
    return [...top.querySelectorAll(":scope > .wds-tab__content")].map((p, i) => ({h: (labs[i] || "Part " + (i + 1)).slice(0, 60), html: wikiClean(p.childNodes, ctx)}));
  }
  const secs = []; let cur = {h: "", nodes: []};
  for (const n of [...root.childNodes]) {
    const h2 = n.nodeType !== 1 ? null : n.tagName === "H2" ? n : n.classList.contains("mw-heading2") ? n.querySelector("h2") : null;
    if (h2) { if (cur.nodes.length) secs.push(cur); cur = {h: (h2.querySelector(".mw-headline") || h2).textContent.replace(/\[edit\]/gi, "").trim(), nodes: []}; continue; }
    cur.nodes.push(n);
  }
  if (cur.nodes.length) secs.push(cur);
  return secs.map((s, i) => ({h: (s.h || (i ? "More" : "Main Info")).slice(0, 60), html: wikiClean(s.nodes, ctx)}))
    .filter((s) => s.html.replace(/<[^>]*>/g, "").trim().length > 1 || /<img/.test(s.html));
}
async function evWikiLoad(id, force) {
  const m = EV.m; if (!m || m.id !== id || EV.wikiBusy) return;
  EV.wikiBusy = id; if (EV.id === id) evPaint();
  let w = null;
  const c = await kv.get("wiki:" + id);
  try {
    if (c && c.v === WIKI_V && !force && (Date.now() - c.at < EV_WIKI_FRESH || navigator.onLine === false)) w = c;
    else {
      const f = m.wt ? await wikiByTitle(m.wt) : await wikiFind(m);
      if (!f) w = {v: WIKI_V, at: Date.now(), none: 1};
      else {
        let tabs = wikiTabsOf(f.wt);
        if (!tabs || tabs.some((t) => !t.page)) { // the tabs aren't pages of their own: the whole page, split up
          const j = await wikiJSON({action: "parse", page: f.t, prop: "text", redirects: "1", disableeditsection: "1", disabletoc: "1"});
          const html = j && j.parse && j.parse.text; if (!html) throw new Error("no page");
          const parts = wikiSplit(typeof html === "string" ? html : html["*"]);
          tabs = parts.map((x, i) => ({h: x.h, page: "", i: i}));
          for (let i = 0; i < parts.length; i++) { await kv.set("wikip:" + id + ":#" + i, {v: WIKI_V, at: Date.now(), html: parts[i].html}); EV.pages["#" + i] = {html: parts[i].html}; }
        }
        w = {v: WIKI_V, at: Date.now(), title: f.t, req: f.h.req, tabs: tabs};
      }
      await kv.set("wiki:" + id, w);
    }
  } catch (e) {
    w = c && c.v === WIKI_V ? Object.assign({}, c, {stale: 1}) : {v: WIKI_V, at: Date.now(), fail: 1};
  } finally {
    EV.wikiBusy = 0;
    if (EV.id === id) { EV.wiki = w; evPaint(); wikiPrefetch(id, force); }
    else if (EV.m && !EV.wiki) evWikiLoad(EV.id); // the page moved on to another event while this one was loading
  }
}
// one tab's wiki page (kept in this browser), then the others in the background, one at a time
async function wikiPageLoad(id, t, force) {
  const k = wikiKey(t); if (EV.pageBusy.has(k) || (EV.pages[k] && !force)) return;
  EV.pageBusy.add(k);
  try {
    const c = await kv.get("wikip:" + id + ":" + k);
    if (!t.page) EV.pages[k] = c && c.v === WIKI_V ? {html: c.html} : {fail: 1}; // a part of the page itself: made when the page was
    else if (c && c.v === WIKI_V && !force && (Date.now() - c.at < EV_WIKI_FRESH || navigator.onLine === false)) EV.pages[k] = {html: c.html};
    else {
      try {
        const j = await wikiJSON({action: "parse", page: t.page, prop: "text", redirects: "1", disableeditsection: "1", disabletoc: "1"});
        const html = j && j.parse && j.parse.text; if (!html) throw new Error("no page");
        const clean = wikiCleanHTML(typeof html === "string" ? html : html["*"]);
        await kv.set("wikip:" + id + ":" + k, {v: WIKI_V, at: Date.now(), html: clean}); EV.pages[k] = {html: clean};
      } catch (e) { EV.pages[k] = c && c.v === WIKI_V ? {html: c.html, stale: 1} : {fail: 1}; }
    }
  } finally {
    EV.pageBusy.delete(k);
    if (EV.id === id && EV.m) { const cur = evTabs(EV.m).find((x) => x.k === EV.tab); if (cur && cur.wiki && wikiKey(cur.wiki) === k) evPaint(); }
  }
}
async function wikiPrefetch(id, force) {
  const w = EV.wiki; if (!w || !w.tabs || !EV.m) return;
  const cur = evTabs(EV.m).find((x) => x.k === EV.tab), first = cur && cur.wiki ? wikiKey(cur.wiki) : "";
  const order = w.tabs.slice().sort((a, b) => (wikiKey(b) === first) - (wikiKey(a) === first));
  for (const t of order) { if (EV.id !== id || EV.wiki !== w) return; await wikiPageLoad(id, t, force); }
}

/* ---------- what your roster still needs ---------- */
// Ascensions are counted as done when the level is past that ascension's cap; at exactly the cap the ascension is
// counted as still to do. Skills count up to Lv 10 (or 9). Append skills, costumes and Grails aren't counted.
function evRosterNeeds(to) {
  const need = new Map(), who = new Map();
  // 0.24.0: or what the plans on the servant pages need (appends included)
  if (to === "plan") {
    S.servants.forEach((s) => { if (!s.plan) return; const a = atlasOf(s); if (!a) return;
      planCost(s, a, planOf(s, a)).items.forEach((n, id) => { need.set(id, (need.get(id) || 0) + n); const w = who.get(id) || new Map(); w.set(s.name, (w.get(s.name) || 0) + n); who.set(id, w); }); });
    return {need: need, who: who};
  }
  const add = (row, s) => { for (let j = 0; j + 1 < row.length; j += 2) { const m = ATLAS_MATS[row[j]]; if (!m) continue; const id = m[0], n = row[j + 1] | 0; need.set(id, (need.get(id) || 0) + n); const w = who.get(id) || new Map(); w.set(s.name, (w.get(s.name) || 0) + n); who.set(id, w); } };
  for (const s of owned()) {
    const a = atlasOf(s); if (!a || !a.ma || !a.ms) continue;
    const lv = num(s.level) || 1, cap0 = (a.lv || 90) - 40;
    for (let k = 0; k < 4; k++) if (!(lv > cap0 + 10 * k)) add(a.ma[k] || [], s);
    for (let i = 0; i < 3; i++) { let l = clamp(num((s.skills || [])[i]) || 1, 1, 10); for (; l < to; l++) add(a.ms[l - 1] || [], s); }
  }
  return {need: need, who: who};
}
const MAT_IDS = new Set(ATLAS_MATS.map((m) => m[0]));
function evCalcData(m) {
  const {need, who} = evRosterNeeds(evPref.to), cur = new Map(), took = new Map(); // took: bought already in an earlier row
  for (const sh of m.shop) {
    const c = sh.cost; if (!c) continue;
    if (!cur.has(c.id)) cur.set(c.id, {c: c, rows: [], all: 0, open: 0, mine: 0});
    const k = cur.get(c.id); if (sh.lim) k.all += sh.lim * c.q; else k.open++;
    const g = sh.got.length === 1 ? sh.got[0] : null;
    if (!g || g.k !== "i" || !MAT_IDS.has(g.id) || !need.get(g.id)) continue;
    const have = Math.max(0, num(evPref.have[g.id]) || 0), left = Math.max(0, need.get(g.id) - have - (took.get(g.id) || 0));
    const buy = Math.min(sh.lim || Infinity, Math.ceil(left / Math.max(1, g.q)));
    took.set(g.id, (took.get(g.id) || 0) + buy * Math.max(1, g.q));
    k.rows.push({sh: sh, g: g, need: need.get(g.id), have: have, buy: buy, cost: buy * c.q, who: who.get(g.id)}); k.mine += buy * c.q;
  }
  return [...cur.values()];
}
// the best free quest for a currency: the most of it per AP, with your bonus per drop added
function evBestRun(m, curId) {
  const bonus = Math.max(0, num(evPref.bonus[curId]) || 0); let best = null;
  for (const q of m.quests) {
    if (q.g !== "free" || !q.ap) continue;
    const ds = (m.drops[q.id] || []).filter((d) => d.k === "i" && d.id === curId); if (!ds.length) continue;
    const per = ds.reduce((a, d) => a + (d.q + bonus) * d.ex, 0);
    if (!best || per / q.ap > best.per / best.q.ap) best = {q: q, per: per};
  }
  return best;
}

/* ---------- the tabs ---------- */
// what a tab is about, from its name (the first that fits wins); Atlas Academy's data fills the kinds it knows
const EV_KINDS = [["overview", /main info|overview|event info|^summary$/i], ["shop", /shop|exchange/i], ["free", /free quests?/i], ["main", /main quests?|^story/i], ["extra", /extra quests?/i],
  ["challenge", /challenge|high difficulty|super recollection/i], ["missions", /mission list|master missions?|^missions?$/i], ["rmissions", /missions?/i], ["summon", /summon|gacha|banner/i], ["points", /point|lottery|lotto|box/i]];
const evKind = (h) => { for (const [k, rx] of EV_KINDS) if (rx.test(h)) return k; return "wiki"; };
const evSlug = (h) => nname(h).replace(/ /g, "-") || "tab";
function evBanners(m) {
  const d = live.data, all = d && Array.isArray(d.ba) ? d.ba : [], toks = evToks(m.n.replace(/^revival:\s*/i, ""));
  const over = all.filter((b) => b.s < m.e && b.e > m.s - 86400);
  const mine = over.filter((b) => { const bt = evToks(b.n); return [...toks].some((t) => bt.has(t)) || Math.abs(b.s - m.s) < 3600; });
  return {show: mine.length ? mine : over, mine: mine.length > 0};
}
function evTabs(m) {
  if (!m) return [];
  const w = EV.wiki && EV.wiki.tabs && EV.wiki.tabs.length ? EV.wiki.tabs : null, out = [];
  const at = (kind) => out.findIndex((t) => t.kind === kind);
  const after = (kinds, t) => { let i = -1; kinds.forEach((k) => { i = Math.max(i, at(k)); }); out.splice(i + 1, 0, t); };
  if (w) w.forEach((t) => out.push({k: evSlug(t.h), h: t.h, kind: evKind(t.h), wiki: t}));
  if (at("overview") < 0) out.unshift({k: "overview", h: w ? "Overview" : "Main Info", kind: "overview"});
  if (m.shop.length && at("shop") < 0) after(["overview"], {k: "shop", h: "Event Shop", kind: "shop"});
  if (m.shop.length) after(["shop"], {k: "calc", h: "Calculator", kind: "calc"});
  if (m.mis.length && at("missions") < 0) after(["calc", "shop", "overview"], {k: "missions", h: "Mission List", kind: "missions"});
  if (m.rmis.length && at("rmissions") < 0) after(["missions", "calc", "shop", "overview"], {k: "more-missions", h: "Random Missions", kind: "rmissions"});
  if (m.quests.length && !["main", "free", "extra", "challenge"].some((k) => at(k) >= 0)) after(["rmissions", "missions", "calc", "shop", "overview"], {k: "quests", h: "Quests", kind: "quests"});
  else if (m.quests.some((q) => q.g === "free") && at("free") < 0) after(["main", "rmissions", "missions", "calc", "shop", "overview"], {k: "free-quests", h: "Free Quests", kind: "free"});
  if (at("summon") < 0 && evBanners(m).show.length) out.push({k: "summon", h: "Summoning", kind: "summon"});
  if ((m.pts.length || m.lots.length) && at("points") < 0) out.push({k: "rewards", h: "Rewards", kind: "points"});
  const seen = new Set(); out.forEach((t) => { let k = t.k, n = 2; while (seen.has(k)) k = t.k + "-" + n++; t.k = k; seen.add(k); });
  return out;
}

/* ---------- drawing the page ---------- */
const evIt = (g, big, named) => {
  if (!g) return "";
  if ((g.k === "s" || g.k === "c") && g.no) return `<span class="ev-gf">${liveFace({no: g.no, n: g.n, r: g.r, f: g.ic, ce: g.k === "c" ? 1 : 0, c: g.c}, true)}${named ? `<span class="ev-gn">${esc(g.n)}</span>` : ""}${g.q > 1 ? `<small>×${fmt(g.q)}</small>` : ""}</span>`;
  return `<span class="ev-it${big ? " big" : ""}">${g.ic ? `<img src="${esc(g.ic)}" alt="" loading="lazy">` : ""}<span>${esc(g.n)}${g.q > 1 ? ` <b>×${fmt(g.q)}</b>` : ""}</span></span>`;
};
const evNum = (v) => fmt(Math.round(v));
// this page's own tabs inside a tab (the wiki's tabs become the same thing); labels are made here, already escaped
function evSub(key, parts) {
  parts = parts.filter(Boolean); if (!parts.length) return "";
  if (parts.length === 1) return parts[0].html;
  return `<div class="ewt" data-k="${esc(key)}"><div class="ewt-bar" role="tablist">${parts.map((p, i) => `<button type="button" role="tab" class="ewt-b" data-action="ewt" data-i="${i}" aria-selected="${i ? "false" : "true"}">${p.label}</button>`).join("")}</div>${parts.map((p, i) => `<div class="ewt-p" role="tabpanel"${i ? " hidden" : ""}>${p.html}</div>`).join("")}</div>`;
}
const evChunks = (list, size) => { const out = []; for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size)); return out; };
const evWikiLink = (title) => title ? `<a href="${esc(wikiURL(title))}" target="_blank" rel="noopener">${esc(title)} ↗</a>` : "";
function evWikiPane(t) {
  if (!t || !t.wiki) return "";
  const p = EV.pages[wikiKey(t.wiki)], src = t.wiki.page || (EV.wiki && EV.wiki.title) || "";
  if (!p) return `<div class="ev-wload"><p class="tr-none">Getting ${esc(t.h)} from the wiki…</p><div class="skeleton" style="height:180px"></div></div>`;
  if (p.fail) return `<p class="tr-none">Couldn't get this part from the Fate/Grand Order wiki. ${evWikiLink(src)}</p>`;
  return `<div class="ew">${p.html}</div><p class="ev-wsrc">From the wiki: ${evWikiLink(src)}${p.stale ? " (an older copy; the wiki couldn't be reached)" : ""}</p>`;
}
// the wiki's version of a part this page shows from Atlas Academy: folded away underneath
function evWikiAside(t, label) {
  if (!t || !t.wiki) return "";
  const key = "wd-" + t.k, open = EV.open.has(key);
  return `<details class="ev-wd" data-k="${esc(key)}"${open ? " open" : ""}><summary>${esc(label || "The wiki's page for this")}</summary>${open ? evWikiPane(t) : ""}</details>`;
}
const evReq = (r) => /^(none|no|-|n\/a)$/i.test(r) ? "Open to everyone" : /^clear\b/i.test(r) ? r : "Clear " + r;
function evOverviewHTML(m, t) {
  const curs = [...new Map(m.shop.map((x) => [x.cost.id, x.cost])).values()], w = EV.wiki;
  const facts = [
    ["Runs", `${esc(liveWhen(m.s))} – ${esc(liveWhen(m.e))}`],
    (w && w.req) || m.req ? ["To take part", esc(evReq((w && w.req) || m.req))] : null,
    m.story ? ["Story", "After " + esc(m.story)] : null,
    m.pick && m.pick.length ? ["Servants", m.pick.map((p) => { const a = hbAtlas(p.n, p.c); return `<span class="ev-gf">${a ? liveFace({no: a.no, n: a.n, r: a.r, f: a.f, c: a.c}, true) : ""}<span class="ev-gn">${esc(a ? a.n : p.n)}</span><small>${p.k === "reward" ? "free" : "pickup"}</small></span>`; }).join("")] : null,
    m.sv.length ? ["Joins your roster", m.sv.map((g) => evIt(g, false, true)).join("")] : null,
    curs.length ? ["Event currency", curs.map((c) => evIt({k: "i", n: c.n, ic: c.ic, q: 1})).join("")] : null,
    m.quests.length ? ["Quests", esc(["main", "free", "extra", "challenge"].map((g) => { const n = m.quests.filter((q) => q.g === g).length; return n ? n + " " + g : ""; }).filter(Boolean).join(" · "))] : null,
    m.mis.length ? ["Missions", esc(plural(m.mis.length, "mission") + (m.rmis.length ? " · " + plural(m.rmis.reduce((a, r) => a + r.list.length, 0), "random mission") : ""))] : null
  ].filter(Boolean);
  return `<dl class="ev-facts">${facts.map((f) => `<div><dt>${f[0]}</dt><dd>${f[1]}</dd></div>`).join("")}</dl>${m.d ? `<p class="ev-desc">${esc(m.d)}</p>` : ""}${evWikiPane(t)}`;
}
function evShopHTML(m, t) {
  if (!m.shop.length) return evWikiPane(t) || `<p class="tr-none">This event has no shop.</p>`;
  const by = new Map(); m.shop.forEach((x) => { if (!by.has(x.cost.id)) by.set(x.cost.id, []); by.get(x.cost.id).push(x); });
  const parts = [...by.values()].map((rows) => {
    const c = rows[0].cost, all = rows.reduce((a, x) => a + (x.lim ? x.lim * x.cost.q : 0), 0), open = rows.filter((x) => !x.lim).length;
    const item = (x) => x.got.length === 1 && x.got[0].k !== "?" ? evIt(Object.assign({}, x.got[0], {n: x.n}), false, true) : evIt({k: "i", n: x.n, ic: (x.got[0] || {}).ic || "", q: 1});
    return {label: evIt({k: "i", n: c.n, ic: c.ic, q: 1}), html: `<div class="ew-scroll"><table class="ev-tb"><thead><tr><th>Item</th><th>Price</th><th>Limit</th><th>Total</th></tr></thead><tbody>
      ${rows.map((x) => `<tr><td>${item(x)}</td><td class="n">${evNum(x.cost.q)}</td><td class="n">${x.lim ? "×" + x.lim : "no limit"}</td><td class="n">${x.lim ? evNum(x.lim * x.cost.q) : "—"}</td></tr>`).join("")}
      </tbody><tfoot><tr><th colspan="3">Everything${open ? ` <small>(+ ${plural(open, "unlimited item")})</small>` : ""}</th><td class="n">${evNum(all)}</td></tr></tfoot></table></div>`};
  });
  return `<p class="ev-note">${plural(m.shop.length, "item")} for ${plural(by.size, "currency", "currencies")}. The <button type="button" class="linkish" data-action="ev-tab" data-k="calc">Calculator</button> works out what your servants need from it.</p>`
    + evSub("shop", parts) + evWikiAside(t, "The wiki's shop page");
}
function evCalcHTML(m) {
  const cs = evCalcData(m), own = owned().length;
  const parts = cs.map((k) => {
    const have = Math.max(0, num(evPref.have["c" + k.c.id]) || 0), left = Math.max(0, k.mine - have), best = evBestRun(m, k.c.id);
    const runs = best && best.per > 0 ? Math.ceil(left / best.per) : null;
    return {label: evIt({k: "i", n: k.c.n, ic: k.c.ic, q: 1}), html: `<div class="ev-calc" data-cur="${k.c.id}">
      ${k.rows.length ? `<div class="ew-scroll"><table class="ev-ct"><thead><tr><th>Material</th><th>Your servants need</th><th>You have</th><th>Buy</th><th>Costs</th></tr></thead><tbody>
        ${k.rows.map((r) => `<tr><td>${evIt(Object.assign({}, r.g, {q: r.g.q}))}<small>${r.sh.lim ? "×" + r.sh.lim + " in the shop" : "no limit"}, ${evNum(r.sh.cost.q)} each</small></td>
          <td title="${esc([...r.who.entries()].sort((a, b) => b[1] - a[1]).map((w) => w[0] + " " + w[1]).join(" · "))}">${evNum(r.need)}</td>
          <td><input type="number" min="0" step="1" inputmode="numeric" data-ev-have="${r.g.id}" value="${esc(evPref.have[r.g.id] || "")}" placeholder="0" aria-label="${esc(r.g.n)} you have"></td>
          <td>${r.buy ? "×" + r.buy : "—"}</td><td>${r.cost ? evNum(r.cost) : "—"}</td></tr>`).join("")}
      </tbody></table></div>` : `<p class="tr-none">Nothing sold for this currency is a material your servants still need.</p>`}
      <dl class="ev-tot"><div><dt>For your servants</dt><dd>${evNum(k.mine)}</dd></div><div><dt>Whole shop</dt><dd>${evNum(k.all)}${k.open ? ` <small>+ ${k.open} unlimited</small>` : ""}</dd></div>
        <div><dt>You have</dt><dd><input type="number" min="0" step="1" inputmode="numeric" data-ev-have="c${k.c.id}" value="${esc(evPref.have["c" + k.c.id] || "")}" placeholder="0" aria-label="${esc(k.c.n)} you have"></dd></div>
        <div><dt>Still to farm</dt><dd>${evNum(left)}</dd></div></dl>
      <p class="ev-run">${best ? `Best quest: <b>${esc(best.q.n)}</b> (${best.q.ap} AP) gives about ${best.per.toFixed(1)} a run with <label class="ev-bonus">+<input type="number" min="0" step="1" inputmode="numeric" data-ev-bonus="${k.c.id}" value="${esc(evPref.bonus[k.c.id] || "")}" placeholder="0" aria-label="Bonus per drop"> per drop</label> from your event Craft Essences and servants.${left ? ` About <b>${fmt(runs)} runs</b> (${fmt(runs * best.q.ap)} AP) for what your servants need.` : ""}`
        : EV.dropBusy ? "Working out the best quest from the drops…" : "No free quest drops this currency in Atlas Academy's data yet."}</p></div>`};
  });
  return `<div class="ev-cctl"><label>Count <select data-ev-to><option value="10"${evPref.to === 10 ? " selected" : ""}>skills to Lv 10</option><option value="9"${evPref.to === 9 ? " selected" : ""}>skills to Lv 9</option><option value="plan"${evPref.to === "plan" ? " selected" : ""}>your plans</option></select></label>
      <p class="ev-note">${evPref.to === "plan" ? `Counts what the plans on your servant pages need (${plural(S.servants.filter((x) => x.plan).length, "plan")}), append skills included.` : `Counts your ${plural(own, "servant")} (not Guests): ascensions still to do by level, and skills up to Lv ${evPref.to}. Append skills aren't counted; pick "your plans" to count them.`} Fill in what you already have and the numbers follow.</p></div>`
    + evSub("calc", parts);
}
const evMiRow = (x) => `<li class="ev-mi"><span class="ev-no">${x.no || ""}</span><span class="ev-mt">${esc(x.n)}</span><span class="ev-gs">${x.g.map((g) => evIt(g, false, true)).join("")}</span></li>`;
function evMissionsHTML(m, t) {
  if (!m.mis.length) return evWikiPane(t);
  const parts = evChunks(m.mis, 20).map((ch) => ({label: esc(`${ch[0].no || ""}–${ch[ch.length - 1].no || ""}`), html: `<ol class="ev-list">${ch.map(evMiRow).join("")}</ol>`}));
  return evSub("mis", parts) + evWikiAside(t, "The wiki's mission list");
}
function evRandomHTML(m, t) {
  if (!m.rmis.length) return evWikiPane(t);
  const parts = m.rmis.map((r) => ({label: "Rank " + (r.r + 1) + ` <small>${r.list.length}</small>`, html: `<ol class="ev-list">${r.list.map(evMiRow).join("")}</ol>`}));
  return `<p class="ev-note">Random missions: a few from each rank are handed out at a time.</p>` + evSub("rmis", parts) + evWikiAside(t, "The wiki's page for these");
}
function evQuestRows(m, qs) {
  return `<ul class="ev-list">${qs.map((q) => {
    const ds = m.drops[q.id];
    return `<li class="ev-q"><div class="ev-qh"><b>${esc(q.n)}</b><small>${[q.ap ? q.ap + " AP" : "", q.lv ? "Lv " + esc(q.lv) : "", q.sp ? esc(q.sp) : ""].filter(Boolean).join(" · ")}</small></div>
      ${q.g === "free" ? (ds ? (ds.length ? `<div class="ev-drops">${ds.slice(0, 10).map((d) => `<span class="ev-it sm" title="${esc(d.n)}: ${d.q > 1 ? d.q + " each drop, " : ""}${d.ex.toFixed(2)} drops a run">${d.ic ? `<img src="${esc(d.ic)}" alt="" loading="lazy">` : ""}<span>${esc(d.n)} <b>${(d.q * d.ex).toFixed(d.q * d.ex >= 10 ? 0 : 2)}</b></span></span>`).join("")}</div>` : `<p class="tr-none">No drop data yet.</p>`)
        : `<p class="tr-none">${EV.dropBusy ? "Getting drops…" : "Drops not loaded."}</p>`) : ""}</li>`;
  }).join("")}</ul>`;
}
function evFreeHTML(m, t) {
  const qs = m.quests.filter((q) => q.g === "free");
  const head = qs.length ? `<h4 class="ev-h">Drops per run <small>averages from Atlas Academy, without event bonuses</small></h4>${evQuestRows(m, qs)}` : "";
  return (head + (t && t.wiki ? `<h4 class="ev-h">Quests in detail <small>from the wiki</small></h4>` + evWikiPane(t) : "")) || `<p class="tr-none">No free quests in Atlas Academy's data for this event.</p>`;
}
function evQuestsHTML(m, t) {
  if (t && t.wiki) return evWikiPane(t);
  const groups = [["main", "Main"], ["free", "Free"], ["extra", "Extra"], ["challenge", "Challenge"]].filter(([g]) => !t || t.kind === "quests" || t.kind === g);
  return evSub("quests", groups.map(([g, lab]) => { const qs = m.quests.filter((q) => q.g === g); return qs.length ? {label: lab + ` <small>${qs.length}</small>`, html: evQuestRows(m, qs) + (g === "free" ? `<p class="ev-note">Drops per run are the averages Atlas Academy gathered from players' runs, without event bonuses.</p>` : "")} : null; }))
    || `<p class="tr-none">No quests in Atlas Academy's data for this event.</p>`;
}
function evSummonHTML(m, t) {
  const d = live.data, now = Date.now() / 1000, {show, mine} = evBanners(m);
  const row = (b) => `<li class="ev-ban"><div class="ev-bh"><b>${esc(liveText(b.n))}</b>${b.t ? `<small>${esc(b.t)}</small>` : ""}</div>
    <p class="ev-when">${b.s > now ? "opens " + esc(liveWhen(b.s)) + " · " : ""}${b.e > now ? "closes " + esc(liveWhen(b.e)) : "closed"}</p>
    ${b.sub && b.sub.length ? `<p class="ev-when">Rate-up schedule: ${b.sub.map((x) => esc(liveWhen(x[0]).replace(/, \d\d:\d\d$/, "")) + " – " + esc(liveWhen(x[1]).replace(/, \d\d:\d\d$/, ""))).join(" · ")}</p>` : ""}
    ${b.ft.length ? `<div class="ev-faces">${b.ft.map((x) => liveFace(x, true)).join("")}</div>` : ""}
    ${b.id && b.ft.some((x) => !x.ce) && b.e > now ? `<button type="button" class="btn sm" data-action="ev-sim" data-g="${b.id}">Simulate this banner</button>` : ""}</li>`;
  const ours = show.length ? `<ul class="ev-bans">${show.map(row).join("")}</ul>${!mine ? `<p class="tr-none">None of these is named after the event; they're the banners open at the same time.</p>` : ""}`
    : `<p class="tr-none">${!liveOn() ? `Live NA updates are off, so the summon banners aren't loaded. <button type="button" class="linkish" data-action="live-on">Turn them on</button>` : d ? "No summon banner that's open or coming up runs with this event." : "Banners show up here once On NA now has checked Atlas Academy."}</p>`;
  return ours + (t && t.wiki ? `<h4 class="ev-h">Featured and schedule <small>from the wiki</small></h4>` + evWikiPane(t) : "");
}
function evPointsHTML(m, t) {
  let body = "";
  if (m.pts.length) {
    const grps = [...new Set(m.pts.map((x) => x.grp))];
    body += evSub("pts", grps.map((g, i) => { const rows = m.pts.filter((x) => x.grp === g), nm = (m.ptn.find((x) => x.grp === g) || {}).n;
      return {label: esc(nm || (grps.length > 1 ? "Point rewards " + (i + 1) : "Point rewards")), html: `<ul class="ev-list">${rows.map((x) => `<li class="ev-pt"><span class="ev-pp">${evNum(x.pt)}</span><span class="ev-gs">${x.g.map((gg) => evIt(gg, false, true)).join("")}</span></li>`).join("")}</ul>`}; }));
  }
  if (m.lots.length) body += m.lots.map((l) => `<h4 class="ev-h">Lottery ${l.cost ? `<small>${evNum(l.cost.q)} ${esc(l.cost.n)} a draw${l.lim ? "" : ", no box limit"}</small>` : ""}</h4>
    ${l.boxes.map((b, i) => (i < 3 || EV.more.has("lot")) ? `<p class="ev-box"><b>Box ${b.bi + 1}</b> ${b.it.map((x) => evIt(Object.assign({}, x.g, {q: x.g.q * Math.max(1, x.max)}))).join("")}</p>` : "").join("")}
    ${l.boxes.length > 3 ? `<button type="button" class="linkish ev-more" data-action="ev-more" data-k="lot">${EV.more.has("lot") ? "Show fewer" : "Show all " + l.boxes.length + " boxes"}</button>` : ""}`).join("");
  return (body || evWikiPane(t)) + (body ? evWikiAside(t, "The wiki's page for these") : "");
}
function evPaneHTML(m, t) {
  switch (t.kind) {
    case "overview": return evOverviewHTML(m, t);
    case "shop": return evShopHTML(m, t);
    case "calc": return evCalcHTML(m);
    case "missions": return evMissionsHTML(m, t);
    case "rmissions": return evRandomHTML(m, t);
    case "free": return evFreeHTML(m, t);
    case "main": case "extra": case "challenge": case "quests": return evQuestsHTML(m, t);
    case "summon": return evSummonHTML(m, t);
    case "points": return evPointsHTML(m, t);
    default: return evWikiPane(t);
  }
}
function evHTML() {
  const back = `<button type="button" class="btn ghost sm ev-back" data-action="tab" data-tab="home">← Home</button>`;
  const m = EV.m, busy = EV.loading.has(EV.id);
  if (!m) return `<div class="ev-top">${back}</div><section class="ev-pane"><p class="tr-none">${busy ? (EV.id < 0 ? "Getting this event…" : "Getting this event from Atlas Academy…") : esc(EV.err || "This event isn't loaded yet.")}</p>${!busy ? `<button type="button" class="btn sm" data-action="ev-reload">Try again</button>` : `<div class="skeleton" style="height:220px"></div>`}</section>`;
  const now = Date.now() / 1000, w = EV.wiki, tabs = evTabs(m);
  // the tab the address asked for may only exist once the wiki's tabs are in; until then it's kept in mind
  let t = null;
  if (EV.want) {
    t = tabs.find((x) => x.k === EV.want) || null;
    if (!t && EV.wiki) { const kd = evKind(EV.want.replace(/-/g, " ")); t = kd !== "wiki" ? tabs.find((x) => x.kind === kd) || null : null; }
    if (t || EV.wiki) EV.want = "";
  }
  if (!t) t = tabs.find((x) => x.k === EV.tab) || tabs.find((x) => x.kind === EV.kind) || tabs[0];
  EV.tab = t.k; EV.kind = t.kind;
  const status = now < m.s ? "starts " + liveWhen(m.s) : now < m.e ? "ends in " + liveLeft(m.e) + " (" + liveWhen(m.e) + ")" : "ended " + liveWhen(m.e);
  const search = `<a href="${WIKI}/wiki/Special:Search?search=${encodeURIComponent(m.n)}" target="_blank" rel="noopener">Search the wiki ↗</a>`;
  const wikiNote = EV.wikiBusy === m.id && !w ? "Finding this event on the Fate/Grand Order wiki…" : !w ? "" : w.fail ? `Couldn't reach the Fate/Grand Order wiki. ${search}`
    : w.none ? `The wiki doesn't seem to have a page for this one yet. ${search}` : `Tabs and text from the wiki page ${evWikiLink(w.title)}${w.stale ? " (an older copy; the wiki couldn't be reached)" : ""}.${m.id < 0 ? " NA's game data doesn't have this event yet, so the shop, missions and calculator come once it does." : ""}`;
  const src = m.id > 0 ? `<a class="btn ghost sm" href="https://apps.atlasacademy.io/db/NA/event/${m.id}" target="_blank" rel="noopener">Atlas Academy ↗</a>` : m.wt ? `<a class="btn ghost sm" href="${esc(wikiURL(m.wt))}" target="_blank" rel="noopener">Wiki ↗</a>` : "";
  return `<div class="ev-top">${back}<span class="ev-act">${src}<button type="button" class="btn ghost sm" data-action="ev-reload"${busy ? " disabled" : ""}>Refresh</button></span></div>
    <header class="ev-head">${m.bn ? `<img class="ev-bn" src="${esc(m.bn)}" alt="" loading="lazy">` : ""}<div class="ev-hb"><p class="ev-kick">${m.id > 0 ? "NA event" : "NA event · from the wiki"}</p><h2 class="ev-title">${esc(m.n)}</h2>
      <p class="ev-status${now >= m.s && now < m.e && m.e - now < 86400 ? " soon" : ""}">${esc(status)}</p><p class="ev-src">${wikiNote}</p>${EV.err ? `<p class="lv-warn">${esc(EV.err)}</p>` : ""}</div></header>
    <nav class="ev-tabs" aria-label="Event sections"><div class="ev-tl" role="tablist">${tabs.map((x) => `<button type="button" role="tab" class="ev-tab" id="evt-${esc(x.k)}" data-action="ev-tab" data-k="${esc(x.k)}" aria-selected="${x === t}" aria-controls="ev-pane" tabindex="${x === t ? 0 : -1}">${esc(x.h)}</button>`).join("")}</div></nav>
    <section class="ev-pane" id="ev-pane" role="tabpanel" aria-labelledby="evt-${esc(t.k)}" data-kind="${t.kind}"><h3 class="ev-ph">${esc(t.h)}</h3>${evPaneHTML(m, t)}</section>
    <p class="ev-foot">Times are in your time zone. Data from <a href="https://atlasacademy.io/" target="_blank" rel="noopener">Atlas Academy</a>${w && w.title ? ` and the <a href="${WIKI}" target="_blank" rel="noopener">Fate/Grand Order wiki</a> (text under CC BY-SA)` : ""}. Servants and Craft Essences open in Past Chaldea. Nothing here changes your roster; the calculator's numbers are kept in this browser.</p>`;
}
// a tab inside a tab: shows its part, and remembers which one was open
function ewtSel(box, i) {
  const bs = box.querySelectorAll(":scope > .ewt-bar > .ewt-b"), ps = box.querySelectorAll(":scope > .ewt-p");
  if (!(i < ps.length)) i = 0;
  bs.forEach((b, j) => { b.setAttribute("aria-selected", j === i ? "true" : "false"); b.tabIndex = j === i ? 0 : -1; });
  ps.forEach((p, j) => { p.hidden = j !== i; });
}
function evPaint() {
  const el = document.getElementById("event"); if (!el) return;
  if (S.tab !== "event") { if (el.firstChild) el.innerHTML = ""; return; }
  const a = document.activeElement, keep = a && el.contains(a) && a.dataset ? Object.keys(a.dataset).filter((k) => k.startsWith("ev")).map((k) => [k, a.dataset[k]])[0] : null;
  const pos = keep && typeof a.selectionStart === "number" ? a.selectionStart : null;
  el.innerHTML = evHTML();
  el.querySelectorAll(".ev-pane .ewt").forEach((box, i) => { const k = EV.tab + ":" + (box.dataset.k || "w" + i); box.dataset.key = k; ewtSel(box, EV.sub[k] | 0); });
  if (keep) {
    const attr = "data-" + keep[0].replace(/[A-Z]/g, (c) => "-" + c.toLowerCase()), f = el.querySelector(`[${attr}="${CSS.escape(keep[1])}"]`);
    if (f) { f.focus({preventScroll: true}); if (pos !== null) try { f.setSelectionRange(pos, pos); } catch (e) {} }
  }
  // the open tab's wiki page, if it isn't here yet
  const t = EV.m && evTabs(EV.m).find((x) => x.k === EV.tab);
  if (t && t.wiki && !EV.pages[wikiKey(t.wiki)] && !EV.pageBusy.has(wikiKey(t.wiki)) && EV.wiki && !EV.wiki.fail) wikiPageLoad(EV.id, t.wiki);
}
function evSetTab(k, focus) {
  if (!EV.m || !evTabs(EV.m).some((x) => x.k === k)) return;
  EV.tab = k; EV.kind = ""; EV.want = ""; evPaint();
  try { history.replaceState(history.state, "", "#event/" + EV.id + "/" + k); } catch (e) {}
  // a long tab scrolled away: the next one starts at its top, under the tab bar
  const nav = document.querySelector("#event .ev-tabs"), pane = document.getElementById("ev-pane");
  if (nav && pane) { const top = pane.getBoundingClientRect().top - nav.offsetHeight - 8; if (top < 0) window.scrollTo({top: Math.max(0, window.scrollY + top)}); }
  const b = document.getElementById("evt-" + k); if (b) b.focus({preventScroll: true});
}

/* ---------- getting there and back ---------- */
const evIdOf = (h) => { const x = /^#?event\/(-?\d+)/.exec(h || ""); return x ? Number(x[1]) : 0; };
const evTabOf = (h) => { const x = /^#?event\/-?\d+\/([a-z0-9-]+)/.exec(h || ""); return x ? x[1] : ""; };
function evOpen(id, push, tab) {
  id = Number(id) || 0; if (!id) return;
  if (EV.id !== id) { EV.id = id; EV.m = null; EV.wiki = null; EV.err = ""; EV.more.clear(); EV.open.clear(); EV.sub = {}; EV.pages = {}; EV.tab = ""; EV.kind = ""; EV.want = ""; }
  if (tab) EV.want = tab;
  S.tab = "event";
  if (push !== false) try { history.pushState({ev: id}, "", "#event/" + id + (EV.want || EV.tab ? "/" + (EV.want || EV.tab) : "")); } catch (e) {}
  if (S.selected && !isWide()) { S.selected = null; renderList(); renderDossier(); }
  renderChrome(); syncPageTheme(); window.scrollTo({top: 0}); evPaint();
  if (push !== false) { const el = document.getElementById("event"); if (el) el.focus({preventScroll: true}); }
  if (!EV.m) evLoad(id);
  liveCheck(false);
}
(function () { const id = evIdOf(location.hash); if (id) { S.tab = "event"; EV.id = id; EV.want = evTabOf(location.hash); } })();
const renderChrome22 = renderChrome;
renderChrome = function () {
  renderChrome22();
  const v = document.getElementById("view-event"); if (v) v.hidden = S.tab !== "event";
  if (S.tab === "event" && EV.id) try { if (evIdOf(location.hash) !== EV.id) history.replaceState(history.state, "", "#event/" + EV.id + (EV.tab ? "/" + EV.tab : "")); } catch (e) {}
};
// banners come from On NA now's summary: the Event page asks for it too, and is drawn again when it arrives
const liveRefresh22 = liveRefresh;
liveRefresh = function () { liveRefresh22(); if (S.tab === "event") evPaint(); };
const renderAll22 = renderAll;
renderAll = function () {
  renderAll22(); evPaint();
  if (S.tab === "event" && EV.id && !EV.m && !EV.loading.has(EV.id) && !EV.err) { evLoad(EV.id); liveCheck(false); }
};
// Back walks back through the tabs, Event pages and a simulated banner. On a phone, the servant page is a step of its
// own ({sheet: id} on #servants), so Back closes it and Forward opens it again (0.23.1).
// a reload starts with the servant page closed
try { if (history.state && history.state.sheet) history.replaceState(null, "", location.hash); } catch (e) {}
window.addEventListener("popstate", () => {
  const id = evIdOf(location.hash);
  if (id) { evOpen(id, false, evTabOf(location.hash)); return; }
  const h = (location.hash || "").slice(1), tab = TABS.includes(h) ? h : "home", st = history.state, phone = !isWide();
  const want = phone && tab === "servants" && st && st.sheet && S.servants.some((x) => x.id === st.sheet) ? st.sheet : null;
  // an open edit form on a phone stays put: Back doesn't throw away what was typed
  if (phone && S.editing && S.tab === "servants" && (tab !== "servants" || want !== S.selected)) {
    try { history.pushState(S.selected ? {sheet: S.selected} : null, "", "#servants"); } catch (e) {}
    toast("Save or cancel your changes first."); return;
  }
  const moved = tab !== S.tab;
  if (!moved && (!phone || (S.selected || null) === want)) return;
  sheetPop = true;
  try {
    S.tab = tab;
    if (phone) S.selected = tab === "servants" ? want : null;
    renderChrome(); syncPageTheme(); renderAll();
    if (moved) window.scrollTo({top: 0});
  } finally { sheetPop = false; }
});
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest('[data-action^="ev-"], [data-action="ewt"]'); if (!b) return;
  const a = b.dataset.action;
  if (a === "ev-open") { e.preventDefault(); evOpen(b.dataset.ev); }
  else if (a === "ev-reload") { EV.err = ""; EV.pages = {}; evLoad(EV.id, true); }
  else if (a === "ev-tab") evSetTab(b.dataset.k);
  else if (a === "ewt") { const box = b.closest(".ewt"); if (!box) return; const i = Number(b.dataset.i) || 0; if (box.dataset.key) EV.sub[box.dataset.key] = i; ewtSel(box, i); }
  else if (a === "ev-more") { const k = b.dataset.k; if (EV.more.has(k)) EV.more.delete(k); else EV.more.add(k); evPaint(); const nb = document.querySelector(`[data-action="ev-more"][data-k="${CSS.escape(k)}"]`); if (nb) nb.focus({preventScroll: true}); }
});
// arrow keys move between tabs (and between a tab's own tabs)
document.addEventListener("keydown", (e) => {
  const b = e.target; if (!b || !b.matches || !b.matches(".ev-tab, .ewt-b") || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
  const all = [...b.parentElement.querySelectorAll(":scope > button")], i = all.indexOf(b);
  const j = e.key === "Home" ? 0 : e.key === "End" ? all.length - 1 : (i + (e.key === "ArrowRight" ? 1 : -1) + all.length) % all.length;
  e.preventDefault();
  if (b.matches(".ev-tab")) { evSetTab(all[j].dataset.k); return; }
  all[j].click(); all[j].focus();
});
// the wiki's version under an Atlas part is only drawn once it's opened
document.addEventListener("toggle", (e) => {
  const d = e.target; if (!d || !d.matches || !d.matches("details.ev-wd")) return;
  const k = d.dataset.k, was = EV.open.has(k);
  if (d.open) EV.open.add(k); else EV.open.delete(k);
  if (d.open && !was) evPaint();
}, true);
let evCalcT = 0;
document.addEventListener("input", (e) => {
  const t = e.target; if (!t || !t.dataset) return;
  const h = t.dataset.evHave, bo = t.dataset.evBonus; if (h === undefined && bo === undefined) return;
  const v = t.value.replace(/[^\d]/g, "").slice(0, 10);
  if (h !== undefined) { if (v) evPref.have[h] = Number(v); else delete evPref.have[h]; }
  else { if (v) evPref.bonus[bo] = Number(v); else delete evPref.bonus[bo]; }
  evPrefSave(); clearTimeout(evCalcT); evCalcT = setTimeout(evPaint, 250);
});
document.addEventListener("change", (e) => {
  const t = e.target; if (!t || !t.matches || !t.matches("[data-ev-to]")) return;
  evPref.to = t.value === "9" ? 9 : t.value === "plan" ? "plan" : 10; evPrefSave(); evPaint();
});
// the countdown stays right while the page is open
setInterval(() => { if (S.tab === "event" && !document.hidden && EV.m) { const p = document.querySelector("#event .ev-status"); if (p) { const now = Date.now() / 1000, m = EV.m; p.textContent = now < m.s ? "starts " + liveWhen(m.s) : now < m.e ? "ends in " + liveLeft(m.e) + " (" + liveWhen(m.e) + ")" : "ended " + liveWhen(m.e); } } }, 60000);
