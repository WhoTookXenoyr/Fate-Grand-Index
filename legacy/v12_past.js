/* ================= v12: Past Chaldea — every NA servant and Craft Essence, from Atlas Academy ================= */
// The servants here are NOT on your roster and NOT Guests. Nothing on this page changes a servant you already have:
// matching your servants to the NA list is worked out on the fly, and any match you fix by hand is kept apart from them.
__ATLAS_DATA__
const ATLAS_BY_NO = new Map(ATLAS_S.map((x) => [x.no, x]));
// every skill and buff icon in the game's data joins the icon picker
ATLAS_ICONS.forEach((r) => GAME_ICONS.set(r[0], [r[1], r[2]]));
const CE_BY_NO = new Map(ATLAS_C.map((x) => [x.no, x]));
const aimg = (p) => p ? (/^https?:/.test(p) ? p : ATLAS_IMG + p) : "";
const CARD_OF = {Q: "Quick", A: "Arts", B: "Buster"};
TABS.push("past");
(function () { if ((location.hash || "").slice(1) === "past") S.tab = "past"; })();
// pictures added from Past Chaldea are links to Atlas Academy; the page treats them like pictures you uploaded
(function () {
  const base = S.urlCache, isAtlas = (k) => typeof k === "string" && k.startsWith(ATLAS_IMG);
  S.urlCache = new Proxy(base, {get: (t, k) => isAtlas(k) ? k : t[k], has: (t, k) => isAtlas(k) || k in t});
})();

/* ---------- which NA servant is which of yours ---------- */
const LINK_KEY = "spirit-origin-list:v1:atlaslink";
let atlasLinks = (() => { try { const v = JSON.parse(localStorage.getItem(LINK_KEY) || "{}"); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; } })();
function saveLinks() { try { localStorage.setItem(LINK_KEY, JSON.stringify(atlasLinks)); } catch (e) {} mineCache = null; }
const NICK = [[/\bartoria\b/g, "altria"], [/\bsalter\b/g, "altria pendragon alter"], [/\bcastoria\b/g, "altria caster"], [/\billya\b/g, "illyasviel von einzbern"],
  [/\bmhxa\b/g, "mysterious heroine x alter"], [/\bmhx\b/g, "mysterious heroine x"], [/\bjalter\b/g, "jeanne darc alter"], [/\bskadi\b/g, "scathach skadi"],
  [/\bwaver\b/g, "zhuge liang lord el melloi ii"], [/\bel melloi\b/g, "zhuge liang lord el melloi ii"], [/\bberserkoria\b/g, "altria caster"], [/\bkoyan\b/g, "koyanskaya"]];
const nname = (t) => String(t || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[’'`]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const nick = (t) => { let x = " " + nname(t) + " "; NICK.forEach((n) => { x = x.replace(n[0], n[1]); }); return x.replace(/\s+/g, " ").trim(); };
const NICK_N = new Map(ATLAS_S.map((x) => [x.no, nick(x.n)]));
const NICK_B = new Map(ATLAS_S.map((x) => [x.no, nick(x.n.replace(/\([^)]*\)/g, " "))]));
const STOP = new Set(["the", "of", "no", "de", "von", "la", "le", "and", "a", "an", "in"]);
const amCache = new Map();
function autoMatch(s) {
  const key = (s.name || "") + "|" + (s.cls || "") + "|" + (s.rarity || "");
  if (amCache.has(key)) return ATLAS_BY_NO.get(amCache.get(key)) || null;
  const res = autoMatch0(s); amCache.set(key, res ? res.no : 0); return res;
}
function autoMatch0(s) {
  const nm = nick(s.name), cls = s.cls, r = num(s.rarity);
  if (!nm) return null;
  const sameCls = (x) => !cls || x.c === cls, sameR = (x) => !r || x.r === r;
  const named = (q) => ATLAS_S.filter((x) => NICK_N.get(x.no) === q);
  // the same name in the same class is a sure match ("Castoria (Altria Caster)" also tries what's in brackets)
  const tries = [nm];
  const par = /\(([^)]+)\)/.exec(s.name || "");
  if (par) tries.push(nick(par[1]), nick(String(s.name).replace(/\([^)]*\)/g, " ")));
  let loose = null;
  for (const q of tries) { const ec = named(q).filter(sameCls); if (ec.length) { const hit = ec.find(sameR); if (hit) return hit; if (!loose) loose = ec[0]; } }
  // NA names some versions "Name (Summer)": the same name before the brackets, in the same class and rarity
  if (r) { const bn = ATLAS_S.filter((x) => sameCls(x) && sameR(x) && NICK_B.get(x.no) === nm); if (bn.length === 1) return bn[0]; }
  if (loose) return loose;
  // then the closest name within your class
  if (cls) { const w = wordMatch(nm, cls, r); if (w) return w; }
  // and only then the same name in another class (your class may be filled in differently)
  for (const q of tries) { const e = named(q); if (e.length) return e.find(sameR) || e[0]; }
  return cls ? null : wordMatch(nm, "", r);
}
function wordMatch(nm, cls, r) {
  // shared words between your name and the NA name, within the class; the same rarity counts a little extra,
  // since a rarity typed differently shouldn't hide the match
  const words = (t) => t.split(" ").filter((w) => w.length > 1 && !STOP.has(w));
  const toks = words(nm); if (!toks.length) return null;
  const cand = ATLAS_S.filter((x) => !cls || x.c === cls).map((x) => {
    const xt = words(NICK_N.get(x.no)); let m = 0;
    toks.forEach((t) => { if (xt.some((u) => u === t || (t.length >= 4 && u.startsWith(t)) || (u.length >= 4 && t.startsWith(u)))) m++; });
    const f = 2 * m / (toks.length + xt.length);
    return {x: x, m: m, f: f, sc: f + (r && x.r === r ? 0.15 : 0)};
  }).filter((o) => o.m > 0).sort((a, b) => b.sc - a.sc);
  if (!cand.length) return null;
  if (cand.length === 1) return cand[0].x;
  return cand[0].f >= 0.4 && cand[0].sc > cand[1].sc + 0.05 ? cand[0].x : null;
}
// your own pick wins, then the servant's own Atlas number (Guests added from here), then the best guess
function atlasOf(s) {
  if (!s) return null;
  if (Object.prototype.hasOwnProperty.call(atlasLinks, s.id)) return ATLAS_BY_NO.get(num(atlasLinks[s.id])) || null;
  if (num(s.atlas) && ATLAS_BY_NO.has(num(s.atlas))) return ATLAS_BY_NO.get(num(s.atlas));
  return autoMatch(s);
}
let mineCache = null, mineSig = "";
function mineMap() {
  const sig = S.servants.map((s) => s.id + ":" + s.name + ":" + (s.cls || "") + ":" + (s.rarity || "") + ":" + (s.wish ? 1 : 0)).join("|");
  if (mineCache && sig === mineSig) return mineCache;
  mineSig = sig; mineCache = new Map();
  S.servants.forEach((s) => { const a = atlasOf(s); if (a && (!mineCache.has(a.no) || (mineCache.get(a.no).wish && !s.wish))) mineCache.set(a.no, s); });
  return mineCache;
}
const unmatched = () => S.servants.filter((s) => !atlasOf(s) && !(Object.prototype.hasOwnProperty.call(atlasLinks, s.id) && !atlasLinks[s.id]));

/* ---------- turning an NA servant into a Guest ---------- */
function atlasToServant(x) {
  const np = x.np || {}, card = CARD_OF[np.cd] || null;
  const art = {}; (x.im || []).slice(0, 4).forEach((p, i) => { art[String(i + 1)] = aimg(p); });
  const cs = (x.cs || []).slice(0, MAX_COSTUMES); cs.forEach((p, i) => { art[i ? "c" + (i + 1) : "c"] = aimg(p); });
  const o = {name: x.n, cls: x.c, rarity: x.r, level: x.lv, npLevel: 1, skills: [10, 10, 10], hp: x.hp[1], atk: x.atk[1], fouHp: 0, fouAtk: 0,
    npName: np.n || null, npCard: card, npTarget: np.tg || null,
    skillInfo: (x.sk || []).map((k) => ({name: k.n, effect: k.e.join("\n"), cd: k.cd, scales: k.v.map((v) => ({label: v[0], v1: v[1], v10: v[2], unit: v[3] || null}))})),
    passives: (x.ps || []).map((p) => ({name: p.n, effect: p.e.join("\n")})),
    deck: x.d.split("").map((c) => CARD_OF[c] || ""),
    attr: x.a || null, lawOrder: (x.o || []).slice(), moral: (x.m || []).slice(), traits: (x.t || []).slice(), traitsSet: true,
    art: art, artStage: art["1"] ? "1" : undefined, atlas: x.no, wish: true,
    url: "https://fategrandorder.fandom.com/wiki/" + encodeURIComponent(x.n.replace(/ /g, "_"))};
  if (cs.length) o.costumeSlots = cs.length;
  if (np.n) o.npTable = {g: [{name: "", slots: []}], v: [{tab: "", note: "", name: np.n, sub: np.ru || "", card: card || "", base: "", rank: np.k || "", type: np.ty || "", hits: np.h ? String(np.h) : "", perHit: np.ph || "",
    effect: (np.e || []).join("\n"), oc: (np.oc || []).join("\n"), rows: (np.r || []).map((r) => ({label: r[0], vals: r[1].slice(0, 5)})), ocRows: (np.o || []).map((r) => ({label: r[0], vals: r[1].slice(0, 5)})), grp: 0}]};
  Object.keys(o).forEach((k) => { if (o[k] === undefined) delete o[k]; });
  return o;
}
async function pcAddGuest(no) {
  const x = ATLAS_BY_NO.get(no); if (!x || S.readOnly) return;
  const have = mineMap().get(no); if (have) { toast(x.n + " is already on your list."); return; }
  const o = atlasToServant(x); o.id = slug(x.n, S.servants); o.order = nextOrder(S.servants);
  const ok = await writeDoc("servants", o); if (!ok) return;
  const i = S.servants.findIndex((v) => v.id === o.id); if (i >= 0) S.servants[i] = o; else S.servants.push(o);
  mineCache = null; renderAll(); if (pcOpen && pcOpen.no === no) pcRenderDetail();
  toastAction(x.n + " added to your Guests.", "Open", () => { pcClose(); goServant(o.id); });
}
// summoned in the game: straight onto your roster, at the start (Lv 1, NP1, first skill at Lv 1, no Fou)
let pcSummoning = false;
async function pcSummon(no) {
  const x = ATLAS_BY_NO.get(no); if (!x || S.readOnly || pcSummoning) return;
  const have = mineMap().get(no);
  if (have && have.wish) { pcClose(); summonServant(have.id); return; }
  if (have) { toast(x.n + " is already on your roster."); return; }
  pcSummoning = true;
  try {
    const o = atlasToServant(x); delete o.wish;
    Object.assign(o, {level: 1, npLevel: 1, skills: [1, "Locked", "Locked"], hp: x.hp[0], atk: x.atk[0], fouHp: 0, fouAtk: 0});
    o.id = slug(x.n, S.servants); o.order = nextOrder(S.servants);
    pcClose();
    await playSummon(o);
    if (S.editing) dropFormArt();
    const ok = await writeDoc("servants", o); if (!ok) return;
    const i = S.servants.findIndex((v) => v.id === o.id); if (i >= 0) S.servants[i] = o; else S.servants.push(o);
    mineCache = null;
    S.tab = "servants"; S.selected = o.id; S.lastSel = o.id; S.editing = null; S.justSummoned = o.id;
    renderAll(); syncPageTheme(); window.scrollTo({top: 0});
    toast(x.n + " joined your roster!");
    setTimeout(() => { if (S.justSummoned === o.id) S.justSummoned = null; }, 3200);
  } finally { pcSummoning = false; }
}
function goServant(id) {
  if (S.editing) dropFormArt();
  S.tab = "servants"; S.selected = id; S.lastSel = id; S.editing = null;
  renderChrome(); renderList(); renderDossier(); syncPageTheme(); window.scrollTo({top: 0});
}

/* ---------- the page ---------- */
const PC_KEY = "spirit-origin-list:v1:past";
const PC = Object.assign({view: "servants", q: "", cls: "", r: "", card: "", attr: "", ord: "", mor: "", tr: "", sort: "no", mine: false, limit: 240, cq: "", cr: "", cf: "", csort: "no", climit: 240, review: false, all: false},
  (() => { try { const v = JSON.parse(localStorage.getItem(PC_KEY) || "{}"); return {view: v.view === "ces" ? "ces" : "servants", sort: v.sort || "no", csort: v.csort || "no"}; } catch (e) { return {}; } })());
const savePC = () => { try { localStorage.setItem(PC_KEY, JSON.stringify({view: PC.view, sort: PC.sort, csort: PC.csort})); } catch (e) {} };
const CE_TYPE = {N: "Story", E: "Limited", R: "Event reward", B: "Bond", V: "Valentine", C: "Commemorative", X: "EXP card", M: "Mana Prism", U: "Other"};
const stars = (r) => "★".repeat(clamp(r || 0, 0, 5));
// the words a servant can be found by: name, NP, class, attribute, alignment, gender and traits
const PC_WORDS = new Map();
function pcWords(x) {
  let w = PC_WORDS.get(x.no);
  if (!w) {
    w = new Set(nname([NICK_N.get(x.no), x.np && x.np.n, x.c, x.a, ATTR_LABEL[x.a], x.a === "Man" ? "human" : "", (x.o || []).join(" "), (x.m || []).join(" "), x.g, (x.t || []).join(" ")].join(" ")).split(" ").filter(Boolean));
    PC_WORDS.set(x.no, w);
  }
  return w;
}
function pcFind(x, q) {
  if (NICK_N.get(x.no).includes(q) || nname(x.np && x.np.n).includes(q) || String(x.no) === q) return true;
  // every word you type is the start of one of theirs: "lawful evil dragon", "sky female", "divine king"
  const w = pcWords(x), ws = Array.from(w);
  return q.split(" ").every((t) => w.has(t) || (t.length > 1 && ws.some((u) => u.startsWith(t))));
}
const pcFiltered = () => !!(PC.attr || PC.ord || PC.mor || PC.tr);
function pcServants() {
  const mine = mineMap(), q = nname(PC.q);
  const arr = ATLAS_S.filter((x) => (PC.mine || !mine.has(x.no)) && (!PC.cls || x.c === PC.cls) && (!PC.r || x.r === Number(PC.r)) && (!PC.card || (x.np && x.np.cd === PC.card))
    && (!PC.attr || x.a === PC.attr) && (!PC.ord || (x.o || []).includes(PC.ord)) && (!PC.mor || (x.m || []).includes(PC.mor)) && (!PC.tr || x.g === PC.tr || (x.t || []).includes(PC.tr))
    && (!q || pcFind(x, q)));
  const by = {no: (a, b) => a.no - b.no, new: (a, b) => b.no - a.no, name: (a, b) => a.n.localeCompare(b.n), rarity: (a, b) => b.r - a.r || a.no - b.no, cls: (a, b) => CLASSES.indexOf(a.c) - CLASSES.indexOf(b.c) || b.r - a.r || a.no - b.no, atk: (a, b) => b.atk[1] - a.atk[1], hp: (a, b) => b.hp[1] - a.hp[1]}[PC.sort] || ((a, b) => a.no - b.no);
  return arr.sort(by);
}
function pcCardHTML(x, mine) {
  const s = mine.get(x.no);
  return `<li><button type="button" class="pc-card r${x.r}${s ? " is-mine" : ""}" data-action="pc-open" data-no="${x.no}" aria-label="${esc(x.n)}, ${esc(x.c)}, ${x.r} stars">
    <span class="pc-face"><img src="${esc(aimg(x.f))}" alt="" loading="lazy" decoding="async">${CLASS_LOGO[x.c] ? `<img class="pc-cls" src="${CLASS_LOGO[x.c]}" alt="">` : ""}<span class="pc-st">${stars(x.r)}</span>${s ? `<i class="pc-tag">${s.wish ? "Guest" : "Yours"}</i>` : ""}</span>
    <span class="pc-n">${esc(x.n)}</span><span class="pc-m">No. ${x.no} · ${esc(x.c)}</span></button></li>`;
}
function pcCes() {
  const q = nname(PC.cq);
  const arr = ATLAS_C.filter((c) => (!PC.cr || c.r === Number(PC.cr)) && (!PC.cf || c.f === PC.cf) && (!q || nname(c.n).includes(q) || nname(c.e.join(" ")).includes(q) || nname((c.x || []).join(" ")).includes(q) || String(c.no) === q));
  const by = {no: (a, b) => a.no - b.no, new: (a, b) => b.no - a.no, name: (a, b) => a.n.localeCompare(b.n), rarity: (a, b) => b.r - a.r || a.no - b.no}[PC.csort] || ((a, b) => a.no - b.no);
  return arr.sort(by);
}
function pcCeCardHTML(c) {
  return `<li><button type="button" class="pc-card is-ce r${c.r}" data-action="ce-open" data-no="${c.no}" aria-label="${esc(c.n)}, ${c.r} star Craft Essence">
    <span class="pc-face"><img src="${esc(aimg(c.fc))}" alt="" loading="lazy" decoding="async"><span class="pc-st">${stars(c.r)}</span></span>
    <span class="pc-n">${esc(c.n)}</span><span class="pc-m">No. ${c.no} · ${esc(CE_TYPE[c.f] || "")}</span></button></li>`;
}
const opt2 = (pairs, cur) => pairs.map((p) => `<option value="${esc(p[0])}"${String(cur) === String(p[0]) ? " selected" : ""}>${esc(p[1])}</option>`).join("");
function pcReviewHTML() {
  if (!PC.review) return "";
  const list = PC.all ? S.servants.slice() : unmatched();
  const rows = list.map((s) => {
    const a = atlasOf(s), fixed = Object.prototype.hasOwnProperty.call(atlasLinks, s.id);
    const pool = ATLAS_S.filter((x) => !s.cls || x.c === s.cls).concat(s.cls ? ATLAS_S.filter((x) => x.c !== s.cls) : []);
    const opts = `<option value="">${a && !fixed ? "Automatic: " + esc(a.n) : "Automatic"}</option><option value="0"${fixed && !atlasLinks[s.id] ? " selected" : ""}>Not on the NA list</option>` +
      `<optgroup label="${esc(s.cls || "All classes")}">${pool.filter((x) => !s.cls || x.c === s.cls).map((x) => `<option value="${x.no}"${fixed && num(atlasLinks[s.id]) === x.no ? " selected" : ""}>${esc(x.n)} · ${stars(x.r)} · No. ${x.no}</option>`).join("")}</optgroup>` +
      (s.cls ? `<optgroup label="Other classes">${pool.filter((x) => x.c !== s.cls).map((x) => `<option value="${x.no}"${fixed && num(atlasLinks[s.id]) === x.no ? " selected" : ""}>${esc(x.n)} (${esc(x.c)}) · No. ${x.no}</option>`).join("")}</optgroup>` : "");
    return `<li class="pcr-row">${miniAva(s)}<span class="pcr-n"><b>${esc(s.name)}</b><small>${esc([s.cls, s.wish ? "Guest" : "Roster"].filter(Boolean).join(" · "))}</small></span><select data-pc-link="${esc(s.id)}" aria-label="NA servant for ${esc(s.name)}">${opts}</select></li>`;
  }).join("");
  return `<div class="pcr"><div class="pcr-h"><p>${PC.all ? "Every servant on your list and the NA servant it counts as." : "These couldn't be matched to an NA servant by name. Pick the right one, or say they aren't on the NA list."} Your choice is kept in this browser; your servants themselves aren't changed.</p>
    <label class="pcr-all"><input type="checkbox" data-pc-all${PC.all ? " checked" : ""}> Show all my servants</label></div>${rows ? `<ul class="pcr-list">${rows}</ul>` : `<p class="tr-none">Everyone on your list is matched.</p>`}</div>`;
}
function pcHeadHTML() {
  const mine = mineMap(), um = unmatched();
  const nRoster = S.servants.filter((s) => !s.wish && atlasOf(s)).length, nGuest = S.servants.filter((s) => s.wish && atlasOf(s)).length;
  return `<div class="pc-head">
    <div class="pc-intro"><h2>Past Chaldea</h2><p>Every servant and Craft Essence on the NA server. The servants you haven't summoned wait here; ${S.readOnly ? "open one to read their skills and Noble Phantasm." : "open one to read their skills and Noble Phantasm, and add them to your Guests when you want them."}</p></div>
    <div class="seg pc-view" role="group" aria-label="Show"><button data-action="pc-view" data-v="servants" aria-pressed="${PC.view === "servants"}">Servants <small>${ATLAS_S.length - mine.size}</small></button><button data-action="pc-view" data-v="ces" aria-pressed="${PC.view === "ces"}">Craft Essences <small>${ATLAS_C.length}</small></button></div>
  </div>
  ${PC.view === "servants" ? `<p class="pc-note">${plural(nRoster, "roster servant")} and ${plural(nGuest, "Guest")} of yours ${PC.mine ? "are marked" : "are left out"}.${um.length ? ` <b>${plural(um.length, "servant")} of yours couldn't be matched</b> (${esc(um.slice(0, 3).map((s) => s.name).join(", "))}${um.length > 3 ? "…" : ""}).` : ""} <button type="button" class="btn ghost sm" data-action="pc-review" aria-expanded="${PC.review}">${PC.review ? "Done" : um.length ? "Match them" : "Check the matches"}</button></p>${pcReviewHTML()}` : ""}`;
}
function pcToolsHTML() {
  if (PC.view === "ces") return `<div class="toolbar pc-tools">
    <input class="grow" type="search" data-pc-q="cq" value="${esc(PC.cq)}" placeholder="Search names and effects, e.g. NP gauge, Buster" aria-label="Search Craft Essences">
    <select data-pc-f="cr" aria-label="Rarity"><option value="">All rarities</option>${opt2([[5, "★5"], [4, "★4"], [3, "★3"], [2, "★2"], [1, "★1"]], PC.cr)}</select>
    <select data-pc-f="cf" aria-label="Kind"><option value="">All kinds</option>${opt2(Object.keys(CE_TYPE).map((k) => [k, CE_TYPE[k]]), PC.cf)}</select>
    <select data-pc-f="csort" aria-label="Sort">${opt2([["no", "Collection order"], ["new", "Newest first"], ["rarity", "Rarity"], ["name", "Name"]], PC.csort)}</select></div>`;
  return `<div class="toolbar pc-tools">
    <input class="grow" type="search" data-pc-q="q" value="${esc(PC.q)}" placeholder="Search names, NPs or traits" aria-label="Search NA servants by name, Noble Phantasm, attribute, alignment or trait">
    <select data-pc-f="cls" aria-label="Class"><option value="">All classes</option>${opt2(CLASSES.map((c) => [c, c]), PC.cls)}</select>
    <select data-pc-f="r" aria-label="Rarity"><option value="">All rarities</option>${opt2([[5, "★5"], [4, "★4"], [3, "★3"], [2, "★2"], [1, "★1"], [0, "★0"]], PC.r)}</select>
    <div class="seg" role="group" aria-label="NP card">${[["", "All"], ["B", "Buster"], ["A", "Arts"], ["Q", "Quick"]].map((c) => `<button data-action="pc-card" data-card="${c[0]}" aria-pressed="${PC.card === c[0]}">${c[0] && CARD_IMG[CARD_OF[c[0]]] ? `<img class="seg-card" src="${CARD_IMG[CARD_OF[c[0]]]}" alt="">` : ""}${c[1]}</button>`).join("")}</div>
    <select data-pc-f="sort" aria-label="Sort">${opt2([["no", "Collection order"], ["new", "Newest first"], ["rarity", "Rarity"], ["cls", "Class"], ["name", "Name"], ["atk", "Max ATK"], ["hp", "Max HP"]], PC.sort)}</select>
    <label class="pc-mine"><input type="checkbox" data-pc-mine${PC.mine ? " checked" : ""}> Show mine too</label></div>
    ${pcTraitBarHTML()}`;
}
let PC_TRAITS = null;
function pcTraitBarHTML() {
  if (!PC_TRAITS) { const c = {}; ATLAS_S.forEach((x) => (x.t || []).forEach((t) => { if (t !== "Male" && t !== "Female") c[t] = (c[t] || 0) + 1; })); PC_TRAITS = Object.keys(c).sort((a, b) => a.localeCompare(b)).map((t) => [t, t + " (" + c[t] + ")"]); }
  return `<div class="toolbar pc-tools pc-tools2" role="group" aria-label="Attribute, alignment and traits">
    <select data-pc-f="attr" aria-label="Attribute"><option value="">Any attribute</option>${opt2(ATTRS.map((a) => [a, ATTR_LABEL[a] || a]), PC.attr)}</select>
    <select data-pc-f="ord" aria-label="Lawful, Neutral or Chaotic"><option value="">Any order</option>${opt2(ORDERS.map((v) => [v, v]), PC.ord)}</select>
    <select data-pc-f="mor" aria-label="Good, Balanced, Evil and the rest"><option value="">Any morality</option>${opt2(MORALS.map((v) => [v, v]), PC.mor)}</select>
    <select data-pc-f="tr" aria-label="Gender or trait"><option value="">Any gender or trait</option><optgroup label="Gender">${opt2([["Female", "Female"], ["Male", "Male"], ["Unknown", "Unknown"]], PC.tr)}</optgroup><optgroup label="Traits">${opt2(PC_TRAITS, PC.tr)}</optgroup></select>
    <button type="button" class="btn ghost sm pc-clear" data-action="pc-clear"${pcFiltered() || PC.q || PC.cls || PC.r || PC.card ? "" : " hidden"}>Clear filters</button></div>`;
}
function pcGridHTML() {
  if (PC.view === "ces") {
    const all = pcCes(), list = all.slice(0, PC.climit);
    return `<p class="pc-count">${plural(all.length, "Craft Essence")}</p>${list.length ? `<ul class="pc-grid ce-grid">${list.map(pcCeCardHTML).join("")}</ul>` : `<p class="tr-none">No Craft Essence matches.</p>`}
      ${all.length > list.length ? `<div class="pc-more"><button type="button" class="btn" data-action="pc-more">Show ${Math.min(240, all.length - list.length)} more</button></div>` : ""}`;
  }
  const mine = mineMap(), all = pcServants(), list = all.slice(0, PC.limit);
  const clr = document.querySelector(".pc-clear"); if (clr) clr.hidden = !(pcFiltered() || PC.q || PC.cls || PC.r || PC.card);
  return `<p class="pc-count">${plural(all.length, "servant")}${PC.q || PC.cls || PC.r || PC.card || pcFiltered() ? " match" : ""}</p>${list.length ? `<ul class="pc-grid">${list.map((x) => pcCardHTML(x, mine)).join("")}</ul>` : `<p class="tr-none">No servant matches.</p>`}
    ${all.length > list.length ? `<div class="pc-more"><button type="button" class="btn" data-action="pc-more">Show ${Math.min(240, all.length - list.length)} more</button></div>` : ""}`;
}
function renderPast() {
  const el = document.getElementById("past"); if (!el) return;
  if (S.tab !== "past") { if (el.firstChild) el.innerHTML = ""; return; }
  if (S.dbState !== "ok" || !S.loaded.servants) { el.innerHTML = `<div class="skeleton" style="height:340px"></div>`; return; }
  const a = document.activeElement, keep = a && el.contains(a) && a.dataset && a.dataset.pcQ ? a.dataset.pcQ : null, pos = keep ? a.selectionStart : 0;
  el.innerHTML = pcHeadHTML() + pcToolsHTML() + `<div id="pc-results">${pcGridHTML()}</div>`;
  if (keep) { const i = el.querySelector(`[data-pc-q="${keep}"]`); if (i) { i.focus(); try { i.setSelectionRange(pos, pos); } catch (e) {} } }
}
const pcResults = () => { const r = document.getElementById("pc-results"); if (r) r.innerHTML = pcGridHTML(); };

/* ---------- a servant's page, read-only ---------- */
const pcDlg = document.createElement("div");
pcDlg.id = "pc-dlg"; pcDlg.className = "pcd"; pcDlg.hidden = true;
pcDlg.setAttribute("role", "dialog"); pcDlg.setAttribute("aria-modal", "true"); pcDlg.setAttribute("aria-labelledby", "pcd-title");
document.body.appendChild(pcDlg);
let pcOpen = null, pcBack = null;
const fv = (v, u) => v == null ? "—" : fmtVal(Number(v), u === "%" ? "%" : u);
function pcSkillHTML(k0, i) {
  // a skill with upgrades shows the version picked with its switch (the newest to begin with)
  const vs = k0.u ? k0.u.concat([k0]) : null, sv = pcOpen && pcOpen.skv ? pcOpen.skv[i] : null;
  const vi = vs ? clamp(sv != null ? sv : vs.length - 1, 0, vs.length - 1) : 0, k = vs ? vs[vi] : k0;
  const nr = skNameRank(k.n, ""), tier = rankTier(nr.rank);
  const nums = k.v.map((v) => `<div><dt>${esc(v[0])}</dt><dd>${fv(v[1], v[3])}${v[1] !== v[2] ? ` <span class="muted">→ ${fv(v[2], v[3])} at Lv 10</span>` : ""}</dd></div>`);
  if (k.cd) nums.push(`<div><dt>Cooldown</dt><dd>${k.cd} turns <span class="muted">→ ${k.cd - 2} at Lv 10</span></dd></div>`);
  return `<article class="skill${tier ? " tier-" + tier : ""}" style="--sk-p:.6">${tier === "ex" ? `<i class="sk-ring" aria-hidden="true"><b></b></i>` : ""}
    <header${k.ic ? ` class="has-ic"` : ""}>${k.ic ? icHTML(k.ic, "sk-ic") : ""}<span class="slot">Skill ${i + 1}</span><h4>${rankNameHTML(nr)}${vs ? upSwitchHTML(vs.length, vi, `data-action="pc-skup" data-i="${i}"`) : ""}</h4></header>
    ${k.e.length ? `<div class="effect">${iconLinesHTML(null, k.e.join("\n"), true)}</div>` : ""}
    ${nums.length ? `<dl class="skill-nums">${nums.join("")}</dl>` : ""}</article>`;
}
function pcNpHTML(x) {
  const n0 = x.np; if (!n0) return "";
  // an NP with upgrades shows the version picked with its switch (the newest to begin with)
  const vs = n0.u ? n0.u.concat([n0]) : null, sv = pcOpen && pcOpen.npv != null ? pcOpen.npv : null;
  const vi = vs ? clamp(sv != null ? sv : vs.length - 1, 0, vs.length - 1) : 0, n = vs ? vs[vi] : n0;
  const card = CARD_OF[n.cd] || "", cc = cardCls(card), mult = CARD_MULT[card];
  const row = (r, oc) => `<tr${oc ? ' class="oc"' : ""}><th class="lab">${esc(r[0])}</th>${r[1].slice(0, 5).map((v) => `<td>${esc(v)}</td>`).join("")}</tr>`;
  // a value that stays the same at every NP level isn't worth a row of its own
  const rows = n.r.filter((r) => !npFlatVals(r[1]));
  return `<section class="d-sec np-sec pc-np"><div class="sec-head"><h3>Noble Phantasm</h3></div>
    <div class="npt-box ${cc}"${card ? ` data-atmo="${card.toLowerCase()}"` : ""}>
      <div class="npt-title">${npAtmoHTML(card)}<b>${esc(n.n)}</b>${n.ru ? `<span>${esc(n.ru)}</span>` : ""}${n.tg ? `<span class="tag">${esc(n.tg)}</span>` : ""}${vs ? upSwitchHTML(vs.length, vi, `data-action="pc-npup"`) : ""}</div>
      <div class="npt-scroll"><table class="npt"><colgroup><col class="c-lab"><col><col><col><col><col></colgroup><tbody>
        <tr><td class="npt-cardcell" rowspan="4">${CARD_IMG[card] ? `<img class="np-card" src="${CARD_IMG[card]}" alt="${esc(card)} card">` : ""}${mult ? `<div class="npt-base">Base Damage: x${mult}</div>` : ""}</td><th>Rank</th><th colspan="4">Noble Phantasm Type</th></tr>
        <tr><td>${esc(n.k || "—")}</td><td colspan="4">${esc(n.ty || "—")}</td></tr>
        <tr><th>Hits</th><th colspan="4">Per Hit Percentage</th></tr>
        <tr><td>${n.h || "—"}</td><td colspan="4">${esc(n.ph || "—")}</td></tr>
        <tr><th class="lab">Effect</th><td colspan="5">${n.e.length ? iconLinesHTML(null, n.e.join("\n"), true) : `<span class="npt-empty">—</span>`}</td></tr>
        ${rows.length ? `<tr><th class="lab">NP Level</th>${[1, 2, 3, 4, 5].map((i) => `<th>${i}</th>`).join("")}</tr>${rows.map((r) => row(r)).join("")}` : ""}
        ${n.oc.length || n.o.length ? `<tr class="oc"><th class="lab">Overcharge Effect</th><td colspan="5">${n.oc.length ? iconLinesHTML(null, n.oc.join("\n"), true) : `<span class="npt-empty">—</span>`}</td></tr>${n.o.length ? `<tr class="oc"><th class="lab">Charge</th>${NP_CHARGE.map((v) => `<th>${v}</th>`).join("")}</tr>${n.o.map((r) => row(r, true)).join("")}` : ""}` : ""}
      </tbody></table></div></div></section>`;
}
function pcDetailHTML(x) {
  const mine = mineMap().get(x.no), k = Math.min(pcOpen.k || 0, x.im.length + x.cs.length - 1);
  const pics = x.im.map((p, i) => ({p: p, t: "Stage " + (i + 1)})).concat(x.cs.map((p, i) => ({p: p, t: x.cs.length > 1 ? "Costume " + (i + 1) : "Costume"})));
  const pic = pics[k] || pics[0];
  const stat = (lab, a) => `<tr><th>${lab}</th>${[a[0], a[1], a[2], a[3]].map((v) => `<td>${v == null ? "—" : fmt(v)}</td>`).join("")}</tr>`;
  const deck = x.d.split("").map((c) => CARD_IMG[CARD_OF[c]] ? `<img src="${CARD_IMG[CARD_OF[c]]}" alt="${CARD_OF[c]}">` : "").join("");
  // every tag is a button: it filters Past Chaldea by that attribute, alignment or trait
  const tagB = (k, v, label, cls) => `<button type="button" class="chip${cls || ""}" data-action="pc-tag" data-k="${k}" data-v="${esc(v)}" title="Show every servant with this">${esc(label)}</button>`;
  const tags = (x.a ? tagB("attr", x.a, "Attribute: " + (ATTR_LABEL[x.a] || x.a)) : "") + (x.o || []).map((v) => tagB("ord", v, v)).join("") + (x.m || []).map((v) => tagB("mor", v, v)).join("") + (x.g !== "Unknown" ? tagB("tr", x.g, x.g) : "");
  const traits = (x.t || []).filter((t) => t !== "Male" && t !== "Female");
  const ps = x.ps.map((p, i) => { const nr = skNameRank(p.n, ""); return `<li class="ps-row${psTierCls({name: p.n})}"><span class="ps-n">${i + 1}</span><div class="ps-main"><p class="ps-name">${p.ic ? icHTML(p.ic, "sk-ic ps-ic") : ""}${rankNameHTML(nr)}</p>${p.e.length ? `<div class="effect">${iconLinesHTML(null, p.e.join("\n"), true)}</div>` : ""}</div></li>`; }).join("");
  const action = mine ? `<p class="pcd-mine">${mine.wish ? "One of your Guests" : "On your roster"}${mine.name !== x.n ? ` as <b>${esc(mine.name)}</b>` : ""}.</p>${mine.wish && !S.readOnly ? `<button type="button" class="btn summon-btn pcd-sum" data-action="pc-summon" data-no="${x.no}">Summon</button>` : ""}<button type="button" class="btn ${mine.wish ? "ghost sm" : "primary"}" data-action="pc-go" data-id="${esc(mine.id)}">Open ${mine.wish ? "Guest" : "on your roster"}</button>`
    : (S.readOnly ? "" : `<button type="button" class="btn summon-btn pcd-sum" data-action="pc-summon" data-no="${x.no}" title="Joins your roster at Lv 1">Summon to roster</button><button type="button" class="btn ghost sm pcd-add" data-action="pc-add" data-no="${x.no}">Add to Guests</button>`);
  const um = mine ? [] : unmatched();
  return `<div class="pcd-panel">
    <button type="button" class="pcd-x" data-action="pc-close" aria-label="Close">×</button>
    <div class="pcd-top">
      <div class="pcd-art r${x.r}"><div class="pcd-frame">${pic ? `<img src="${esc(aimg(pic.p))}" alt="${esc(x.n)}, ${esc(pic.t)}" decoding="async"><i class="art-glare" aria-hidden="true"></i>` : ""}</div>
        ${pics.length > 1 ? `<div class="pcd-stages" role="group" aria-label="Pictures">${pics.map((q, i) => `<button type="button" data-action="pc-pic" data-k="${i}" aria-pressed="${i === k}">${esc(q.t)}</button>`).join("")}</div>` : ""}</div>
      <div class="pcd-info">
        <p class="pcd-kick">No. ${x.no} · ${esc(x.c)}${x.h ? " · story only" : ""}</p>
        <h2 id="pcd-title" class="pcd-name">${CLASS_LOGO[x.c] ? `<img src="${CLASS_LOGO[x.c]}" alt="">` : ""}${esc(x.n)}</h2>
        <p class="pcd-stars" aria-label="${x.r} stars">${stars(x.r)}</p>
        <div class="pcd-act">${action}<a class="btn ghost sm" href="https://apps.atlasacademy.io/db/NA/servant/${x.no}" target="_blank" rel="noopener">Atlas Academy ↗</a><a class="btn ghost sm" href="https://fategrandorder.fandom.com/wiki/${encodeURIComponent(x.n.replace(/ /g, "_"))}" target="_blank" rel="noopener">FGO wiki ↗</a></div>
        <table class="pcd-stats"><thead><tr><th></th><th>Lv 1</th><th>Lv ${x.lv}</th><th>Lv 100</th><th>Lv 120</th></tr></thead><tbody>${stat("HP", x.hp)}${stat("ATK", x.atk)}</tbody></table>
        <div class="pcd-deck"><span class="lbl">Deck</span><span class="pcd-cards">${deck}</span></div>
        <p class="pcd-facts">${[x.sa != null ? "Star absorption " + x.sa : "", x.sg != null ? "Star generation " + (x.sg / 10) + "%" : "", x.dt != null ? "Death rate " + (x.dt / 10) + "%" : ""].filter(Boolean).map(esc).join(" · ")}</p>
        <div class="pcd-tags">${tags}${traits.map((t) => tagB("tr", t, t, " t")).join("")}</div>
        ${um.length && !S.readOnly ? `<details class="pcd-link"><summary>Already on your list under another name?</summary><div><select data-pc-linkme="${x.no}" aria-label="Which of your servants is ${esc(x.n)}"><option value="">Pick your servant</option>${um.map((s) => `<option value="${esc(s.id)}">${esc(s.name)}${s.wish ? " (Guest)" : ""}</option>`).join("")}</select></div></details>` : ""}
      </div>
    </div>
    <section class="d-sec"><h3>Skills</h3><div class="skills pcd-skills">${x.sk.map(pcSkillHTML).join("")}</div></section>
    ${ps ? `<section class="d-sec ps-sec"><div class="sec-head"><h3>Passive skills <small>${x.ps.length}</small></h3></div><ol class="ps-list">${ps}</ol></section>` : ""}
    ${pcNpHTML(x)}
    <p class="pcd-src">Data from Atlas Academy's NA export. Skill numbers show Lv 1 → Lv 10; NP rows show NP1 → NP5 and Overcharge 100% → 500%.</p>
  </div>`;
}
function pcRenderDetail() {
  if (!pcOpen) return;
  const sc = pcDlg.querySelector(".pcd-panel"), top = sc ? sc.scrollTop : 0;
  pcDlg.innerHTML = pcOpen.ce ? ceDetailHTML(CE_BY_NO.get(pcOpen.no)) : pcDetailHTML(ATLAS_BY_NO.get(pcOpen.no));
  const p2 = pcDlg.querySelector(".pcd-panel"); if (p2) p2.scrollTop = top;
}
function pcShow(no, ce) {
  if (!(ce ? CE_BY_NO : ATLAS_BY_NO).has(no)) return;
  if (pcDlg.hidden) pcBack = document.activeElement;
  pcOpen = {no: no, ce: !!ce, k: 0};
  pcRenderDetail();
  pcDlg.hidden = false; document.documentElement.classList.add("pcd-on");
  const shell = document.querySelector(".shell"); if (shell) shell.inert = true;
  const p = pcDlg.querySelector(".pcd-panel"); if (p) { p.scrollTop = 0; p.focus({preventScroll: true}); }
  const x = pcDlg.querySelector(".pcd-x"); if (x) x.focus({preventScroll: true});
}
function pcClose() {
  if (pcDlg.hidden) return;
  pcDlg.hidden = true; pcDlg.innerHTML = ""; pcOpen = null; document.documentElement.classList.remove("pcd-on");
  const shell = document.querySelector(".shell"); if (shell) shell.inert = false;
  if (pcBack && pcBack.isConnected) pcBack.focus({preventScroll: true}); pcBack = null;
}

/* ---------- a Craft Essence ---------- */
function ceDetailHTML(c) {
  const owner = c.b ? ATLAS_BY_NO.get(c.b) : null;
  return `<div class="pcd-panel is-ce">
    <button type="button" class="pcd-x" data-action="pc-close" aria-label="Close">×</button>
    <div class="pcd-top">
      <div class="pcd-art is-ce r${c.r}"><div class="pcd-frame">${c.im ? `<img src="${esc(aimg(c.im))}" alt="${esc(c.n)}" decoding="async">` : ""}</div></div>
      <div class="pcd-info">
        <p class="pcd-kick">Craft Essence No. ${c.no} · ${esc(CE_TYPE[c.f] || "")}</p>
        <h2 id="pcd-title" class="pcd-name">${esc(c.n)}</h2>
        <p class="pcd-stars" aria-label="${c.r} stars">${stars(c.r)}</p>
        <div class="ce-eff"><h3>Effect</h3><div class="effect">${iconLinesHTML(null, c.e.join("\n"), true)}</div>
          ${c.x ? `<h3>Max Limit Break</h3><div class="effect">${iconLinesHTML(null, c.x.map((t) => t.replace(/\s*\[MAX\]/g, "")).join("\n"), true)}</div>` : ""}</div>
        <table class="pcd-stats"><thead><tr><th></th><th>Lv 1</th><th>Max</th></tr></thead><tbody><tr><th>HP</th><td>${fmt(c.hp[0])}</td><td>${fmt(c.hp[1])}</td></tr><tr><th>ATK</th><td>${fmt(c.atk[0])}</td><td>${fmt(c.atk[1])}</td></tr></tbody></table>
        ${owner ? `<p class="pcd-facts">Bond Craft Essence of <button type="button" class="linkish" data-action="pc-open" data-no="${owner.no}">${esc(owner.n)}</button>.</p>` : ""}
        <div class="pcd-act"><a class="btn ghost sm" href="https://apps.atlasacademy.io/db/NA/craft-essence/${c.no}" target="_blank" rel="noopener">Atlas Academy ↗</a></div>
      </div>
    </div>
  </div>`;
}

/* ---------- wiring ---------- */
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest("[data-action]");
  if (!b) { if (!pcDlg.hidden && e.target === pcDlg) pcClose(); return; }
  const a = b.dataset.action;
  if (a === "tab" || a === "goto" || a === "summon") { setTimeout(renderPast, 0); return; }
  if (a === "pc-open") { pcShow(Number(b.dataset.no), false); return; }
  if (a === "ce-open") { pcShow(Number(b.dataset.no), true); return; }
  if (a === "pc-close") { pcClose(); return; }
  if (a === "pc-pic") { if (pcOpen) { pcOpen.k = Number(b.dataset.k) || 0; pcRenderDetail(); const q = pcDlg.querySelector(`[data-action="pc-pic"][data-k="${pcOpen.k}"]`); if (q) q.focus({preventScroll: true}); } return; }
  if (a === "pc-add") { pcAddGuest(Number(b.dataset.no)); return; }
  if (a === "pc-summon") { pcSummon(Number(b.dataset.no)); return; }
  if (a === "pc-go") { const id = b.dataset.id; pcClose(); goServant(id); return; }
  if (a === "pc-view") { PC.view = b.dataset.v === "ces" ? "ces" : "servants"; savePC(); renderPast(); return; }
  if (a === "pc-card") { PC.card = b.dataset.card || ""; PC.limit = 240; renderPast(); return; }
  if (a === "pc-more") { if (PC.view === "ces") PC.climit += 240; else PC.limit += 240; pcResults(); return; }
  if (a === "pc-review") { PC.review = !PC.review; renderPast(); return; }
  if (a === "pc-clear") { Object.assign(PC, {q: "", cls: "", r: "", card: "", attr: "", ord: "", mor: "", tr: "", limit: 240}); renderPast(); return; }
  if (a === "pc-tag") {
    const k = b.dataset.k; if (!["attr", "ord", "mor", "tr"].includes(k)) return;
    Object.assign(PC, {view: "servants", q: "", cls: "", r: "", card: "", attr: "", ord: "", mor: "", tr: "", limit: 240}); PC[k] = b.dataset.v;
    pcClose(); if (S.tab !== "past") { S.tab = "past"; renderChrome(); syncPageTheme(); } renderPast();
    const bar = document.querySelector(".pc-tools2"); if (bar) bar.scrollIntoView({block: "center"});
    return;
  }
});
document.addEventListener("keydown", (e) => { if (!pcDlg.hidden && e.key === "Escape") { e.preventDefault(); e.stopPropagation(); pcClose(); } }, true);
let pcQT = 0;
document.addEventListener("input", (e) => {
  const t = e.target; if (!t || !t.dataset || t.dataset.pcQ == null) return;
  PC[t.dataset.pcQ] = t.value; PC.limit = 240; PC.climit = 240;
  clearTimeout(pcQT); pcQT = setTimeout(pcResults, 120);
});
document.addEventListener("change", (e) => {
  const t = e.target; if (!t || !t.dataset) return;
  if (t.dataset.pcF != null) { PC[t.dataset.pcF] = t.value; PC.limit = 240; PC.climit = 240; savePC(); pcResults(); return; }
  if (t.dataset.pcMine != null) { PC.mine = t.checked; pcResults(); renderPast(); return; }
  if (t.dataset.pcAll != null) { PC.all = t.checked; renderPast(); return; }
  if (t.dataset.pcLink != null) {
    const id = t.dataset.pcLink, v = t.value;
    if (v === "") delete atlasLinks[id]; else atlasLinks[id] = Number(v);
    saveLinks(); renderPast();
    const s = S.servants.find((x) => x.id === id), a = s ? atlasOf(s) : null;
    toast(s ? (a ? s.name + " counts as " + a.n + " (No. " + a.no + ")." : v === "0" ? s.name + " is kept off the NA list." : s.name + " is matched automatically again.") : "Saved.");
    return;
  }
  if (t.dataset.pcLinkme != null && t.value) {
    const no = Number(t.dataset.pcLinkme), id = t.value; atlasLinks[id] = no; saveLinks();
    const s = S.servants.find((x) => x.id === id); pcRenderDetail(); renderPast();
    toast((s ? s.name : "That servant") + " now counts as " + ATLAS_BY_NO.get(no).n + ".");
  }
});
const renderAll12 = renderAll;
renderAll = function () { renderAll12(); renderPast(); };
