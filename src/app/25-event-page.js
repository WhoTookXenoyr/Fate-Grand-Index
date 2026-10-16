/* ================= 0.22.0: the Event page ================= */
// Press an event in On NA now and it opens here (address #event/<id>, so Back returns to Home). The page is put together
// from Atlas Academy's NA data (the event with its shop, missions, point rewards and lotteries; its war with every quest;
// the drops of the free quests; items, servants and Craft Essences by id) and, for the written parts (summary and guide,
// bonus servants and Craft Essences, misc info, game updates), the Fate/Grand Order fandom wiki. Wiki text goes through a
// strict filter first: only plain text formatting, lists, tables, links and wiki pictures survive, so nothing from the
// wiki can run on this page. Everything is kept in this browser's IndexedDB, so a page you opened once also works offline.
const EV_API = "https://api.atlasacademy.io/";
const WIKI = "https://fategrandorder.fandom.com";
const EV_KEY = "spirit-origin-list:v1:event"; // calculator settings: skill target, materials and currency you have, drop bonuses
const EV_MV = 1; // how an event page is made from Atlas Academy's data; a newer one is made again
const EV_FRESH = 6 * 3600e3, EV_WIKI_FRESH = 12 * 3600e3;
const EV = {id: 0, m: null, err: "", wiki: null, loading: new Set(), wikiBusy: false, dropBusy: false, more: new Set(), open: new Set()};
let evPref = (() => { try { const v = JSON.parse(localStorage.getItem(EV_KEY)); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; } })();
if (!evPref.have || typeof evPref.have !== "object") evPref.have = {};
if (!evPref.bonus || typeof evPref.bonus !== "object") evPref.bonus = {};
if (evPref.to !== 9) evPref.to = 10;
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
  const lots = (e.lotteries || []).map((l) => {
    const by = new Map();
    for (const b of l.boxes || []) { const k = b.boxIndex | 0; if (!by.has(k)) by.set(k, []); const gg = (b.gifts || []).map(gf).filter(Boolean); if (gg.length) by.get(k).push({g: gg[0], max: b.maxNum | 0, rare: !!b.isRare}); }
    return {cost: evCost(l.cost), lim: !!l.limited, boxes: [...by.entries()].sort((a, b) => a[0] - b[0]).slice(0, 12).map(([k, v]) => ({bi: k, it: v.sort((a, b) => b.rare - a.rare)}))};
  }).filter((l) => l.boxes.length);
  return {
    id: e.id | 0, n: liveText(e.name), t: String(e.type || ""), d: liveText(e.detail) !== liveText(e.name) ? liveText(e.detail) : "",
    s: e.startedAt | 0, e: e.endedAt | 0, bn: String(e.banner || e.noticeBanner || ""), w: e.warIds || [], at: Date.now(),
    shop: (e.shop || []).map((sh) => {
      const got = evShopGot(sh, items, names);
      return {n: liveText(sh.name) || (got[0] && got[0].n) || "Shop item", got: got, cost: evCost(sh.cost), lim: sh.limitNum | 0, s: sh.openedAt | 0, e: sh.closedAt | 0, pr: sh.priority | 0};
    }).filter((x) => x.cost).sort((a, b) => a.cost.id - b.cost.id || b.pr - a.pr),
    mis: (e.missions || []).map((mi) => ({no: mi.dispNo | 0, n: mText(mi), g: (mi.gifts || []).map(gf).filter(Boolean)})).filter((x) => x.n).sort((a, b) => a.no - b.no),
    pts: (e.rewards || []).map((r) => ({grp: r.groupId | 0, pt: r.point | 0, g: (r.gifts || []).map(gf).filter(Boolean)})).sort((a, b) => a.grp - b.grp || a.pt - b.pt),
    ptn: (e.pointGroups || []).map((g) => ({grp: g.groupId | 0, n: liveText(g.name), ic: String(g.icon || "")})),
    lots: lots, quests: evQuests(wars), drops: {}
  };
}
function evDrops(drops, items, names) {
  return (drops || []).map((d) => {
    const g = evGift({type: d.type === "item" ? "item" : "servant", objectId: d.objectId, num: d.num}, items, names);
    const ex = Number(d.dropExpected) || (d.runs ? (d.dropCount | 0) / d.runs : 0);
    return g && ex > 0 ? Object.assign(g, {ex: ex}) : null;
  }).filter(Boolean).sort((a, b) => b.q * b.ex - a.q * a.ex);
}

/* ---------- loading ---------- */
async function evLoad(id, force) {
  if (!id || EV.loading.has(id)) return;
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
      (e.lotteries || []).forEach((l) => (l.boxes || []).forEach((b) => walkG(b.gifts)));
      const names = await evNames(ids);
      m = evDerive(e, wars, items, names);
      const old = c && c.m && c.m.drops; if (old && !force) m.drops = old;
      await kv.set("ev:" + id, {at: Date.now(), v: EV_MV, m: m});
    }
    evKeep(id);
  } catch (er) {
    const c = await kv.get("ev:" + id);
    if (c && c.m) { m = c.m; if (EV.id === id) EV.err = "Couldn't reach Atlas Academy, so this is the copy from " + ago(c.at) + "."; }
    else if (EV.id === id) EV.err = navigator.onLine === false ? "You're offline, and this event hasn't been opened in this browser before." : "Couldn't get this event from Atlas Academy.";
  } finally {
    EV.loading.delete(id);
    if (EV.id === id) { EV.m = m; evPaint(); }
  }
  if (m && EV.id === id) { evDropsLoad(id); evWikiLoad(id, force); }
}
// the cache keeps the 30 events opened most recently, so it doesn't grow forever
async function evKeep(id) {
  try {
    const ix = Object.assign({}, (await kv.get("evlist")) || {}); ix[id] = Date.now();
    const ids = Object.keys(ix).sort((a, b) => ix[b] - ix[a]);
    for (const old of ids.slice(30)) { delete ix[old]; await kv.del("ev:" + old); await kv.del("wiki:" + old); }
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

/* ---------- the wiki ---------- */
const wikiURL = (title) => WIKI + "/wiki/" + encodeURIComponent(String(title).replace(/ /g, "_")).replace(/%2F/g, "/");
const wikiJSON = (params) => evJSON(WIKI + "/api.php?" + new URLSearchParams(Object.assign({format: "json", formatversion: "2", origin: "*"}, params)));
const EV_STOP = new Set(["revival", "lite", "summon", "summoning", "pickup", "limited", "time", "the", "and", "with", "from", "event", "rerun", "part", "daily", "campaign", "quest", "quests",
  "fate", "grand", "order", "banner", "servant", "servants", "special", "chaldea"]); // words most event and banner names share
const evToks = (n) => new Set(nname(n).split(" ").filter((t) => t.length > 3 && !EV_STOP.has(t)));
async function wikiFind(name) {
  const base = liveText(name), rev = /\brevival\b|\s-\s*lite$/i.test(base);
  const q = base.replace(/^revival:\s*/i, "").replace(/\s*-\s*lite$/i, "").replace(/\s+/g, " ").trim();
  const j = await wikiJSON({action: "query", list: "search", srsearch: q, srnamespace: "0", srlimit: "8"});
  const want = evToks(q); let best = null, bs = 0;
  for (const h of (j && j.query && j.query.search) || []) {
    const t = String(h.title || ""), tt = evToks(t); let hit = 0; want.forEach((w) => { if (tt.has(w)) hit++; });
    if (/^(talk|user|user talk|user blog|template|category|file|forum|board|thread|message wall|module|help|fate\/grand order wiki)( talk)?:/i.test(t)) continue;
    let sc = want.size ? hit / want.size : 0;
    if (/revival|rerun|\blite\b/i.test(t) === rev) sc += 0.15;
    if (/\/(gallery|dialogue|story|quests?)$/i.test(t)) sc -= 0.5;
    if (sc > bs) { bs = sc; best = t; }
  }
  return bs >= 0.5 ? best : null;
}
// what a wiki section is, from its heading (the order matters: the first that fits wins)
const WIKI_KIND = [["summary", /summary|guide|overview|walkthrough|synopsis|story|details/i], ["servants", /servants?/i], ["cards", /event cards?|craft essences?|\bces?\b|\bcards?\b/i],
  ["summon", /summon|gacha|banner|rate.?up/i], ["missions", /missions?|sections/i], ["quests", /quests?/i], ["shop", /shop|exchange/i], ["updates", /updates?|maintenance/i], ["misc", /misc|trivia|notes?|other|info/i]];
const wikiKind = (h, i) => { if (!h) return i === 0 ? "summary" : "other"; for (const [k, rx] of WIKI_KIND) if (rx.test(h)) return k; return "other"; };
const W_OK = new Set("P BR B STRONG I EM U S SMALL SUP SUB SPAN DIV UL OL LI DL DT DD TABLE THEAD TBODY TFOOT TR TH TD CAPTION A IMG H3 H4 H5 H6 BLOCKQUOTE CENTER CODE PRE HR FIGURE FIGCAPTION".split(" "));
const W_DROP = new Set("SCRIPT STYLE IFRAME OBJECT EMBED FORM INPUT BUTTON TEXTAREA SELECT OPTION LINK META NOSCRIPT SVG MATH TEMPLATE AUDIO VIDEO SOURCE TRACK CANVAS TITLE BASE FRAME FRAMESET".split(" "));
const W_IMG = /^https:\/\/(static|vignette\d*|images)\.wikia\.nocookie\.net\//;
const W_SKIP = /\b(mw-editsection|reference|references|noprint|navbox|toc|mw-references-wrap|printfooter)\b/;
// Builds a clean copy in a separate, inert document: no script runs, no picture loads, and only the tags above with
// a few safe attributes are copied. Everything else (styles, classes, ids, event handlers, forms, frames) is left out.
function wikiClean(nodes) {
  const d = document.implementation.createHTMLDocument(""), root = d.createElement("div");
  const walk = (src, dst) => {
    for (const n of src) {
      if (n.nodeType === 3) { dst.appendChild(d.createTextNode(n.nodeValue)); continue; }
      if (n.nodeType !== 1) continue;
      const t = n.tagName, cls = typeof n.className === "string" ? n.className : "";
      if (W_DROP.has(t) || W_SKIP.test(cls)) continue;
      if (!W_OK.has(t)) { walk(n.childNodes, dst); continue; }
      if (t === "IMG") {
        const raw = n.getAttribute("data-src") || n.getAttribute("src") || "";
        if (!W_IMG.test(raw)) continue;
        const im = d.createElement("img"); im.setAttribute("src", raw); im.setAttribute("alt", (n.getAttribute("alt") || "").slice(0, 200));
        ["width", "height"].forEach((k) => { const v = Number(n.getAttribute(k)); if (v > 0 && v <= 1600) im.setAttribute(k, String(Math.round(v))); });
        im.setAttribute("loading", "lazy"); im.setAttribute("referrerpolicy", "no-referrer"); dst.appendChild(im); continue;
      }
      const el = d.createElement(t === "CENTER" ? "div" : t.toLowerCase());
      if (t === "A") {
        let h = (n.getAttribute("href") || "").trim();
        if (h.startsWith("/") && !h.startsWith("//")) h = WIKI + h;
        if (/^https?:\/\//i.test(h)) { el.setAttribute("href", h); el.setAttribute("target", "_blank"); el.setAttribute("rel", "noopener noreferrer"); }
      }
      if (t === "TD" || t === "TH") ["colspan", "rowspan"].forEach((k) => { const v = n.getAttribute(k); if (v && /^\d{1,2}$/.test(v)) el.setAttribute(k, v); });
      if (t === "TABLE") { const box = d.createElement("div"); box.setAttribute("class", "ew-scroll"); box.appendChild(el); dst.appendChild(box); walk(n.childNodes, el); continue; }
      walk(n.childNodes, el); dst.appendChild(el);
    }
  };
  walk(nodes, root);
  return root.innerHTML;
}
const wikiReclean = (html) => wikiClean(new DOMParser().parseFromString("<div>" + String(html || "") + "</div>", "text/html").body.firstChild.childNodes);
function wikiSections(html) {
  const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
  const root = doc.body.querySelector(".mw-parser-output") || doc.body;
  const secs = []; let cur = {h: "", nodes: []};
  for (const n of [...root.childNodes]) {
    const h2 = n.nodeType !== 1 ? null : n.tagName === "H2" ? n : n.classList.contains("mw-heading2") ? n.querySelector("h2") : null;
    if (h2) { if (cur.nodes.length) secs.push(cur); cur = {h: (h2.querySelector(".mw-headline") || h2).textContent.replace(/\[edit\]/gi, "").trim(), nodes: []}; continue; }
    cur.nodes.push(n);
  }
  if (cur.nodes.length) secs.push(cur);
  return secs.map((s, i) => ({h: (s.h || (i ? "More" : "Introduction")).slice(0, 120), k: wikiKind(s.h, i), html: wikiClean(s.nodes)}))
    .filter((s) => s.html.replace(/<[^>]*>/g, "").trim().length > 1 || /<img/.test(s.html));
}
async function evWikiLoad(id, force) {
  const m = EV.m; if (!m || m.id !== id || EV.wikiBusy) return;
  EV.wikiBusy = id; if (EV.id === id) evPaint();
  let w = null;
  const c0 = await kv.get("wiki:" + id), c = c0 && c0.secs ? Object.assign({}, c0, {secs: c0.secs.map((x) => Object.assign({}, x, {html: wikiReclean(x.html)}))}) : c0;
  try {
    if (c && !force && (Date.now() - c.at < EV_WIKI_FRESH || navigator.onLine === false)) w = c;
    else {
      const title = await wikiFind(m.n);
      if (!title) w = {at: Date.now(), none: 1};
      else {
        const j = await wikiJSON({action: "parse", page: title, prop: "text", redirects: "1", disableeditsection: "1", disabletoc: "1"});
        const html = j && j.parse && j.parse.text; if (!html) throw new Error("no page");
        w = {at: Date.now(), title: String(j.parse.title || title), secs: wikiSections(typeof html === "string" ? html : html["*"])};
      }
      await kv.set("wiki:" + id, w);
    }
  } catch (e) {
    w = c ? Object.assign({}, c, {stale: 1}) : {at: Date.now(), fail: 1};
  } finally {
    EV.wikiBusy = false;
    if (EV.id === id) { EV.wiki = w; evPaint(); }
    else if (EV.m && !EV.wiki) evWikiLoad(EV.id); // the page moved on to another event while this one was loading
  }
}

/* ---------- what your roster still needs ---------- */
// Ascensions are counted as done when the level is past that ascension's cap; at exactly the cap the ascension is
// counted as still to do. Skills count up to Lv 10 (or 9). Append skills, costumes and Grails aren't counted.
function evRosterNeeds(to) {
  const need = new Map(), who = new Map();
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

/* ---------- drawing the page ---------- */
const evIt = (g, big, named) => {
  if (!g) return "";
  if ((g.k === "s" || g.k === "c") && g.no) return `<span class="ev-gf">${liveFace({no: g.no, n: g.n, r: g.r, f: g.ic, ce: g.k === "c" ? 1 : 0, c: g.c}, true)}${named ? `<span class="ev-gn">${esc(g.n)}</span>` : ""}${g.q > 1 ? `<small>×${fmt(g.q)}</small>` : ""}</span>`;
  return `<span class="ev-it${big ? " big" : ""}">${g.ic ? `<img src="${esc(g.ic)}" alt="" loading="lazy">` : ""}<span>${esc(g.n)}${g.q > 1 ? ` <b>×${fmt(g.q)}</b>` : ""}</span></span>`;
};
const evNum = (v) => fmt(Math.round(v));
function evMoreList(key, items, cut, row, tag) {
  const open = EV.more.has(key), shown = open || items.length <= cut + 2 ? items : items.slice(0, cut);
  return `<${tag || "ul"} class="ev-list">${shown.map(row).join("")}</${tag || "ul"}>${shown.length < items.length || open ? `<button type="button" class="linkish ev-more" data-action="ev-more" data-k="${key}" aria-expanded="${open}">${open ? "Show fewer" : "Show all " + items.length}</button>` : ""}`;
}
function evWikiBlocks(kinds, title, open) {
  const w = EV.wiki; if (!w || !w.secs) return "";
  return w.secs.filter((s) => kinds.includes(s.k)).map((s, i) => {
    const key = "w:" + s.h, isOpen = EV.open.has(key) || (open && !EV.open.has("!" + key));
    return `<details class="ev-wiki" data-k="${esc(key)}"${isOpen ? " open" : ""}><summary>${esc(title ? title + ": " + s.h : s.h)} <small>from the wiki</small></summary><div class="ew">${s.html}</div></details>`;
  }).join("");
}
function evSec(id, title, small, body) {
  return body ? `<section class="d-sec ev-sec" id="ev-${id}"><h3>${esc(title)}${small ? ` <small>${small}</small>` : ""}</h3>${body}</section>` : "";
}
function evSummonHTML(m) {
  const d = live.data, all = d && Array.isArray(d.ba) ? d.ba : [], now = Date.now() / 1000, toks = evToks(m.n.replace(/^revival:\s*/i, ""));
  const over = all.filter((b) => b.s < m.e && b.e > m.s - 86400);
  const mine = over.filter((b) => { const bt = evToks(b.n); return [...toks].some((t) => bt.has(t)) || Math.abs(b.s - m.s) < 3600; });
  const show = mine.length ? mine : over;
  const row = (b) => `<li class="ev-ban"><div class="ev-bh"><b>${esc(liveText(b.n))}</b>${b.t ? `<small>${esc(b.t)}</small>` : ""}</div>
    <p class="ev-when">${b.s > now ? "opens " + esc(liveWhen(b.s)) + " · " : ""}${b.e > now ? "closes " + esc(liveWhen(b.e)) : "closed"}</p>
    ${b.sub && b.sub.length ? `<p class="ev-when">Rate-up schedule: ${b.sub.map((x) => esc(liveWhen(x[0]).replace(/, \d\d:\d\d$/, "")) + " – " + esc(liveWhen(x[1]).replace(/, \d\d:\d\d$/, ""))).join(" · ")}</p>` : ""}
    ${b.ft.length ? `<div class="ev-faces">${b.ft.map((x) => liveFace(x, true)).join("")}</div>` : ""}
    ${b.id && b.ft.some((x) => !x.ce) && b.e > now ? `<button type="button" class="btn sm" data-action="ev-sim" data-g="${b.id}">Simulate this banner</button>` : ""}</li>`;
  const body = (show.length ? `<ul class="ev-bans">${show.map(row).join("")}</ul>${!mine.length ? `<p class="tr-none">None of these is named after the event; they're the banners open at the same time.</p>` : ""}`
    : `<p class="tr-none">${!liveOn() ? `Live NA updates are off, so the summon banners aren't loaded. <button type="button" class="linkish" data-action="live-on">Turn them on</button>` : d ? "No summon banner that's open or coming up runs with this event." : "Banners show up here once On NA now has checked Atlas Academy."}</p>`) + evWikiBlocks(["summon"], "Wiki", false);
  return evSec("summon", "Summoning campaign", "rate-up servants and Craft Essences", body);
}
function evRewardsSvtHTML(m) {
  const seen = new Map(), add = (g, from) => { if (!g || (g.k !== "s" && g.k !== "c") || !g.no) return; const k = g.k + g.no; if (!seen.has(k)) seen.set(k, {g: g, from: new Set()}); seen.get(k).from.add(from); };
  m.shop.forEach((x) => x.got.forEach((g) => add(g, "shop"))); m.mis.forEach((x) => x.g.forEach((g) => add(g, "missions"))); m.pts.forEach((x) => x.g.forEach((g) => add(g, "point rewards")));
  m.lots.forEach((l) => l.boxes.forEach((b) => b.it.forEach((x) => add(x.g, "lottery"))));
  const got = [...seen.values()].sort((a, b) => (a.g.k === "s" ? 0 : 1) - (b.g.k === "s" ? 0 : 1) || b.g.r - a.g.r);
  const body = (got.length ? `<ul class="ev-gets">${got.map((x) => `<li>${liveFace({no: x.g.no, n: x.g.n, r: x.g.r, f: x.g.ic, ce: x.g.k === "c" ? 1 : 0, c: x.g.c})}<small>${esc([...x.from].join(", "))}</small></li>`).join("")}</ul>` : "")
    + evWikiBlocks(["servants", "cards"], "", true);
  return evSec("svts", "Event servants and Craft Essences", got.length ? "what you can get here, and the wiki's bonus lists" : "the wiki's bonus lists", body);
}
function evMissionsHTML(m) {
  const body = (m.mis.length ? evMoreList("mis", m.mis, 12, (x) => `<li class="ev-mi"><span class="ev-no">${x.no || ""}</span><span class="ev-mt">${esc(x.n)}</span><span class="ev-gs">${x.g.map((g) => evIt(g, false, true)).join("")}</span></li>`, "ol") : "")
    + evWikiBlocks(["missions"], "Wiki", !m.mis.length);
  return evSec("missions", "Missions", m.mis.length ? plural(m.mis.length, "mission") : "", body);
}
function evQuestsHTML(m) {
  const groups = [["main", "Main quests"], ["free", "Free quests"], ["extra", "Extra quests"], ["challenge", "Challenge quests"]];
  const row = (q) => {
    const ds = m.drops[q.id];
    return `<li class="ev-q"><div class="ev-qh"><b>${esc(q.n)}</b><small>${[q.ap ? q.ap + " AP" : "", q.lv ? "Lv " + esc(q.lv) : "", q.sp ? esc(q.sp) : ""].filter(Boolean).join(" · ")}</small></div>
      ${q.g === "free" ? (ds ? (ds.length ? `<div class="ev-drops">${ds.slice(0, 10).map((d) => `<span class="ev-it sm" title="${esc(d.n)}: ${d.q > 1 ? d.q + " each drop, " : ""}${d.ex.toFixed(2)} drops a run">${d.ic ? `<img src="${esc(d.ic)}" alt="" loading="lazy">` : ""}<span>${esc(d.n)} <b>${(d.q * d.ex).toFixed(d.q * d.ex >= 10 ? 0 : 2)}</b></span></span>`).join("")}</div>` : `<p class="tr-none">No drop data yet.</p>`)
        : `<p class="tr-none">${EV.dropBusy ? "Getting drops…" : "Drops not loaded."}</p>`) : ""}</li>`;
  };
  const body = groups.map(([g, t]) => { const qs = m.quests.filter((q) => q.g === g); return qs.length ? `<h4>${t} <small>${qs.length}</small></h4>${evMoreList("q" + g, qs, g === "main" ? 6 : 12, row)}` : ""; }).join("")
    + (m.quests.some((q) => q.g === "free") ? `<p class="ev-note">Drops per run are the averages Atlas Academy gathered from players' runs, without event bonuses.</p>` : "")
    + evWikiBlocks(["quests"], "Wiki", !m.quests.length);
  return evSec("quests", "Quests", m.quests.length ? plural(m.quests.length, "quest") : "", body);
}
function evShopHTML(m) {
  if (!m.shop.length) return evSec("shop", "Event shop", "", evWikiBlocks(["shop"], "Wiki", true));
  const by = new Map(); m.shop.forEach((x) => { if (!by.has(x.cost.id)) by.set(x.cost.id, []); by.get(x.cost.id).push(x); });
  const body = [...by.values()].map((rows, k) => {
    const c = rows[0].cost, all = rows.reduce((a, x) => a + (x.lim ? x.lim * x.cost.q : 0), 0), open = rows.filter((x) => !x.lim).length;
    return `<div class="ev-cur"><h4>${evIt({k: "i", n: c.n, ic: c.ic, q: 1}, true)} <small>${plural(rows.length, "item")} · everything ${evNum(all)}${open ? ` + ${open} unlimited` : ""}</small></h4>
      ${evMoreList("shop" + k, rows, 10, (x) => `<li class="ev-sh"><span class="ev-sn">${x.got.length === 1 ? evIt(Object.assign({}, x.got[0], {n: x.n}), false, true) : evIt({k: "i", n: x.n, ic: (x.got[0] || {}).ic || "", q: 1})}</span><span class="ev-sc">${evNum(x.cost.q)} each</span><span class="ev-sl">${x.lim ? "×" + x.lim : "no limit"}</span><span class="ev-st">${x.lim ? evNum(x.lim * x.cost.q) : "—"}</span></li>`)}</div>`;
  }).join("") + evWikiBlocks(["shop"], "Wiki", false);
  return evSec("shop", "Event shop", plural(m.shop.length, "item"), body);
}
function evCalcHTML(m) {
  if (!m.shop.length) return "";
  const cs = evCalcData(m), own = owned().length;
  const body = `<div class="ev-cctl"><label>Skills up to <select data-ev-to><option value="10"${evPref.to === 10 ? " selected" : ""}>Lv 10</option><option value="9"${evPref.to === 9 ? " selected" : ""}>Lv 9</option></select></label>
      <p class="ev-note">Counts your ${plural(own, "servant")} (not Guests): ascensions still to do by level, and skills up to Lv ${evPref.to}. Append skills aren't counted. Fill in what you already have and the numbers follow.</p></div>
    ${cs.map((k) => {
      const have = Math.max(0, num(evPref.have["c" + k.c.id]) || 0), left = Math.max(0, k.mine - have), best = evBestRun(m, k.c.id);
      const runs = best && best.per > 0 ? Math.ceil(left / best.per) : null;
      return `<div class="ev-calc" data-cur="${k.c.id}"><h4>${evIt({k: "i", n: k.c.n, ic: k.c.ic, q: 1}, true)}</h4>
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
          : EV.dropBusy ? "Working out the best quest from the drops…" : "No free quest drops this currency in Atlas Academy's data yet."}</p></div>`;
    }).join("")}`;
  return evSec("calc", "Currency calculator", "what your servants still need from the shop", body);
}
function evPointsHTML(m) {
  let body = "";
  if (m.pts.length) {
    const grps = [...new Set(m.pts.map((x) => x.grp))];
    body += grps.map((g, i) => { const rows = m.pts.filter((x) => x.grp === g), nm = (m.ptn.find((x) => x.grp === g) || {}).n;
      return `<h4>${esc(nm || (grps.length > 1 ? "Point rewards " + (i + 1) : "Point rewards"))} <small>${plural(rows.length, "reward")}</small></h4>${evMoreList("pt" + g, rows, 8, (x) => `<li class="ev-pt"><span class="ev-pp">${evNum(x.pt)}</span><span class="ev-gs">${x.g.map((gg) => evIt(gg, false, true)).join("")}</span></li>`)}`; }).join("");
  }
  if (m.lots.length) body += m.lots.map((l) => `<h4>Lottery ${l.cost ? `<small>${evNum(l.cost.q)} ${esc(l.cost.n)} a draw${l.lim ? "" : ", no box limit"}</small>` : ""}</h4>
    ${l.boxes.map((b, i) => (i < 3 || EV.more.has("lot")) ? `<p class="ev-box"><b>Box ${b.bi + 1}</b> ${b.it.map((x) => evIt(Object.assign({}, x.g, {q: x.g.q * Math.max(1, x.max)}))).join("")}</p>` : "").join("")}
    ${l.boxes.length > 3 ? `<button type="button" class="linkish ev-more" data-action="ev-more" data-k="lot">${EV.more.has("lot") ? "Show fewer" : "Show all " + l.boxes.length + " boxes"}</button>` : ""}`).join("");
  return evSec("points", "Point rewards and lottery", "", body);
}
function evHTML() {
  const back = `<button type="button" class="btn ghost sm ev-back" data-action="tab" data-tab="home">← Home</button>`;
  const m = EV.m, busy = EV.loading.has(EV.id);
  if (!m) return `<div class="ev-top">${back}</div><section class="d-sec ev-sec"><p class="tr-none">${busy ? "Getting this event from Atlas Academy…" : esc(EV.err || "This event isn't loaded yet.")}</p>${!busy ? `<button type="button" class="btn sm" data-action="ev-reload">Try again</button>` : `<div class="skeleton" style="height:220px"></div>`}</section>`;
  const now = Date.now() / 1000, w = EV.wiki;
  const status = now < m.s ? "starts " + liveWhen(m.s) : now < m.e ? "ends in " + liveLeft(m.e) + " (" + liveWhen(m.e) + ")" : "ended " + liveWhen(m.e);
  const wikiNote = EV.wikiBusy && (EV.wikiBusy === m.id || !w) ? "Looking it up on the wiki…" : !w ? "" : w.fail ? `Couldn't reach the Fate/Grand Order wiki. <a href="${WIKI}/wiki/Special:Search?search=${encodeURIComponent(m.n)}" target="_blank" rel="noopener">Search it there ↗</a>`
    : w.none ? `The wiki doesn't seem to have a page for this one yet. <a href="${WIKI}/wiki/Special:Search?search=${encodeURIComponent(m.n)}" target="_blank" rel="noopener">Search the wiki ↗</a>`
    : `From the wiki page <a href="${esc(wikiURL(w.title))}" target="_blank" rel="noopener">${esc(w.title)} ↗</a>${w.stale ? " (an older copy; the wiki couldn't be reached)" : ""}.`;
  const secs = [
    ["summary", "Summary and guide", evSec("summary", "Summary and guide", "", (m.d ? `<p>${esc(m.d)}</p>` : "") + evWikiBlocks(["summary"], "", true) || (EV.wikiBusy && (EV.wikiBusy === m.id || !w) ? `<p class="tr-none">Looking it up on the wiki…</p>` : ""))],
    ["summon", "Summoning", evSummonHTML(m)],
    ["svts", "Servants and CEs", evRewardsSvtHTML(m)],
    ["missions", "Missions", evMissionsHTML(m)],
    ["quests", "Quests", evQuestsHTML(m)],
    ["shop", "Shop", evShopHTML(m)],
    ["calc", "Calculator", evCalcHTML(m)],
    ["points", "Rewards", evPointsHTML(m)],
    ["misc", "Misc info", evSec("misc", "Misc info and game updates", "from the wiki", evWikiBlocks(["misc", "updates"], "", true))],
    ["other", "More", evSec("other", "More from the wiki", "", evWikiBlocks(["other"], "", false))]
  ].filter((x) => x[2]);
  return `<div class="ev-top">${back}<span class="ev-act"><a class="btn ghost sm" href="https://apps.atlasacademy.io/db/NA/event/${m.id}" target="_blank" rel="noopener">Atlas Academy ↗</a><button type="button" class="btn ghost sm" data-action="ev-reload"${busy ? " disabled" : ""}>Refresh</button></span></div>
    <header class="ev-head">${m.bn ? `<img class="ev-bn" src="${esc(m.bn)}" alt="" loading="lazy">` : ""}<div><p class="ev-kick">NA event</p><h2 class="ev-title">${esc(m.n)}</h2>
      <p class="ev-status${now >= m.s && now < m.e && m.e - now < 86400 ? " soon" : ""}">${esc(status)}</p><p class="ev-src">${wikiNote}</p>${EV.err ? `<p class="lv-warn">${esc(EV.err)}</p>` : ""}</div></header>
    <nav class="ev-nav" aria-label="On this page">${secs.map((x) => `<button type="button" class="chip" data-action="ev-jump" data-to="${x[0]}">${esc(x[1])}</button>`).join("")}</nav>
    ${secs.map((x) => x[2]).join("")}
    <p class="ev-foot">Times are in your time zone. Data from <a href="https://atlasacademy.io/" target="_blank" rel="noopener">Atlas Academy</a>${w && w.title ? ` and the <a href="${WIKI}" target="_blank" rel="noopener">Fate/Grand Order wiki</a> (text under CC BY-SA)` : ""}. Nothing here changes your roster; the calculator's numbers are kept in this browser.</p>`;
}
function evPaint() {
  const el = document.getElementById("event"); if (!el) return;
  if (S.tab !== "event") { if (el.firstChild) el.innerHTML = ""; return; }
  const a = document.activeElement, keep = a && el.contains(a) && a.dataset ? Object.keys(a.dataset).filter((k) => k.startsWith("ev")).map((k) => [k, a.dataset[k]])[0] : null;
  const pos = keep && typeof a.selectionStart === "number" ? a.selectionStart : null;
  el.innerHTML = evHTML();
  if (keep) {
    const attr = "data-" + keep[0].replace(/[A-Z]/g, (c) => "-" + c.toLowerCase()), f = el.querySelector(`[${attr}="${CSS.escape(keep[1])}"]`);
    if (f) { f.focus({preventScroll: true}); if (pos !== null) try { f.setSelectionRange(pos, pos); } catch (e) {} }
  }
}

/* ---------- getting there and back ---------- */
const evIdOf = (h) => { const x = /^#?event\/(\d+)/.exec(h || ""); return x ? Number(x[1]) : 0; };
function evOpen(id, push) {
  id = Number(id) || 0; if (!id) return;
  if (EV.id !== id) { EV.id = id; EV.m = null; EV.wiki = null; EV.err = ""; EV.more.clear(); }
  S.tab = "event";
  if (push !== false) try { history.pushState({ev: id}, "", "#event/" + id); } catch (e) {}
  if (S.selected && !isWide()) { S.selected = null; renderList(); renderDossier(); }
  renderChrome(); syncPageTheme(); window.scrollTo({top: 0}); evPaint();
  if (push !== false) { const el = document.getElementById("event"); if (el) el.focus({preventScroll: true}); }
  if (!EV.m) evLoad(id);
  liveCheck(false);
}
(function () { const id = evIdOf(location.hash); if (id) { S.tab = "event"; EV.id = id; } })();
const renderChrome22 = renderChrome;
renderChrome = function () {
  renderChrome22();
  const v = document.getElementById("view-event"); if (v) v.hidden = S.tab !== "event";
  if (S.tab === "event" && EV.id) try { if (evIdOf(location.hash) !== EV.id) history.replaceState(history.state, "", "#event/" + EV.id); } catch (e) {}
};
// banners come from On NA now's summary: the Event page asks for it too, and is drawn again when it arrives
const liveRefresh22 = liveRefresh;
liveRefresh = function () { liveRefresh22(); if (S.tab === "event") evPaint(); };
const renderAll22 = renderAll;
renderAll = function () {
  renderAll22(); evPaint();
  if (S.tab === "event" && EV.id && !EV.m && !EV.loading.has(EV.id) && !EV.err) { evLoad(EV.id); liveCheck(false); }
};
// the page only adds history steps for the Event page and a simulated banner, so Back walks back through those
window.addEventListener("popstate", () => {
  const id = evIdOf(location.hash);
  if (id) { evOpen(id, false); return; }
  const h = (location.hash || "").slice(1), tab = TABS.includes(h) ? h : "home";
  if (tab !== S.tab) { S.tab = tab; renderChrome(); syncPageTheme(); renderAll(); window.scrollTo({top: 0}); }
});
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest('[data-action^="ev-"]'); if (!b) return;
  const a = b.dataset.action;
  if (a === "ev-open") { e.preventDefault(); evOpen(b.dataset.ev); }
  else if (a === "ev-reload") { EV.err = ""; evLoad(EV.id, true); }
  else if (a === "ev-more") { const k = b.dataset.k; if (EV.more.has(k)) EV.more.delete(k); else EV.more.add(k); evPaint(); const nb = document.querySelector(`[data-action="ev-more"][data-k="${CSS.escape(k)}"]`); if (nb) nb.focus({preventScroll: true}); }
  else if (a === "ev-jump") { const t = document.getElementById("ev-" + b.dataset.to); if (t) t.scrollIntoView({block: "start", behavior: RM.matches ? "auto" : "smooth"}); }
});
// open and closed wiki parts stay that way when the page is drawn again
document.addEventListener("toggle", (e) => {
  const d = e.target; if (!d || !d.matches || !d.matches("details.ev-wiki")) return;
  const k = d.dataset.k; EV.open.delete(k); EV.open.delete("!" + k); EV.open.add(d.open ? k : "!" + k);
}, true);
let evCalcT = 0;
document.addEventListener("input", (e) => {
  const t = e.target; if (!t || !t.dataset) return;
  const h = t.dataset.evHave, bo = t.dataset.evBonus; if (h === undefined && bo === undefined) return;
  const v = t.value.replace(/[^\d]/g, "").slice(0, 7);
  if (h !== undefined) { if (v) evPref.have[h] = Number(v); else delete evPref.have[h]; }
  else { if (v) evPref.bonus[bo] = Number(v); else delete evPref.bonus[bo]; }
  evPrefSave(); clearTimeout(evCalcT); evCalcT = setTimeout(evPaint, 250);
});
document.addEventListener("change", (e) => {
  const t = e.target; if (!t || !t.matches || !t.matches("[data-ev-to]")) return;
  evPref.to = t.value === "9" ? 9 : 10; evPrefSave(); evPaint();
});
// the countdown stays right while the page is open
setInterval(() => { if (S.tab === "event" && !document.hidden && EV.m) { const p = document.querySelector("#event .ev-status"); if (p) { const now = Date.now() / 1000, m = EV.m; p.textContent = now < m.s ? "starts " + liveWhen(m.s) : now < m.e ? "ends in " + liveLeft(m.e) + " (" + liveWhen(m.e) + ")" : "ended " + liveWhen(m.e); } } }, 60000);
