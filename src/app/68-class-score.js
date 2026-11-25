/* ================= 0.55.0-beta: Class Score =================
   The game's nine class boards (ATLAS_CB, from Atlas Academy's class boards; tools/gen_atlas.py): Saber to Berserker,
   Extra I (Shielder, Ruler, Avenger, Moon Cancer) and Extra II (Alter Ego, Foreigner, Pretender, Beast). Noyr put it
   first on the way to 1.0 (25 Nov 2026), since NA has it already.

   A board is a star map. Each sign raises one passive by a level (Buster card strength +2% a level, NP strength +5%…) or
   Command Spell Excitation; locks open with Torches; empty squares join the rest. A sign opens once a square next to
   it is open, starting from the two start signs, as in the game. What you've opened is kept under its own key
   (CS_KEY: {b: {board: [square ids]}, sel, on}), synced like the other remembered things (EXTRA_KEYS), and never
   touches the roster.

   What a board adds counts for every servant of its classes on your side: card strength and NP strength in the NP
   calculator (npcAuto), and those plus critical damage, the Extra attack and star drops in the Battle simulator
   (btFromServant → t.cs, read in 49a-battle-engine.js). "Count Class Score" on the page turns that off. */
const CS_KEY = "spirit-origin-list:v1:classscore";
const CSB = typeof ATLAS_CB !== "undefined" && ATLAS_CB && Array.isArray(ATLAS_CB.boards) ? ATLAS_CB : {boards: [], sk: {}, cs: {}, items: {}};
const CSB_BY = new Map(CSB.boards.map((b) => [b.id, b]));
const CSB_OF_CLS = new Map(); CSB.boards.forEach((b) => b.cls.forEach((c) => CSB_OF_CLS.set(c, b)));
// each board's squares by id and who's next to whom
const CSB_G = new Map();
CSB.boards.forEach((b) => {
  const sq = new Map(b.sq.map((q) => [q[0], {id: q[0], x: q[1], y: q[2], k: q[3], ref: q[4], ic: q[5], cost: q[6], start: !!q[7]}]));
  const nb = new Map([...sq.keys()].map((id) => [id, []]));
  b.ln.forEach((l) => { if (nb.has(l[0]) && nb.has(l[1])) { nb.get(l[0]).push(l[1]); nb.get(l[1]).push(l[0]); } });
  const xs = b.sq.map((q) => q[1]), ys = b.sq.map((q) => q[2]), pad = 70;
  CSB_G.set(b.id, {sq: sq, nb: nb, x0: Math.min(...xs) - pad, x1: Math.max(...xs) + pad, y0: Math.min(...ys) - pad, y1: Math.max(...ys) + pad,
    signs: b.sq.filter((q) => q[3] === "p" || q[3] === "c").length, locks: b.sq.filter((q) => q[3] === "l").length});
});
const csTakes = (q) => q && q.k !== "b"; // squares you open (and pay for): signs and locks

/* ---------- what's kept ---------- */
let csRaw = null, csObj = {b: {}};
function csState() {
  const r = lsGet(CS_KEY);
  if (r !== csRaw) {
    csRaw = r;
    try { const v = JSON.parse(r || "{}"); csObj = v && typeof v === "object" && !Array.isArray(v) ? v : {}; } catch (e) { csObj = {}; }
    if (!csObj.b || typeof csObj.b !== "object" || Array.isArray(csObj.b)) csObj.b = {};
  }
  return csObj;
}
const csSave = () => { csRaw = JSON.stringify(csObj); lsSet(CS_KEY, csRaw); };
if (typeof EXTRA_KEYS !== "undefined") { EXTRA_KEYS.classscore = CS_KEY; EXTRA_BY_KEY.set(CS_KEY, "classscore"); }
const csOn = () => csState().on !== false;
// the squares opened on a board (only ones that exist and are opened in the game: signs and locks)
function csSet(bid) {
  const g = CSB_G.get(bid), a = csState().b[bid];
  return new Set(g && Array.isArray(a) ? a.map(num).filter((id) => csTakes(g.sq.get(id))) : []);
}
function csPut(bid, set) { csState().b[bid] = [...set].sort((a, b) => a - b); if (!set.size) delete csState().b[bid]; csSave(); }

/* ---------- the game's rules ---------- */
// open squares: the opened ones, and every empty square next to an open one (they cost nothing)
function csOpen(bid, set) {
  const g = CSB_G.get(bid), open = new Set(set), todo = [...set];
  while (todo.length) {
    const id = todo.pop();
    (g.nb.get(id) || []).forEach((n) => { const q = g.sq.get(n); if (q && q.k === "b" && !open.has(n)) { open.add(n); todo.push(n); } });
  }
  return open;
}
// can this square be opened now: a start sign, or next to an open square
function csCan(bid, id, set) {
  const g = CSB_G.get(bid), q = g && g.sq.get(id);
  if (!csTakes(q) || set.has(id)) return false;
  if (q.start) return true;
  const open = csOpen(bid, set);
  return (g.nb.get(id) || []).some((n) => open.has(n));
}
// what's still joined to a start sign through open squares (closing a sign closes what was only reached through it)
function csPrune(bid, set) {
  const g = CSB_G.get(bid), open = csOpen(bid, set), seen = new Set(), todo = [...set].filter((id) => g.sq.get(id).start);
  todo.forEach((id) => seen.add(id));
  while (todo.length) {
    const id = todo.pop();
    (g.nb.get(id) || []).forEach((n) => { if (open.has(n) && !seen.has(n)) { seen.add(n); todo.push(n); } });
  }
  return new Set([...set].filter((id) => seen.has(id)));
}
// the shortest way to a square from what's open (or from a start sign): the squares to open on the way, itself last
function csPath(bid, id, set) {
  const g = CSB_G.get(bid); if (!g || !csTakes(g.sq.get(id))) return [];
  // (from every open square and both start signs, which can always be opened)
  const open = csOpen(bid, set), prev = new Map(), q = [];
  g.sq.forEach((s) => { if (open.has(s.id) || s.start) { prev.set(s.id, null); q.push(s.id); } });
  for (let i = 0; i < q.length && !prev.has(id); i++) (g.nb.get(q[i]) || []).forEach((n) => { if (!prev.has(n)) { prev.set(n, q[i]); q.push(n); } });
  if (!prev.has(id)) return [];
  const out = []; for (let c = id; c != null; c = prev.get(c)) if (!set.has(c) && csTakes(g.sq.get(c))) out.unshift(c);
  return out;
}

/* ---------- what it adds ---------- */
// each passive's level (how many of its signs are open) and Command Spell Excitation's
function csLevels(bid, set) {
  const g = CSB_G.get(bid), lv = {}, max = {}; let cs = 0, csMax = 0, csRef = 0;
  g.sq.forEach((q) => {
    if (q.k === "p") { max[q.ref] = (max[q.ref] || 0) + 1; if (set.has(q.id)) lv[q.ref] = (lv[q.ref] || 0) + 1; }
    if (q.k === "c") { csMax++; csRef = q.ref; if (set.has(q.id)) cs++; }
  });
  return {lv: lv, max: max, cs: cs, csMax: csMax, csRef: csRef};
}
const csVal = (sk, lv) => lv > 0 ? (sk.v[Math.min(lv, sk.v.length) - 1] || 0) : 0;
const CS_CARD = {B: "Buster", A: "Arts", Q: "Quick", E: "Extra"};
// "Buster Card Strength Up" → "Buster card strength"
const csName = (sk) => String(sk.n || "").replace(/\s+Up$/i, "").replace(/\bCards?\b/g, "card").replace(/\bStrength\b/, "strength").replace(/(\w) Critical\b/, "$1 critical")
  .replace(/^Increase /, "").replace(/\bEffectiveness\b/, "effectiveness").replace(/^C\. Star Drop Rate$/, "Star drop rate").replace(/^NP strength$/i, "NP strength");
// the effects, grouped: [{n, v, lv, max, c}]
function csEffects(bid, set) {
  // (two passives doing the same thing, +2% and +4% Arts card strength, are one line)
  const L = csLevels(bid, set), out = [], by = new Map();
  Object.keys(L.max).forEach((ref) => {
    const sk = CSB.sk[ref]; if (!sk) return;
    const k = sk.b + "|" + sk.c, e = by.get(k) || {ref: ref, n: csName(sk), v: 0, top: 0, lv: 0, max: 0, c: sk.c, b: sk.b};
    e.v += csVal(sk, L.lv[ref] || 0); e.top += csVal(sk, L.max[ref]); e.lv += L.lv[ref] || 0; e.max += L.max[ref];
    if (!by.has(k)) { by.set(k, e); out.push(e); }
  });
  const order = {upCommandatk: 0, upNpdamage: 1, upCriticaldamage: 2, upCommandall: 3, upCriticalpoint: 4};
  out.sort((a, b) => (order[a.b] ?? 9) - (order[b.b] ?? 9) || "BAQE".indexOf(a.c) - "BAQE".indexOf(b.c) || a.n.localeCompare(b.n));
  return {fx: out, cs: L.cs, csMax: L.csMax, spell: CSB.cs[L.csRef] || null};
}
// what a servant of this class gets in battle (null when there's nothing, or it's turned off)
function csMods(cls, force) {
  if (!force && !csOn()) return null;
  const b = CSB_OF_CLS.get(cls); if (!b) return null;
  const set = csSet(b.id); if (!set.size) return null;
  const L = csLevels(b.id, set), m = {board: b.n, card: {B: 0, A: 0, Q: 0, E: 0}, crit: {B: 0, A: 0, Q: 0}, critAll: 0, np: 0, star: 0};
  Object.keys(L.lv).forEach((ref) => {
    const sk = CSB.sk[ref]; if (!sk) return; const v = csVal(sk, L.lv[ref]);
    if (sk.b === "upCommandatk" && sk.c) m.card[sk.c] += v;
    else if (sk.b === "upCommandall" && sk.c) m.card[sk.c] += v;
    else if (sk.b === "upCriticaldamage") { if (sk.c) m.crit[sk.c] += v; else m.critAll += v; }
    else if (sk.b === "upNpdamage") m.np += v;
    else if (sk.b === "upCriticalpoint") m.star += v;
  });
  ["B", "A", "Q", "E"].forEach((c) => { m.card[c] = Math.round(m.card[c] * 100) / 100; });
  return m;
}
// what opening squares costs: [[item id, amount]], QP first, then Sand of Starlight, Torches, the rest
function csCost(bid, ids) {
  const g = CSB_G.get(bid), t = new Map();
  ids.forEach((id) => { const q = g.sq.get(id); (q && q.cost || []).forEach((c) => t.set(c[0], (t.get(c[0]) || 0) + c[1])); });
  const rank = (id) => id === 1 ? 0 : id === 50 ? 1 : id >= 51 && id <= 53 ? 2 : 3;
  return [...t.entries()].sort((a, b) => rank(a[0]) - rank(b[0]) || a[0] - b[0]);
}
const csItem = (id) => CSB.items[id] || ["Item " + id, ""];
const csAmt = (id, n) => id === 1 ? (n >= 1e6 ? (Math.round(n / 1e5) / 10).toLocaleString("en-US") + "M" : n.toLocaleString("en-US")) : n.toLocaleString("en-US");

/* ---------- the page ---------- */
const CSU = {sel: null, open: null};
const csBoard = () => { const st = csState(), b = CSB_BY.get(num(st.sel)); return b || CSB.boards[0] || null; };
const csPct = (v) => (Math.round(v * 100) / 100).toLocaleString("en-US") + "%";
function csFxText(e) {
  const card = e.c && !e.n.startsWith(CS_CARD[e.c]) ? CS_CARD[e.c] + " " : "";
  return card + e.n + " +" + csPct(e.v);
}
function csPickHTML(cur) {
  return `<div class="csx-pick" role="tablist" aria-label="Class boards">${CSB.boards.map((b) => {
    const set = csSet(b.id), g = CSB_G.get(b.id), n = [...set].filter((id) => g.sq.get(id).k !== "l").length, on = cur && cur.id === b.id;
    const logo = CLASS_LOGO[b.cls[0]];
    return `<button type="button" role="tab" class="csx-tab${on ? " on" : ""}${n >= g.signs ? " full" : ""}" aria-selected="${on}" data-action="csx-board" data-b="${b.id}" style="--p:${(n / g.signs).toFixed(3)}">
      ${logo ? `<img src="${logo}" alt="">` : ""}<span class="csx-tn">${esc(b.n)}</span><span class="csx-tc">${n}/${g.signs}</span><i class="csx-bar" aria-hidden="true"></i></button>`;
  }).join("")}</div>`;
}
function csMapHTML(b, set) {
  const g = CSB_G.get(b.id), open = csOpen(b.id, set), W = g.x1 - g.x0, H = g.y1 - g.y0;
  const px = (x) => ((x - g.x0) / W * 100).toFixed(3) + "%", py = (y) => ((g.y1 - y) / H * 100).toFixed(3) + "%";
  const lines = b.ln.map((l) => {
    const a = g.sq.get(l[0]), c = g.sq.get(l[1]); if (!a || !c) return "";
    return `<line x1="${a.x - g.x0}" y1="${g.y1 - a.y}" x2="${c.x - g.x0}" y2="${g.y1 - c.y}"${open.has(a.id) && open.has(c.id) ? ` class="on"` : ""}/>`;
  }).join("");
  const sqs = [...g.sq.values()].map((q) => {
    if (q.k === "b") return `<i class="csx-dot${open.has(q.id) ? " on" : ""}" style="left:${px(q.x)};top:${py(q.y)}" aria-hidden="true"></i>`;
    const on = set.has(q.id), can = !on && csCan(b.id, q.id, set), sk = q.k === "p" ? CSB.sk[q.ref] : null, sp = q.k === "c" ? CSB.cs[q.ref] : null;
    const label = q.k === "l" ? "Lock" : sk ? csName(sk) : sp ? sp.n : "Sign";
    return `<button type="button" class="csx-sq k-${q.k}${on ? " on" : can ? " can" : ""}${CSU.sel === q.id ? " sel" : ""}${q.start ? " start" : ""}" data-action="csx-sq" data-sq="${q.id}"${sk && sk.c ? ` data-c="${sk.c}"` : ""}
      style="left:${px(q.x)};top:${py(q.y)}" aria-label="${esc(label)}${on ? ", open" : can ? ", can open" : ", closed"}">${q.k === "l" ? CSX_LOCK : q.ic ? `<img src="${esc(aimg(q.ic))}" alt="" loading="lazy" decoding="async">` : ""}</button>`;
  }).join("");
  return `<div class="csx-map-wrap"><div class="csx-map" style="aspect-ratio:${W} / ${H}">
    <svg class="csx-lines" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>
    ${b.ic ? `<img class="csx-emblem" src="${esc(aimg(b.ic))}" alt="" decoding="async">` : ""}${sqs}</div></div>`;
}
const CSX_LOCK = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>`;
function csCostHTML(list) {
  if (!list.length) return `<p class="csx-none">Nothing.</p>`;
  return `<ul class="csx-cost">${list.map((c) => { const it = csItem(c[0]); return `<li>${it[1] ? `<img src="${esc(aimg(it[1]))}" alt="" loading="lazy" decoding="async">` : ""}<span>${esc(it[0])}</span><b>${csAmt(c[0], c[1])}</b></li>`; }).join("")}</ul>`;
}
// the sign you picked: what it does, what it costs, and the button for it
function csSqHTML(b, set) {
  const g = CSB_G.get(b.id), q = CSU.sel != null && g.sq.get(CSU.sel);
  if (!q || !csTakes(q)) return `<p class="csx-hint">Pick a sign on the map to see what it does and open it. A sign opens once a square next to it is open, starting from the two start signs, as in the game.</p>`;
  const on = set.has(q.id), can = csCan(b.id, q.id, set), path = on || can ? [] : csPath(b.id, q.id, set);
  const sk = q.k === "p" ? CSB.sk[q.ref] : null, sp = q.k === "c" ? CSB.cs[q.ref] : null, L = csLevels(b.id, set);
  let what;
  if (sk) { const lv = L.lv[q.ref] || 0, mx = L.max[q.ref]; what = `<p class="csx-what"><b>${esc(csName(sk))} +${csPct(sk.v[0] || 0)}</b> a level. ${lv} of ${mx} open on this board: +${csPct(csVal(sk, lv))}, +${csPct(csVal(sk, mx))} with all.</p>`; }
  else if (sp) what = `<p class="csx-what"><b>${esc(sp.n)}</b>: ATK and DEF +10% a level for a turn, for whoever you use a Command Spell on. ${L.cs} of ${L.csMax} open: +${csPct(sp.atk[L.cs - 1] || 0)}.</p>`;
  else what = `<p class="csx-what"><b>A lock.</b> Torches open it; the signs past it open from there.</p>`;
  const after = on ? set.size - csPrune(b.id, new Set([...set].filter((id) => id !== q.id))).size - 1 : 0;
  const btn = on ? `<button type="button" class="btn ghost sm" data-action="csx-close" data-sq="${q.id}">Close it${after > 0 ? ` (and ${plural(after, "square")} past it)` : ""}</button>`
    : can ? `<button type="button" class="btn sm" data-action="csx-open" data-sq="${q.id}">Open it</button>`
    : path.length ? `<button type="button" class="btn sm" data-action="csx-path" data-sq="${q.id}">Open the way here (${plural(path.length, "square")})</button>` : "";
  return `<div class="csx-picked k-${q.k}">
    <p class="csx-st">${on ? "Open" : can ? "Can open now" : "Closed"}${q.start ? " · a start sign" : ""}</p>
    ${what}
    <p class="csx-k">${on ? "It cost" : path.length ? "The way here costs" : "It costs"}</p>${csCostHTML(csCost(b.id, path.length ? path : [q.id]))}
    <div class="csx-acts">${btn}</div></div>`;
}
function csBoardHTML(b) {
  const set = csSet(b.id), g = CSB_G.get(b.id), E = csEffects(b.id, set);
  const signs = [...set].filter((id) => g.sq.get(id).k !== "l").length, locks = [...set].filter((id) => g.sq.get(id).k === "l").length;
  const left = [...g.sq.values()].filter((q) => csTakes(q) && !set.has(q.id)).map((q) => q.id);
  const fx = E.fx.filter((e) => e.lv), all = E.fx;
  return `<section class="csx-board" aria-labelledby="csx-h">
    <header class="csx-bh"><h3 id="csx-h">${esc(b.n)} <small>for ${esc(b.cls.join(", ").replace(/, ([^,]*)$/, " and $1"))}</small></h3>
      <p class="csx-count"><b>${signs}</b> of ${g.signs} signs · <b>${locks}</b> of ${g.locks} locks</p></header>
    <div class="csx-body">
      ${csMapHTML(b, set)}
      <div class="csx-side">
        <div class="csx-sel" aria-live="polite">${csSqHTML(b, set)}</div>
        <section class="csx-sum"><h4>What it adds</h4>
          ${fx.length || E.cs ? `<ul class="csx-fx">${fx.map((e) => `<li data-c="${e.c}"><span>${esc(csFxText(e))}</span><small>${e.lv}/${e.max}</small></li>`).join("")}${E.cs && E.spell ? `<li class="cs"><span>Command Spell: ATK and DEF +${csPct(E.spell.atk[E.cs - 1] || 0)} for a turn</span><small>${E.cs}/${E.csMax}</small></li>` : ""}</ul>`
            : `<p class="csx-none">Nothing yet. With every sign open: ${esc(all.map((e) => (e.c && !e.n.startsWith(CS_CARD[e.c]) ? CS_CARD[e.c] + " " : "") + e.n + " +" + csPct(e.top)).join(", "))}, and Command Spells giving ATK and DEF +50%.</p>`}
        </section>
        <details class="csx-costs"><summary>Materials: what it cost, and what's left</summary>
          <h4>Spent on this board</h4>${csCostHTML(csCost(b.id, [...set]))}
          <h4>To open the rest</h4>${csCostHTML(csCost(b.id, left))}</details>
        <div class="csx-acts">
          <button type="button" class="btn ghost sm" data-action="csx-all"${left.length ? "" : " disabled"}>Open every square</button>
          <button type="button" class="btn ghost sm" data-action="csx-clear"${set.size ? "" : " disabled"}>Close them all</button></div>
      </div></div></section>`;
}
function csPageHTML() {
  if (!CSB.boards.length) return `<p class="csx-none">The Class Score boards aren't in this copy's data yet.</p>`;
  const b = csBoard();
  return `<section class="d-sec csx-head">
      <p class="csx-lead">The game's nine class boards. Open the signs you've opened in the game: what each board adds counts for every servant of its classes in the NP calculator and the Battle simulator.</p>
      <label class="csx-on"><input type="checkbox" data-csx-on${csOn() ? " checked" : ""}> Count Class Score in the calculators</label>
      ${csPickHTML(b)}</section>
    ${csBoardHTML(b)}`;
}
function csRender() {
  const box = document.getElementById("classscore"); if (!box) return;
  const a = document.activeElement, keep = a && a.closest && a.closest("#classscore") ? (a.dataset.sq ? "[data-sq=\"" + a.dataset.sq + "\"]" : a.dataset.action ? "[data-action=\"" + a.dataset.action + "\"]" + (a.dataset.b ? "[data-b=\"" + a.dataset.b + "\"]" : "") : null) : null;
  const wrap = box.querySelector(".csx-map-wrap"), sx = wrap ? wrap.scrollLeft : 0;
  box.innerHTML = csPageHTML();
  const w2 = box.querySelector(".csx-map-wrap"); if (w2 && sx) w2.scrollLeft = sx;
  if (keep) { const el = box.querySelector(keep); if (el) el.focus({preventScroll: true}); }
}
// changes come with Undo
function csChange(bid, set, words) {
  const was = csSet(bid);
  csPut(bid, set); csRender();
  if (words && typeof toastAction === "function") toastAction(words, "Undo", () => { csPut(bid, was); csRender(); });
  else if (words) toast(words);
}
document.addEventListener("click", (e) => {
  const t = e.target.closest && e.target.closest("#classscore [data-action]"); if (!t) return;
  const b = csBoard(); if (!b) return;
  const act = t.dataset.action, id = num(t.dataset.sq), set = csSet(b.id);
  if (act === "csx-board") { csState().sel = num(t.dataset.b); CSU.sel = null; csSave(); csRender(); return; }
  if (act === "csx-sq") { CSU.sel = CSU.sel === id ? null : id; csRender(); return; }
  if (act === "csx-open") { if (!csCan(b.id, id, set)) return; set.add(id); csChange(b.id, set, null); return; }
  if (act === "csx-path") { const p = csPath(b.id, id, set); if (!p.length) return; p.forEach((x) => set.add(x)); csChange(b.id, set, "Opened " + plural(p.length, "square") + " on the way."); return; }
  if (act === "csx-close") { set.delete(id); const n = csPrune(b.id, set); csChange(b.id, n, set.size + 1 - n.size > 1 ? "Closed " + plural(set.size + 1 - n.size, "square") + "." : null); return; }
  if (act === "csx-all") { const g = CSB_G.get(b.id); csChange(b.id, new Set([...g.sq.values()].filter(csTakes).map((q) => q.id)), "Every square on " + b.n + " is open."); return; }
  if (act === "csx-clear") { csChange(b.id, new Set(), "Closed every square on " + b.n + "."); }
});
document.addEventListener("change", (e) => {
  const t = e.target; if (!t || !t.matches || !t.matches("#classscore input[data-csx-on]")) return;
  csState().on = t.checked ? undefined : false; csSave();
  toast(t.checked ? "Class Score counts in the calculators." : "Class Score doesn't count in the calculators now.");
});

TABS.push("classscore");
UI_IC.classscore = '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="7" r="1.4"/><circle cx="7.6" cy="14.4" r="1.4"/><circle cx="16.4" cy="14.4" r="1.4"/><path d="M12 8.4l-3.6 5M12 8.4l3.6 5M9 14.4h6"/>';
(function () {
  const nav = document.querySelector("nav.tabs"), before = document.getElementById("tab-past");
  const b = document.createElement("button");
  b.className = "tab"; b.setAttribute("role", "tab"); b.id = "tab-classscore"; b.dataset.action = "tab"; b.dataset.tab = "classscore"; b.setAttribute("aria-selected", "false");
  b.innerHTML = `<i class="tab-ic">${uiIcon("classscore")}</i><span class="tab-t">Class Score</span>`; b.title = "Class Score";
  if (nav) nav.insertBefore(b, before && before.parentNode === nav ? before : null);
  const sec = document.createElement("section");
  sec.id = "view-classscore"; sec.setAttribute("aria-labelledby", "tab-classscore"); sec.hidden = true; sec.innerHTML = `<div id="classscore" class="csx"></div>`;
  const after = document.getElementById("view-codes") || document.getElementById("view-battle"); if (after) after.after(sec); else document.querySelector(".shell").appendChild(sec);
  if ((location.hash || "").slice(1) === "classscore") S.tab = "classscore";
})();
if (typeof FOOT_TABS !== "undefined") {
  const i = FOOT_TABS.findIndex((x) => x[0] === "past"); FOOT_TABS.splice(i >= 0 ? i : FOOT_TABS.length, 0, ["classscore", "Class Score"]);
  try { if (typeof foot !== "undefined" && foot) { foot.innerHTML = footHTML(); renderFoot(); } } catch (e) {}
}
const renderAll68 = renderAll;
renderAll = function () { const r = renderAll68.apply(this, arguments); try { if (S.tab === "classscore") csRender(); } catch (e) { console.error(e); } return r; };
const renderChrome68 = renderChrome;
renderChrome = function () { const r = renderChrome68.apply(this, arguments); try { if (S.tab === "classscore") { const b = document.getElementById("classscore"); if (b && !b.childElementCount) csRender(); } } catch (e) { console.error(e); } return r; };

/* ---------- the calculators ---------- */
// the NP calculator: card strength and NP strength, with where they came from
const npcAuto68 = npcAuto;
npcAuto = function (s) {
  const o = npcAuto68.apply(this, arguments), m = s && csMods(s.cls); if (!m) return o;
  [["B", "Buster"], ["A", "Arts"], ["Q", "Quick"]].forEach((c) => { if (m.card[c[0]]) { o.card[c[1]] += m.card[c[0]]; o.from.push("Class Score " + c[1] + " +" + csPct(m.card[c[0]])); } });
  if (m.np) { o.np += m.np; o.from.push("Class Score NP strength +" + csPct(m.np)); }
  return o;
};
// the Battle simulator: your servants (and Guests) fight with their class's board (t.cs; 49a-battle-engine.js)
const btFromServant68 = btFromServant;
btFromServant = function (s) {
  const t = btFromServant68.apply(this, arguments), m = t && csMods(t.cls);
  if (m) t.cs = m;
  return t;
};
// for the tests
window.__fgiClassScore = {boards: () => CSB.boards.map((b) => ({id: b.id, n: b.n, cls: b.cls, signs: CSB_G.get(b.id).signs, locks: CSB_G.get(b.id).locks, open: csSet(b.id).size})),
  can: (b, id) => csCan(b, id, csSet(b)), path: (b, id) => csPath(b, id, csSet(b)), set: (b, ids) => { csPut(b, new Set(ids)); csRender(); }, open: (b) => [...csSet(b)],
  mods: (cls) => csMods(cls, true), effects: (b) => csEffects(b, csSet(b)), cost: (b, ids) => csCost(b, ids), squares: (b) => [...CSB_G.get(b).sq.values()].map((q) => ({id: q.id, k: q.k, start: q.start, ref: q.ref})),
  npcAuto: (id) => { const s = S.servants.find((v) => v.id === id); return s ? npcAuto(s) : null; }, battle: (id) => { const s = S.servants.find((v) => v.id === id); return s ? btFromServant(s) : null; }};
