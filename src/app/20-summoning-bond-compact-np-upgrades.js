/* ================= 0.16.0: summoning rebuilt, Bond, a Compact layout, NP upgrades, stars and fixes ================= */
// Everything new moves with transform and opacity only (the graphics card's cheap path) and stops when it's done.

/* ---------- small helpers ---------- */
// an NP's damage multiplier comes from its card
const CARD_MULT = {Buster: "1.5", Arts: "1.0", Quick: "0.8"};
// a row whose value is the same at every NP level says nothing a row is for
function npFlatVals(vals) { const v = (vals || []).slice(0, 5).map((x) => String(x == null ? "" : x).trim()); return v.length >= 2 && v[0] !== "" && v.every((x) => x === v[0]); }
const npFlat = (r) => npFlatVals(r && r.vals);
// the top tier is called EX on screen (it's still stored as SS, so tiers you set by hand stay put)
const tierName = (k) => k === "SS" ? "EX" : k;

/* ---------- Pretender: its colour comes from the picture, not a fixed green ---------- */
let pretAcc = [92, 232, 160];
Object.defineProperty(EXTRA_ACC, "Pretender", {get: () => pretAcc, set: (v) => { if (Array.isArray(v)) pretAcc = v; }, enumerable: true, configurable: true});
function palAccent(raw) {
  const sat = (c) => { const mx = Math.max(c[0], c[1], c[2]), mn = Math.min(c[0], c[1], c[2]); return mx ? (mx - mn) / mx : 0; };
  return (raw || DEFAULT_PAL).map((h) => hexToRgb(vividHex(h))).sort((a, b) => sat(b) - sat(a))[0];
}
function extraAccOf(s, raw) {
  if (s.cls !== "Pretender") return EXTRA_ACC[s.cls] || null;
  const x = palAccent(raw); EXTRA_ACC.Pretender = x;
  const sc = document.querySelector("#dossier .scene.extra"); if (sc) sc.style.setProperty("--acc", "rgb(" + x.join(",") + ")");
  return x;
}

/* ---------- stars: ★4 beige, ★5 gold with a pulse, a ★5 grailed past Lv 100 in rainbow, Beasts in their picture's colours ---------- */
const starMode = (p) => p.beast ? "pal" : p.rarity >= 5 && p.level > 100 ? "rb" : p.rarity >= 5 ? "gold" : "plain";
function starLook(p, F, i, hue, t, LT) {
  const m = starMode(p), A = (a) => Math.max(0, Math.min(1, a));
  if (m === "rb") { const h = (hue + i * 72) % 360; return {fill: (a) => "hsla(" + h + (LT ? ",85%,50%," : ",90%,64%,") + A(a).toFixed(3) + ")", glow: "hsla(" + h + ",90%,60%,0.9)", blur: 1, scale: 1}; }
  if (m === "pal") { const c = mixC((F.pal && F.pal[i % F.pal.length]) || [255, 255, 255], [255, 255, 255], LT ? 0 : 0.18); return {fill: (a) => rgba(c, A(a + 0.1)), glow: rgba(c, 0.95), blur: 1.15, scale: 1}; }
  const cc = STAR_COL[p.rarity] || STAR_COL[1];
  if (m === "gold") { const pu = 0.5 + 0.5 * Math.sin(t * 2.6 + i * 0.45); return {fill: (a) => rgba(mixC(cc, [255, 238, 170], 0.3 * pu), A(a + 0.15)), glow: "rgba(255,186,30," + (0.7 + 0.3 * pu).toFixed(3) + ")", blur: 0.9 + 0.8 * pu, scale: 1 + 0.07 * pu}; }
  return {fill: (a) => rgba(cc, A(a)), glow: rgba(cc, 0.9), blur: 1, scale: 1};
}
function starClass(s) {
  const r = num(s.rarity) || 0;
  return s.cls === "Beast" ? "st-pal" : r >= 5 && (num(s.level) || 0) > 100 ? "st-rb" : r >= 5 ? "st-r5" : r === 4 ? "st-r4" : "";
}

/* ---------- Bond ---------- */
function bondNote(s) {
  const b = num(s.bond) || 0;
  return b >= 15 ? `<span class="status grail">Max bond</span>` : b >= 10 ? `<span class="status cap">Bond CE</span>` : `<span class="status">${10 - b} to Bond 10</span>`;
}
const bump17 = bump;
bump = function (f, d) {
  if (f !== "bond") return bump17(f, d);
  const s = S.servants.find((x) => x.id === shownId()); if (!s || S.readOnly) return;
  s.bond = clamp((num(s.bond) || 0) + d, 0, 15);
  renderSummary(); renderList(); renderDossier(); renderRanking();
  scheduleWrite("servants", s);
};

/* ---------- Master records: Bond, the tier board, the Holy Grail Servant ---------- */
const recordsOf16 = recordsOf;
recordsOf = function (own) {
  const R = recordsOf16(own);
  const bond = own.reduce((m, s) => Math.max(m, num(s.bond) || 0), 0);
  const ids = new Set(own.map((s) => s.id)), tiers = rankRows().filter((r) => ids.has(r.s.id)).map((r) => tierOf(r.s.id, r.sc.total));
  const at = (ks) => tiers.filter((k) => ks.includes(k)).length;
  const ex = at(["SS"]), sp = at(["SS", "S"]), ap = at(["SS", "S", "A"]);
  const holy = own.reduce((m, s) => Math.max(m, ((num(s.npLevel) || 0) >= 5 ? 1 : 0) + ((num(s.level) || 0) >= 120 ? 1 : 0) + ([0, 1, 2].every((i) => (s.skills || [])[i] === 10) ? 1 : 0)), 0);
  const fou = own.reduce((m, s) => Math.max(m, Math.min(num(s.fouHp) || 0, num(s.fouAtk) || 0)), 0);
  R.push(
    {ic: "Bondsilver", t: "Bond 10", d: "A servant at Bond 10, with their Bond Craft Essence", v: Math.min(bond, 10), of: 10, show: bond ? "Highest Bond " + bond : "None yet"},
    {ic: "Bondgold", t: "Max Bond", d: "A servant at Bond 15", v: Math.min(bond, 15), of: 15, show: bond ? "Highest Bond " + bond : "None yet"},
    {ic: "Powerup", t: "EX Servant", d: "A servant in the EX tier of the Ranking", v: Math.min(ex, 1), of: 1, show: "None yet"},
    {ic: "Statusup", t: "Five S", d: "Five servants in tier S or higher", v: Math.min(sp, 5), of: 5},
    {ic: "Skillrankup", t: "Ten A", d: "Ten servants in tier A or higher", v: Math.min(ap, 10), of: 10},
    {ic: "Nppowerup", t: "Holy Grail Servant", d: "One servant at NP5, skills 10/10/10 and Lv 120", v: holy, of: 3, show: holy ? holy + " of 3 parts" : "None yet"},
    {ic: "GutsHpUp", t: "Rainbow Fou", d: "3,000 Fou on both HP and ATK of one servant", v: Math.min(fou, 3000), of: 3000});
  return R;
};

/* ---------- NP upgrades: a switch next to the NP's name, like skills ---------- */
const npVersions = (a) => a && a.np && a.np.u ? a.np.u.concat([a.np]) : null;
const npKey = (name, rank) => nname(name) + "|" + String(rank || "").toUpperCase().replace(/\s+/g, "");
function npGuess(vs, V, s, vi) {
  const name = String(npField(s, V, vi, "name") || V.name || "").trim(); if (!vs || !name) return -1;
  const key = npKey(name, V.rank), hits = vs.map((v, i) => npKey(v.n, v.k) === key ? i : -1).filter((i) => i >= 0);
  const named = vs.map((v, i) => nname(v.n) === nname(name) ? i : -1).filter((i) => i >= 0);
  const up = num((s.npUpv || {})[vi]);
  if (up != null && vs[up] && (hits.includes(up) || (!hits.length && (named.includes(up) || !named.length)))) return up;
  if (hits.length === 1) return hits[0];
  const row0 = (rs) => JSON.stringify(((rs && rs[0]) || []).slice(0, 5));
  const pool = hits.length ? hits : named;
  if (pool.length) { const mine = row0(V.rows[0] && V.rows[0].vals), m = pool.find((i) => vs[i].r[0] && row0(vs[i].r[0][1]) === mine); return m != null ? m : pool[pool.length - 1]; }
  return /before|→|->/i.test((V.note || "") + " " + (V.tab || "")) ? 0 : vs.length - 1;
}
function npFromAtlas(n, cur) {
  return Object.assign({}, cur, {name: n.n, sub: n.ru || "", rank: n.k || "", type: n.ty || "", hits: n.h ? String(n.h) : "", perHit: n.ph || "", card: CARD_OF[n.cd] || cur.card || "",
    effect: (n.e || []).join("\n"), oc: (n.oc || []).join("\n"), rows: (n.r || []).map((r) => ({label: r[0], vals: r[1].slice(0, 5)})), ocRows: (n.o || []).map((r) => ({label: r[0], vals: r[1].slice(0, 5)}))});
}
function switchNp(s, v) {
  const a = atlasOf(s), vs = npVersions(a); if (!vs || !vs[v] || S.readOnly) return;
  const T = npEnsure(s), vi = npVi(s, T), V = T.v[vi], ci = npGuess(vs, V, s, vi);
  const keep = s.npUpKeep && typeof s.npUpKeep === "object" ? s.npUpKeep : {}, box = keep[vi] || (keep[vi] = {});
  if (ci >= 0) box[ci] = Object.assign(JSON.parse(JSON.stringify(V)), vi === 0 ? {name: s.npName || V.name, card: s.npCard || V.card} : {});
  const nv = box[v] ? JSON.parse(JSON.stringify(box[v])) : npFromAtlas(vs[v], V);
  T.v[vi] = nv; s.npTable = T; s.npUpKeep = keep; s.npUpv = Object.assign({}, s.npUpv, {[vi]: v});
  if (vi === 0) { if (nv.name) s.npName = nv.name; if (CARDS.includes(nv.card)) s.npCard = nv.card; }
  renderList(); renderDossier(true); renderRanking();
  scheduleWrite("servants", s);
  const b = document.querySelector('#dossier [data-action="npup"]'); if (b) b.focus({preventScroll: true});
}

/* ---------- the servant page: stars, the picture's glare, the NP switch, the Compact layout ---------- */
const LAYOUT_KEY = "spirit-origin-list:v1:layout";
let pageLayout = lsGet(LAYOUT_KEY) === "compact" ? "compact" : "modern";
function applyLayout() {
  document.documentElement.dataset.layout = pageLayout;
  const b = document.getElementById("layout-tgl"); if (!b) return;
  const c = pageLayout === "compact";
  b.setAttribute("aria-pressed", String(c)); b.querySelector("b").textContent = c ? "Compact" : "Modern";
  b.title = "Servant page layout: " + (c ? "Compact. Press for Modern" : "Modern. Press for Compact");
  b.setAttribute("aria-label", b.title);
}
applyLayout();
function compactDossier(d) {
  if (d.querySelector(".cmp-top")) return;
  const kids = Array.from(d.children), sec = (q) => kids.find((x) => x.matches("section.d-sec") && x.querySelector(q));
  const head = d.querySelector(":scope > .d-head"), art = sec(".scene"); if (!head || !art) return;
  const top = document.createElement("div"); top.className = "cmp-top";
  const L = document.createElement("div"); L.className = "cmp-l"; const R = document.createElement("div"); R.className = "cmp-r";
  art.before(top); L.append(art); R.append(head);
  [sec(".cmd"), sec('[data-action="bump"][data-f="level"]'), sec(".stat-grid")].forEach((x) => { if (x) R.append(x); });
  top.append(L, R);
}
const renderDossier17 = renderDossier;
renderDossier = function (force) {
  const r = renderDossier17(force);
  const d = document.getElementById("dossier");
  if (d && !S.editing && !d.querySelector("#servant-form")) {
    const s = S.servants.find((v) => v.id === shownId());
    if (s) {
      const hs = d.querySelector(".d-head .d-meta .stars"), sc = starClass(s);
      if (hs && sc && !hs.classList.contains(sc)) { hs.classList.add(sc); hs.dataset.s = hs.textContent; }
      const af = d.querySelector(".art-frame:not(.drop)"); if (af && !af.querySelector(".art-glare")) af.insertAdjacentHTML("beforeend", `<i class="art-glare" aria-hidden="true"></i>`);
      const a = atlasOf(s), vs = npVersions(a);
      if (vs && !S.readOnly && S.npEdit !== s.id) {
        const T = npTableOf(s).T, vi = npVi(s, T), ci = npGuess(vs, T.v[vi], s, vi), title = d.querySelector(".np-sec .npt-title");
        if (title && ci >= 0 && !title.querySelector(".upsw")) title.insertAdjacentHTML("beforeend", upSwitchHTML(vs.length, ci, `data-action="npup"`));
      }
      if (pageLayout === "compact") compactDossier(d);
    }
  }
  return r;
};

/* ---------- the glare that follows the pointer over a servant's picture, like the command cards ---------- */
let glareEl = null, glareRaf = 0, glareX = 0, glareY = 0;
function glareOff() { if (glareEl) { glareEl.classList.remove("glare-on"); glareEl = null; } }
document.addEventListener("pointermove", (e) => {
  if (e.pointerType === "touch" || RM.matches) return;
  const f = e.target.closest ? e.target.closest(".art-frame:not(.drop), .pcd-frame") : null;
  if (glareEl && glareEl !== f) glareOff();
  if (!f || !f.querySelector(".art-glare")) return;
  glareEl = f; glareX = e.clientX; glareY = e.clientY;
  if (glareRaf) return;
  glareRaf = requestAnimationFrame(() => {
    glareRaf = 0; const g = glareEl; if (!g) return;
    const r = g.getBoundingClientRect();
    g.style.setProperty("--mx", (clamp((glareX - r.left) / r.width, 0, 1) * 100).toFixed(1) + "%");
    g.style.setProperty("--my", (clamp((glareY - r.top) / r.height, 0, 1) * 100).toFixed(1) + "%");
    g.classList.add("glare-on");
  });
}, {passive: true});
document.addEventListener("mouseout", (e) => { if (!e.relatedTarget) glareOff(); });

/* ---------- card backs: silver ★3 and gold ★4 servants, bronze ★3, silver ★4 and red ★5 Craft Essences ---------- */
const CB = {s3: "@@asset:cardback-s3.webp@@", s4: "@@asset:cardback-s4.webp@@", c3: "@@asset:cardback-c3.webp@@", c4: "@@asset:cardback-c4.webp@@", c5: "@@asset:cardback-c5.webp@@"};
const backOf = (k, r) => k === "c" ? (r >= 5 ? CB.c5 : r === 4 ? CB.c4 : CB.c3) : (r >= 5 ? CARD_BACK : r === 4 ? CB.s4 : CB.s3);
const smCardHTML16 = smCardHTML;
smCardHTML = function (x, i) {
  const h = smCardHTML16(x, i), b = backOf(x.k, x.r);
  return b === CARD_BACK ? h : h.split(CARD_BACK).join(b);
};

/* ---------- summoning, rebuilt ---------- */
// ★5 servants: rainbow circles, rainbow pillars and a rainbow wipe that unveils them. ★4 servants and ★4–5 Craft Essences:
// the same, a little faster, all in gold. ★3: a short silver flash. ★1–2: no ceremony at all.
// No canvas: every layer is drawn once and only moved or faded, so it stays smooth on any graphics card.
const smTierOf = (k, r) => r <= 2 ? "none" : r === 3 ? "silver" : k === "s" && r >= 5 ? "rainbow" : "gold";
const SM_GRAD = {
  rainbow: [["0", "#ff6b8b"], [".2", "#ffd36b"], [".4", "#7dffa8"], [".6", "#6bd0ff"], [".8", "#c48bff"], ["1", "#ff6b8b"]],
  gold: [["0", "#fff3c4"], [".35", "#e8b93e"], [".6", "#fff1b8"], [".85", "#c99a3b"], ["1", "#fff3c4"]],
  silver: [["0", "#ffffff"], [".4", "#b9c2cc"], [".7", "#eef2f6"], ["1", "#8c96a2"]]};
function smRingsHTML(tier) {
  const stops = (SM_GRAD[tier] || SM_GRAD.gold).map((s) => `<stop offset="${s[0]}" stop-color="${s[1]}"/>`).join("");
  const svg = (inner, defs) => `<svg viewBox="-100 -100 200 200" aria-hidden="true" focusable="false">${defs || ""}${inner}</svg>`;
  const tri = (r, rot) => [0, 1, 2].map((i) => { const a = (rot + i * 120 - 90) * Math.PI / 180; return (Math.cos(a) * r).toFixed(1) + "," + (Math.sin(a) * r).toFixed(1); }).join(" ");
  const st = `stroke="url(#s2g)" fill="none"`;
  return `<div class="s2-circle"><div class="s2-ci">
    <div class="s2-ring r1">${svg(`<circle r="95" ${st} stroke-width="7" opacity=".22"/><circle r="95" ${st} stroke-width="1.6"/><circle r="87" ${st} stroke-width="5" stroke-dasharray="1.2 4.6"/>`, `<defs><linearGradient id="s2g" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient></defs>`)}</div>
    <div class="s2-ring r2">${svg(`<polygon points="${tri(80, 0)}" ${st} stroke-width="1.4"/><polygon points="${tri(80, 60)}" ${st} stroke-width="1.4"/><circle r="62" ${st} stroke-width="5" opacity=".2"/><circle r="62" ${st} stroke-width="1.2"/>`)}</div>
    <div class="s2-ring r3">${svg(`<circle r="40" ${st} stroke-width="1.6" stroke-dasharray="9 5"/><circle r="24" ${st} stroke-width="1"/>`)}</div>
  </div></div>`;
}
function smItemOf(s) {
  if (s && s._item) return s;
  const k = iconSlot(s);
  return {k: "s", r: clamp(num(s.rarity) || 0, 0, 5), name: s.name, sub: s.cls || "", art: k ? artSrc(artOf(s, k)) : "", logo: CLASS_LOGO[s.cls] || "", mark: CLASS_MARK[s.cls] || ""};
}
playSummon = function (who) {
  return new Promise((resolve) => {
    const ov = document.getElementById("summon"); if (!ov) { resolve(); return; }
    const it = smItemOf(who), r = it.r, tier = smTierOf(it.k, r), still = RM.matches || tier === "none";
    const K = tier === "rainbow" ? 1 : tier === "gold" ? 0.78 : 0.5;
    const hss = it.k === "c" ? "Craft Essence" : "Heroic Spirit Summoned";
    const letters = hss.split("").map((ch, i) => ch === " " ? `<span class="sp"> </span>` : `<span style="--i:${i}">${esc(ch)}</span>`).join("");
    const orbs = tier === "silver" ? "" : Array.from({length: 14}, (_, i) => `<i style="--x:${(Math.sin(i * 2.39) * 1).toFixed(2)};--y:${(Math.cos(i * 2.39) * 0.36).toFixed(2)};--dl:${(i * 0.07).toFixed(2)}s;--sz:${(5 + (i * 7) % 6)}px"></i>`).join("");
    const front = it.art ? `<img class="s2-art${it.k === "c" ? " ce" : ""}" src="${esc(it.art)}" alt="">` : it.mark ? `<img class="s2-art mark" src="${it.mark}" alt="">` : `<span class="s2-q">?</span>`;
    ov.innerHTML = `<div class="s2-bg" aria-hidden="true"></div>
      ${tier === "none" ? "" : smRingsHTML(tier)}
      ${tier === "gold" || tier === "rainbow" ? `<div class="s2-pillars" aria-hidden="true"><i class="p1"></i><i class="p2"></i><i class="p3"></i></div>` : ""}
      ${orbs ? `<div class="s2-orbs" aria-hidden="true">${orbs}</div>` : ""}
      <i class="s2-flash" aria-hidden="true"></i>
      <div class="sm-stage s2-stage">
        <div class="s2-wrap" aria-hidden="true">
          <div class="s2-card"><div class="s2-front">${front}<div class="s2-plate">${it.logo ? `<img src="${it.logo}" alt="">` : ""}<span>${"★".repeat(r)}</span></div></div>
            <div class="s2-cover"><i class="s2-band"></i><img src="${backOf(it.k, r)}" alt=""></div></div>
          ${r >= 3 ? `<i class="sm-halo"></i><i class="sm-edge"><b></b></i>` : ""}
        </div>
        <div class="sm-info" role="status" aria-live="polite"><p class="sm-hss"><span class="vh">${hss}</span><span class="sm-hss-l" aria-hidden="true">${letters}</span></p><h2>${esc(it.name)}</h2><p class="sm-sub">${esc(it.sub || "")}${r ? " · " + "★".repeat(r) : ""}</p><button type="button" class="btn sm sm-done">Done</button></div>
      </div>
      <button type="button" class="btn ghost sm sm-skip">Skip</button>`;
    ov.dataset.tier = tier === "rainbow" ? "gold5" : tier === "none" ? "bronze" : tier; ov.dataset.look = tier; ov.dataset.k = it.k;
    ov.dataset.speed = tier === "none" ? "none" : tier === "silver" ? "brisk" : tier === "gold" ? "gold" : "full";
    ov.style.setProperty("--k", K); ov.className = "summon s2"; ov.hidden = false;
    const shell = document.querySelector(".shell"); if (shell) shell.inert = true;
    const timers = []; let done = false, ended = false;
    const at = (ms, cls) => timers.push(setTimeout(() => ov.classList.add(...cls.split(" ")), Math.round(ms * K)));
    const reveal = () => { timers.forEach(clearTimeout); ov.classList.add("now", "go", "card", "unveil", "hss", "info", "end"); const b = ov.querySelector(".sm-done"); if (b) b.focus(); ended = true; };
    const close = () => {
      if (done) return; done = true; timers.forEach(clearTimeout); document.removeEventListener("keydown", onKey, true);
      if (shell) shell.inert = false;
      ov.classList.add("out"); setTimeout(() => { ov.hidden = true; ov.innerHTML = ""; ov.className = "summon"; delete ov.dataset.look; resolve(); }, 300);
    };
    const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); if (ended) close(); else reveal(); } };
    document.addEventListener("keydown", onKey, true);
    ov.querySelector(".sm-skip").addEventListener("click", () => { if (ended) close(); else reveal(); });
    ov.querySelector(".sm-done").addEventListener("click", close);
    ov.addEventListener("click", (e) => { if (ended && (e.target === ov || e.target.classList.contains("s2-bg"))) close(); });
    if (still) { reveal(); return; }
    ov.querySelector(".sm-skip").focus({preventScroll: true});
    requestAnimationFrame(() => ov.classList.add("go"));
    if (tier === "silver") { at(450, "card"); at(1000, "unveil"); at(1500, "hss"); at(1900, "info end"); timers.push(setTimeout(() => { ended = true; }, 1900 * K)); return; }
    at(700, "orbs"); at(1500, "pillars"); at(2350, "flash"); at(2500, "card"); at(3350, "unveil"); at(4450, "hss"); at(5300, "info end");
    timers.push(setTimeout(() => { ended = true; const b = ov.querySelector(".sm-done"); if (b) b.focus({preventScroll: true}); }, 5300 * K));
  });
};

/* ---------- the Summoning page: the best card of a pull gets the ceremony, then the cards are dealt ---------- */
// the best card: the rarest, and a servant over a Craft Essence of the same rarity (★5 servant, ★5 CE, ★4 servant, …)
const smRank = (x) => x.r * 2 + (x.k === "s" ? 1 : 0);
function smPullItem(x) {
  const r = x.r;
  if (x.k === "c") { const c = x.ce ? CE_BY_NO.get(x.ce) : null; return {_item: true, k: "c", r: r, name: c ? c.n : "★" + r + " Craft Essence", sub: "Craft Essence", art: c ? aimg(c.im) : "", logo: "", mark: ""}; }
  const s = x.id ? S.servants.find((v) => v.id === x.id) : null;
  if (s) return Object.assign(smItemOf(s), {_item: true, art: smArt(s, false) || smItemOf(s).art});
  const pc = x.pc ? ATLAS_BY_NO.get(x.pc) : null;
  if (pc) return {_item: true, k: "s", r: r, name: pc.n, sub: pc.c, art: aimg(pc.im[0] || pc.f), logo: CLASS_LOGO[pc.c] || "", mark: CLASS_MARK[pc.c] || ""};
  return {_item: true, k: "s", r: r, name: "A ★" + r + " servant", sub: "Not on your list", art: "", logo: "", mark: ""};
}
let smHold = false, smBusy = false;
const smAfter16 = smAfter;
smAfter = function () { if (!smHold) smAfter16(); };
async function smCeremony(run) {
  if (smBusy) return;
  smBusy = true; smHold = true;
  try { run(); } finally { smHold = false; }
  const L = SM.last || [], best = L.slice().sort((a, b) => smRank(b) - smRank(a))[0];
  smSave();
  try { if (best && SM.anim !== false && smTierOf(best.k, best.r) !== "none" && !RM.matches) await playSummon(smPullItem(best)); }
  finally { smBusy = false; smDealBatch = SM.batch; smDealT = performance.now(); smAfter16(); }
}
const smRoll16 = smRoll, smUntil16 = smUntil;
smRoll = function (n) { smCeremony(() => smRoll16(n)); };
smUntil = function () { smCeremony(() => smUntil16()); };
// a switch on the page for anyone who'd rather skip the ceremony
const smSetupHTML16 = smSetupHTML;
smSetupHTML = function () {
  return smSetupHTML16().replace(`<p class="sms-note">`, `<label class="sms-anim"><input type="checkbox" data-sm-anim${SM.anim !== false ? " checked" : ""}> Play the summoning animation for the best card</label><p class="sms-note">`);
};
document.addEventListener("change", (e) => {
  const t = e.target; if (!t || !t.dataset || t.dataset.smAnim == null) return;
  SM.anim = !!t.checked; smSave();
});

/* ---------- pressing things ---------- */
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest("[data-action]"); if (!b) return;
  const a = b.dataset.action;
  if (a === "layout") {
    pageLayout = pageLayout === "compact" ? "modern" : "compact"; lsSet(LAYOUT_KEY, pageLayout); applyLayout();
    renderDossier(true); toast(pageLayout === "compact" ? "Compact layout: picture on the left, the essentials beside it." : "Modern layout: everything in one column.");
    return;
  }
  if (a === "npup") { const s = S.servants.find((x) => x.id === shownId()); if (s) switchNp(s, Number(b.dataset.v)); return; }
  if (a === "pc-npup") {
    if (!pcOpen || pcOpen.no == null || pcOpen.ce || pcOpen.v15) return;
    const x = ATLAS_BY_NO.get(pcOpen.no); if (!x || !x.np) return;
    pcOpen.npv = Number(b.dataset.v);
    const sec = b.closest(".np-sec"); if (!sec) return;
    const t = document.createElement("div"); t.innerHTML = pcNpHTML(x); sec.replaceWith(t.firstElementChild);
    const nb = pcDlg.querySelector('[data-action="pc-npup"]'); if (nb) nb.focus({preventScroll: true});
  }
});


