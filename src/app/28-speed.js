/* ================= 0.24.0: speed with a big roster =================
   Measured with a 194-servant roster (tests/fixtures/roster-200.json) before this file: opening a servant took about
   1 s, a + press 0.9-2.4 s, opening Parties 13 s, typing a search letter 0.9 s. The time went to work done over and
   over: every servant's traits and kit worked out again on every press (and the buff vocabulary, built from every
   servant's traits, once per servant: n² work), Party DNA trying every trio of servants, tabs nobody was looking at
   redrawn after every change, and the whole list rebuilt for a change to one row. */

/* ---------- worked out once per press ----------
   Within one run of the page's code (one press, one redraw) a servant's traits, buffs and the roster-wide lists can't
   change, so they're kept until that run ends (a microtask later). */
let speedMemo = null;
function memoNow() {
  if (!speedMemo) { speedMemo = {ti: new WeakMap(), bf: new WeakMap(), sig: new WeakMap(), one: new Map()}; queueMicrotask(() => { speedMemo = null; }); }
  return speedMemo;
}
const traitInfo23 = traitInfo;
traitInfo = function (s) {
  if (!s || typeof s !== "object") return traitInfo23(s);
  const m = memoNow().ti; let v = m.get(s);
  if (!v) { v = traitInfo23(s); m.set(s, v); }
  return v;
};
const rosterTraits23 = rosterTraits;
rosterTraits = function () { const m = memoNow().one; if (!m.has("rt")) m.set("rt", rosterTraits23()); return m.get("rt").slice(); };
const tagCounts23 = tagCounts;
tagCounts = function () { const m = memoNow().one; if (!m.has("tc")) m.set("tc", tagCounts23()); return m.get("tc"); };
const buffsOf23 = buffsOf;
buffsOf = function (s) {
  if (!s || typeof s !== "object") return buffsOf23(s);
  const m = memoNow().bf; let v = m.get(s);
  if (!v) { v = buffsOf23(s); m.set(s, v); }
  return v;
};

/* ---------- kept until something they depend on changes ---------- */
// the buff vocabulary only depends on which traits the roster has
function vocabKey() { const m = memoNow().one; if (!m.has("vk")) m.set("vk", uniq(rosterTraits23()).sort().join("|")); return m.get("vk"); }
const buffVocab23 = buffVocab;
let vocabC = {k: null, v: null};
buffVocab = function () { const k = vocabKey(); if (vocabC.k !== k) vocabC = {k: k, v: buffVocab23()}; return vocabC.v; };
// a phrase is checked against every word of the vocabulary: each word's pattern is made once, not once per phrase
const vocabRx = new WeakMap();
tagsInPhrase = function (phrase, vocab) {
  let p = " " + phrase + " "; const out = [];
  vocab.forEach((v) => {
    let rx = vocabRx.get(v); if (!rx) { rx = new RegExp("(^|[^A-Za-z])" + escRx(v.name) + "(?![A-Za-z])", "i"); vocabRx.set(v, rx); }
    if (rx.test(p)) { out.push(v.tag); p = p.replace(rx, "$1 "); }
  });
  return uniq(out);
};
// a servant's kit only depends on the servant (its text, skill levels, NP) and the vocabulary
// the NP table is tidied up in place while the page is drawn (npEnsure), so the fingerprint uses the tidied form:
// otherwise the same servant had two fingerprints and nearly every lookup missed (4,819 misses, 1,195 hits)
const sigReplacer = (k, v) => k === "npTable" ? npNorm(v) : v;
const servantSig = (s) => { const m = memoNow().sig; let v = m.get(s); if (v == null) { v = JSON.stringify(s, sigReplacer); m.set(s, v); } return v; };
const kitOf23 = kitOf, kitMemo = new Map();
kitOf = function (s) {
  if (!s || typeof s !== "object" || !s.id) return kitOf23(s);
  const sig = servantSig(s) + "|" + vocabKey(), c = kitMemo.get(s.id);
  if (c && c.sig === sig) return c.v;
  const v = kitOf23(s); kitMemo.set(s.id, {sig: sig, v: v}); return v;
};

/* ---------- Party DNA: trios from the 24 strongest, not every trio ----------
   With 194 servants every trio is 1.2 million teams (13 s). A trio's cover comes from what its members bring, so the
   24 servants who bring the most on their own are the ones worth combining (2,024 teams). */
const STALL_POOL = 24;
const bestStall23 = bestStall;
bestStall = function (pool) {
  const list = pool.filter((s) => kitC(s).length);
  if (list.length <= STALL_POOL) return bestStall23(list);
  const solo = list.map((s) => ({s: s, v: stallEval([s]).score + stallEval([s, s, s]).score })).sort((a, b) => b.v - a.v);
  return bestStall23(solo.slice(0, STALL_POOL).map((x) => x.s));
};

/* ---------- tabs nobody is looking at wait until they're opened ----------
   Home, Summoning, Versus and Past Chaldea already skip their work while hidden (and empty themselves, which stops
   their animations); Parties and Ranking were drawn after every change even when hidden. */
const LAZY_TABS = {renderParties: "parties", renderRanking: "ranking"};
const lazyReal = {}, lazyDirty = new Set();
function lazyGate(name, tab, fn) {
  lazyReal[name] = fn;
  return function () {
    if (S.tab !== tab) { lazyDirty.add(name); return; }
    lazyDirty.delete(name);
    return fn.apply(this, arguments);
  };
}
renderParties = lazyGate("renderParties", "parties", renderParties);
renderRanking = lazyGate("renderRanking", "ranking", renderRanking);
function lazyCatchUp() {
  lazyDirty.forEach((name) => { if (LAZY_TABS[name] === S.tab) { lazyDirty.delete(name); try { lazyReal[name](); } catch (e) {} } });
}
const renderChrome24 = renderChrome;
renderChrome = function () { const r = renderChrome24.apply(this, arguments); lazyCatchUp(); return r; };

/* ---------- the list: only rows that changed are replaced ----------
   Each row is kept with the HTML it was made from; a row whose HTML is the same stays as it is (its animations keep
   running and it keeps focus), and only new or changed rows are made. */
function patchUnits(el, units) {
  if (!el.__units) { el.textContent = ""; el.__units = true; }
  const old = new Map();
  Array.from(el.childNodes).forEach((n) => {
    if (n.nodeType !== 1 || n.__h == null) { n.remove(); return; }
    if (!old.has(n.__h)) old.set(n.__h, []);
    old.get(n.__h).push(n);
  });
  const tpl = document.createElement("template");
  let prev = null;
  units.forEach((h) => {
    if (!h) return;
    let node = null; const same = old.get(h);
    if (same && same.length) node = same.shift();
    if (!node) { tpl.innerHTML = h; node = tpl.content.firstElementChild; if (!node) return; node.__h = h; }
    const at = prev ? prev.nextSibling : el.firstChild;
    if (at !== node) el.insertBefore(node, at);
    prev = node;
  });
  old.forEach((list) => list.forEach((n) => n.remove()));
}
const renderList23 = renderList;
renderList = function () {
  const el = $("#list");
  if (!el || S.dbState !== "ok" || !S.loaded.servants || !S.servants.length || !owned().length) { if (el) el.__units = false; return renderList23(); }
  const arr = filtered();
  if (!arr.length) { el.__units = false; return renderList23(); }
  const sel = shownId();
  patchUnits(el, [traitBannerHTML()].concat(arr.map((s) => rosterRowHTML(s, sel)), [wishListHTML(sel)]));
};
