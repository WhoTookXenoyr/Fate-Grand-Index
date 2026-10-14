/* ================= v9 ================= */

/* ---------- light / dark: a switch in the top right, remembered in this browser ---------- */
const THEME_KEY = "spirit-origin-list:v1:theme";
function syncThemeBtn() {
  const b = document.getElementById("theme-tgl"); if (!b) return;
  const d = isDark(), t = d ? "Switch to light mode" : "Switch to dark mode";
  b.setAttribute("aria-pressed", String(d)); b.setAttribute("aria-label", t); b.title = t;
}
function setTheme(t) {
  document.documentElement.setAttribute("data-theme", t);
  try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
  paintPage(); syncThemeBtn(); drawIdleWords();
}
function toggleTheme(btn) {
  const next = isDark() ? "light" : "dark", root = document.documentElement;
  if (!document.startViewTransition || RM.matches) { setTheme(next); return; }
  const r = btn.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
  const end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  root.classList.add("vt-theme");
  // if the browser is slow to take its snapshot, switch anyway rather than leave the click hanging
  let vt, done = false; const go = () => { if (!done) { done = true; setTheme(next); } };
  try { vt = document.startViewTransition(go); } catch (e) { root.classList.remove("vt-theme"); go(); return; }
  setTimeout(go, 450);
  vt.ready.then(() => root.animate({clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`]},
    {duration: 700, easing: "cubic-bezier(.45,0,.2,1)", pseudoElement: "::view-transition-new(root)"})).catch(() => {});
  vt.finished.finally(() => root.classList.remove("vt-theme"));
  // and if anything still holds it up, end it: the page never stays frozen behind a half-done transition
  setTimeout(() => { try { vt.skipTransition(); } catch (e) {} root.classList.remove("vt-theme"); }, 1600);
}
DARK_Q.addEventListener("change", syncThemeBtn);

/* ---------- the resting backdrop: a slow summoning circle, stars and drifting motes ---------- */
function idleBackdropHTML() {
  let seed = 20240711; const rr = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const f = (n) => Math.round(n * 10) / 10;
  const pt = (a, r) => [f(Math.sin(a) * r), f(-Math.cos(a) * r)];
  // rune-like marks: a few strokes in a small box, the same every visit
  const rune = () => {
    const segs = [], n = 2 + Math.floor(rr() * 3);
    segs.push(`M0 -9 L0 9`);
    for (let i = 0; i < n; i++) {
      const y = f(-8 + rr() * 16), side = rr() < 0.5 ? -1 : 1, kind = rr();
      if (kind < 0.45) segs.push(`M0 ${y} L${side * 6} ${f(y + (rr() < 0.5 ? -5 : 5))}`);
      else if (kind < 0.75) segs.push(`M${-5} ${y} L5 ${y}`);
      else segs.push(`M0 ${y} Q${side * 7} ${f(y + 3)} 0 ${f(y + 6)}`);
    }
    return segs.join(" ");
  };
  let ticks = "";
  for (let i = 0; i < 180; i++) { const a = i / 180 * 6.2832, [x1, y1] = pt(a, 478), [x2, y2] = pt(a, i % 15 === 0 ? 458 : i % 5 === 0 ? 466 : 472); ticks += `M${x1} ${y1}L${x2} ${y2}`; }
  let runes = "";
  // each rune is turned into place here, so the drawing holds no transforms of its own (the browser would redraw those on every step)
  const place = (d, deg) => { const a = deg * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a); return d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (m, x, y) => { const X = +x, Y = +y - 444; return f(X * c - Y * sn) + " " + f(X * sn + Y * c); }); };
  for (let i = 0; i < 64; i++) runes += " " + place(rune(), i * 360 / 64);
  runes = `<path d="${runes.trim()}"/>`;
  const poly = (n, step, r, rot) => { const p = []; for (let i = 0; i < n; i++) p.push(pt(rot + (i * step % n) / n * 6.2832, r).join(" ")); return `M${p.join(" L")}Z`; };
  const heptA = poly(7, 3, 336, 0), heptB = poly(7, 2, 336, 0), hexA = poly(3, 1, 250, 0), hexB = poly(3, 1, 250, Math.PI);
  const seven = ["Saber", "Archer", "Lancer", "Rider", "Caster", "Assassin", "Berserker"];
  const nodes = seven.map((c, i) => { const [x, y] = pt(i / 7 * 6.2832, 336); return `<circle cx="${x}" cy="${y}" r="30"/><circle cx="${x}" cy="${y}" r="24" class="thin"/>`; }).join("");
  const marks = seven.map((c, i) => { const [x, y] = pt(i / 7 * 6.2832, 33.6); return CLASS_MARK[c] ? `<i class="ib-mark" style="left:${50 + x}%;top:${50 + y}%;--m:url('${CLASS_MARK[c]}')"></i>` : ""; }).join("");
  const words = "SAINT GRAPH · SPIRIT ORIGIN · HEROIC SPIRIT · THRONE OF HEROES · CHALDEA · ";
  let spokes = ""; for (let i = 0; i < 24; i++) { const a = i / 24 * 6.2832, [x1, y1] = pt(a, 120), [x2, y2] = pt(a, i % 2 ? 176 : 196); spokes += `M${x1} ${y1}L${x2} ${y2}`; }
  let stars = ""; for (let i = 0; i < 46; i++) stars += `<i style="left:${f(rr() * 100)}%;top:${f(rr() * 100)}%;--d:${f(2 + rr() * 5)}s;--w:${f(-rr() * 6)}s;--s:${f(1 + rr() * 2.2)}px"></i>`;
  let motes = ""; for (let i = 0; i < 18; i++) motes += `<i style="left:${f(rr() * 100)}%;--d:${f(16 + rr() * 22)}s;--w:${f(-rr() * 30)}s;--x:${f(-30 + rr() * 60)}px;--s:${f(2 + rr() * 3)}px"></i>`;
  // each ring turns as a plain box holding a still drawing, which the GPU can spin without redrawing it
  const svg = (cls, body) => `<div class="ib-ring ${cls}"><svg viewBox="-500 -500 1000 1000" aria-hidden="true" focusable="false">${body}</svg></div>`;
  return `<div id="idle-bg" class="idle-bg" aria-hidden="true">
    <div class="ib-stars">${stars}<b class="ib-shoot s1"></b><b class="ib-shoot s2"></b></div>
    <div class="ib-circle">
      ${svg("r1", `<circle r="492" class="thin"/><circle r="480"/><path d="${ticks}" class="thin"/><g class="ib-runes">${runes}</g><circle r="430" class="gold"/>`)}
      <div class="ib-ring r2"><svg viewBox="-500 -500 1000 1000" aria-hidden="true" focusable="false"><circle r="418" class="thin"/><circle r="390" class="dash"/><circle r="372"/></svg><canvas class="ib-words-cv" data-words="${esc(words)}"></canvas></div>
      ${svg("r3", `<path d="${heptA}" class="gold"/><path d="${heptB}" class="thin"/>${nodes}<circle r="336" class="thin"/>`)}
      <div class="ib-marks">${marks}</div>
      ${svg("r4", `<circle r="262"/><path d="${hexA}"/><path d="${hexB}"/><circle r="214" class="dash"/><path d="${spokes}" class="thin"/><circle r="118" class="gold"/>`)}
      ${svg("r5", `<ellipse rx="170" ry="62" class="thin"/><circle cx="170" r="6" class="dot"/><ellipse rx="150" ry="60" transform="rotate(60)" class="thin"/><circle cx="150" r="4.5" class="dot" transform="rotate(60)"/><ellipse rx="150" ry="60" transform="rotate(120)" class="thin"/><circle cx="-150" r="5" class="dot" transform="rotate(120)"/>`)}
      <div class="ib-core"></div>
    </div>
    <div class="ib-motes">${motes}</div>
  </div>`;
}
// the words around the circle are drawn once onto a canvas: SVG text would be laid out again on every turn
function drawIdleWords() {
  const cv = document.querySelector(".ib-words-cv"); if (!cv) return;
  const w = cv.clientWidth; if (!w) { requestAnimationFrame(drawIdleWords); return; }
  const dpr = Math.min(2, window.devicePixelRatio || 1), k = w / 1000, cx = cv.getContext("2d");
  cv.width = Math.round(w * dpr); cv.height = Math.round(w * dpr);
  cx.setTransform(dpr * k, 0, 0, dpr * k, dpr * w / 2, dpr * w / 2); cx.clearRect(-500, -500, 1000, 1000);
  const ff = getComputedStyle(document.documentElement).getPropertyValue("--f-data").trim() || "monospace";
  cv.style.color = "var(--idle-ink)"; cx.fillStyle = getComputedStyle(cv).color; cx.font = "15px " + ff; cx.textAlign = "center"; cx.textBaseline = "middle";
  const text = (cv.dataset.words || "").repeat(4), R = 404, sp = 15 * 0.32;
  let a = -Math.PI / 2;
  for (const ch of text) {
    const step = (cx.measureText(ch).width + sp) / R;
    if (a + step > Math.PI * 1.5 - 0.01) break;
    cx.save(); cx.rotate(a + step / 2 + Math.PI / 2); cx.fillText(ch, 0, -R); cx.restore();
    a += step;
  }
}
let idleWT = 0;
window.addEventListener("resize", () => { clearTimeout(idleWT); idleWT = setTimeout(drawIdleWords, 200); });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => drawIdleWords());
DARK_Q.addEventListener("change", () => setTimeout(drawIdleWords, 50));
function setIdle(on) {
  let el = document.getElementById("idle-bg");
  if (!el) { const pb = document.querySelector(".page-bg"); if (!pb) return; pb.insertAdjacentHTML("afterend", idleBackdropHTML()); el = document.getElementById("idle-bg"); void el.offsetWidth; }
  el.classList.toggle("on", !!on);
  if (on && !el.dataset.words) { el.dataset.words = "1"; drawIdleWords(); }
}

/* ---------- the page only wears a servant's colours while you have that servant picked ---------- */
const pageActive = () => S.tab === "servants" && !!S.selected && S.editing !== "new";
// a readable accent from the stage art, one shade for light pages and one for dark
function setArtAccent(raw) {
  const r = document.documentElement.style;
  if (!raw) { r.removeProperty("--art-l"); r.removeProperty("--art-d"); return; }
  const hs = raw.map((h) => rgbToHsl(hexToRgb(h)));
  let k = 0; if (hs[0][1] < 0.2) hs.forEach((h, i) => { if (h[1] > hs[k][1]) k = i; });
  const h = hs[k][0], s0 = hs[k][1], s = s0 < 0.06 ? s0 : clamp(s0 * 1.2 + 0.1, 0.42, 0.85);
  r.setProperty("--art-l", toHex(hslToRgb(h, s, 0.34))); r.setProperty("--art-d", toHex(hslToRgb(h, s, 0.72)));
}
let themeKey9 = "";
applyTheme = async function (s) {
  const live = !!s && pageActive() && s.id === S.selected;
  const slot = s ? viewSlot(s) : null, id = s && slot ? artOf(s, slot) : null;
  const key = (s ? s.id + "|" + s.cls : "") + "|" + (id || "") + "|" + (live ? 1 : 0);
  if (key === themeKey9) return;
  themeKey9 = key;
  const raw = (id ? await extractPalette(artSrc(id)) : null) || DEFAULT_PAL;
  if (key !== themeKey9) return;
  const x = s ? (EXTRA_ACC[s.cls] || null) : null, pal = x ? raw.map(vividHex) : raw;
  const r = document.documentElement.style;
  r.setProperty("--p1", pal[0]); r.setProperty("--p2", pal[1]); r.setProperty("--p3", pal[2]);
  SCENE.pal = pal.map(hexToRgb);
  setArtAccent(s && id ? raw : null);
  const pp = live ? pal : DEFAULT_PAL, px = live ? x : null;
  curPal = pp; curExtra = px; PAGE.pal = pp.map(hexToRgb); paintPage();
  const a = document.querySelector(".aura");
  if (a) { a.classList.toggle("beast", live && s.cls === "Beast"); a.classList.toggle("foreigner", live && s.cls === "Foreigner"); a.classList.toggle("extra", !!px); }
  setEmblem(live ? s : null, px);
  setIdle(!live);
};
const fxAttach0 = fxAttach;
fxAttach = function (s, keepPage) {
  fxAttach0(s, keepPage);
  if (!s || !pageActive()) { PAGE.p = null; PAGE.key = ""; if (PAGE.cv && PAGE.cx) { PAGE.cx.setTransform(1, 0, 0, 1, 0, 0); PAGE.cx.clearRect(0, 0, PAGE.cv.width, PAGE.cv.height); } }
};
function syncPageTheme() {
  const s = S.servants.find((x) => x.id === shownId()) || null;
  if (s) fxAttach(s); else fxAttach(null, true);
  applyTheme(s);
}

// on a computer, letting go of a servant (Esc, or another tab) keeps them on show; only the page calms down
const shownId0 = shownId;
shownId = function () {
  if (S.selected) return S.selected;
  if (isWide() && S.editing !== "new" && S.lastSel && filtered().some((x) => x.id === S.lastSel)) return S.lastSel;
  return shownId0();
};

/* ---------- after the dossier draws: crossfade the stage art, play the Lv 10 celebration ---------- */
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest('[data-action="stage"], [data-action="art-next"]');
  if (!b) return;
  const img = document.querySelector("#dossier .art-frame img[data-art]");
  S.artFade = img ? img.currentSrc || img.src : null;
}, true);
function afterDossier() {
  if (S.artFade) {
    const from = S.artFade; S.artFade = null;
    const fr = document.querySelector("#dossier .art-frame"), img = fr && fr.querySelector("img[data-art]");
    if (img && from && img.src !== from && !RM.matches) {
      const g = new Image(); g.className = "art-ghost"; g.alt = ""; g.src = from; g.setAttribute("aria-hidden", "true");
      fr.appendChild(g); img.classList.add("art-in");
      g.addEventListener("animationend", () => g.remove(), {once: true}); setTimeout(() => g.remove(), 1400);
    }
  }
  if (S.skCeleb && Date.now() > S.skCeleb.until) S.skCeleb = null;
}
const renderDossier0 = renderDossier;
renderDossier = function (force) {
  if (S.selected) S.lastSel = S.selected;
  const r = renderDossier0(force);
  if (!S.servants.some((x) => x.id === shownId())) applyTheme(null);
  afterDossier();
  return r;
};
const celebrating = (s, i) => !!(S.skCeleb && S.skCeleb.id === s.id && S.skCeleb.i === i && Date.now() < S.skCeleb.until);
function skBurstHTML() {
  let h = ""; for (let i = 0; i < 18; i++) h += `<b style="--a:${i * 20 + (i % 3) * 7}deg;--d:${48 + (i * 37) % 40}px;--w:${(i % 5) * 0.03}s"></b>`;
  return `<i class="sk-burst" aria-hidden="true">${h}</i><i class="sk-stamp" aria-hidden="true">MAX</i>`;
}
const skMotes = `<i class="sk-fx" aria-hidden="true"><b class="sk-wash"></b><b class="sk-sweep"></b><i class="sk-motes"><b></b><b></b><b></b><b></b><b></b></i></i>`;
const skTierOf = (s, i) => { const k = (s.skillInfo || [])[i] || {}; return rankTier(skNameRank(k.name, k.rank).rank); };

/* ---------- Fou: silver up to 1,000, gold up to 2,000, rainbow beyond ---------- */
function fouTier(f) { const n = num(f) || 0; return n <= 0 ? "" : n <= 1000 ? " fou-s" : n <= 2000 ? " fou-g" : " fou-r"; }
const FOU_NAME = {" fou-s": "★3 Fou (silver)", " fou-g": "★4 Fou (gold)", " fou-r": "★5 Fou (rainbow)"};

/* ---------- grails: gold from Lv 100, gold and rainbow from Lv 102 ---------- */
function grTier(s) {
  const lv = num(s.level); if (lv == null) return "";
  const st = levelStatus(s);
  return lv >= 102 ? " gr102" : (lv >= 100 || (st && st.kind === "grail")) ? " gr100" : "";
}
const grFX = `<i class="gr-ring" aria-hidden="true"><b></b></i><i class="gr-sweep" aria-hidden="true"><b></b></i>`;

/* ---------- Noble Phantasm atmosphere by card ---------- */
function npAtmoHTML(card) {
  const k = String(card || "").toLowerCase(); if (!["buster", "arts", "quick"].includes(k)) return "";
  let p = "";
  const n = k === "buster" ? 16 : k === "arts" ? 6 : 10;
  for (let i = 0; i < n; i++) p += `<i style="--i:${i};--x:${(i * 61 + 7) % 100}%;--y:${(i * 37 + 11) % 100}%;--w:${((i * 0.73) % 4).toFixed(2)}s"></i>`;
  return `<div class="npt-atmo" data-k="${k}" aria-hidden="true">${p}</div>`;
}

/* ---------- command cards you can tilt like a trading card ---------- */
let tiltEl = null;
function untilt(c) { if (!c) return; c.classList.remove("tilt"); ["--rx", "--ry", "--mx", "--my", "--sx", "--sy"].forEach((k) => c.style.removeProperty(k)); }
document.addEventListener("pointermove", (e) => {
  if (e.pointerType === "touch" || RM.matches) return;
  const c = e.target.closest ? e.target.closest(".deck .cmd:not(.empty)") : null;
  if (tiltEl && tiltEl !== c) untilt(tiltEl);
  tiltEl = c; if (!c) return;
  const r = c.getBoundingClientRect(), px = clamp((e.clientX - r.left) / r.width, 0, 1), py = clamp((e.clientY - r.top) / r.height, 0, 1);
  c.style.setProperty("--rx", ((0.5 - py) * 24).toFixed(2) + "deg"); c.style.setProperty("--ry", ((px - 0.5) * 28).toFixed(2) + "deg");
  c.style.setProperty("--mx", (px * 100).toFixed(1) + "%"); c.style.setProperty("--my", (py * 100).toFixed(1) + "%");
  c.style.setProperty("--sx", ((0.5 - px) * 14).toFixed(1) + "px"); c.style.setProperty("--sy", (8 + (0.5 - py) * 10).toFixed(1) + "px");
  c.classList.add("tilt");
}, {passive: true});
document.addEventListener("mouseout", (e) => { if (!e.relatedTarget) { untilt(tiltEl); tiltEl = null; } });
window.addEventListener("blur", () => { untilt(tiltEl); tiltEl = null; });
function cardMasks() {
  if (document.getElementById("cmd-masks")) return;
  const st = document.createElement("style"); st.id = "cmd-masks";
  st.textContent = CARDS.filter((c) => CARD_IMG[c]).map((c) => `.cmd.${cardCls(c)}.has-img .cmd-glare{-webkit-mask-image:url("${CARD_IMG[c]}");mask-image:url("${CARD_IMG[c]}")}`).join("\n");
  document.head.appendChild(st);
}

/* ---------- toast with a button ---------- */
function toastAction(msg, label, fn) {
  const t = $("#toast"); t.textContent = msg + " ";
  const b = document.createElement("button"); b.type = "button"; b.className = "toast-btn"; b.textContent = label;
  b.addEventListener("click", () => { t.classList.remove("show"); fn(); }, {once: true});
  t.appendChild(b); t.classList.add("show", "has-btn");
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show", "has-btn"), 9000);
}

/* ---------- summoning a Guest: the blue card back opens onto their art, and they start from Lv 1 ---------- */
const CARD_BACK = "__CARD_BACK__";
playSummon = function (s) {
  return new Promise((resolve) => {
    const ov = document.getElementById("summon"); if (!ov) { resolve(); return; }
    const r = clamp(num(s.rarity) || 0, 0, 5), tier = summonTier(r), k = iconSlot(s), art = k ? artSrc(artOf(s, k)) : "", logo = CLASS_LOGO[s.cls] || "";
    // the rarer the servant, the longer the ceremony: ★1–2 are quick, ★3 a little slower, ★4 and ★5 get the whole show
    const sp = r <= 2 ? 2.6 : r === 3 ? 1.55 : 1, T = (ms) => Math.round(ms / sp);
    const hss = "Heroic Spirit Summoned", letters = hss.split("").map((ch, i) => ch === " " ? `<span class="sp"> </span>` : `<span style="--i:${i}">${esc(ch)}</span>`).join("");
    ov.innerHTML = `<canvas class="sm-cv" aria-hidden="true"></canvas>
      <div class="sm-stage">
        <div class="sm-card" aria-hidden="true"><div class="sm-in">
          <div class="sm-art-layer">${art ? `<img class="sm-art" src="${esc(art)}" alt="">` : (CLASS_MARK[s.cls] ? `<img class="sm-art mark" src="${CLASS_MARK[s.cls]}" alt="">` : "")}
            <div class="sm-plate">${logo ? `<img src="${logo}" alt="">` : ""}<span class="sm-stars">${"★".repeat(r)}</span></div></div>
          <div class="sm-spin"><div class="sm-face sm-back"><img src="${CARD_BACK}" alt=""></div><div class="sm-face sm-back sm-back2"><img src="${CARD_BACK}" alt=""></div></div>
          <i class="sm-bloom"></i><i class="sm-ring"></i>
        </div>${r >= 3 ? `<i class="sm-halo"></i><i class="sm-edge"><b></b></i>` : ""}</div>
        <div class="sm-info" role="status" aria-live="polite"><p class="sm-hss"><span class="vh">${hss}</span><span class="sm-hss-l" aria-hidden="true">${letters}</span></p><h2>${esc(s.name)}</h2><p class="sm-sub">${esc(s.cls || "")}${r ? " · " + "★".repeat(r) : ""}</p><button type="button" class="btn primary sm-done">Continue</button></div>
      </div>
      <button type="button" class="btn ghost sm sm-skip">Skip</button>`;
    ov.dataset.tier = tier; ov.dataset.speed = r <= 2 ? "quick" : r === 3 ? "brisk" : "full"; ov.style.setProperty("--smk", (1 / sp).toFixed(3)); ov.className = "summon"; ov.hidden = false;
    const shell = document.querySelector(".shell"); if (shell) shell.inert = true;
    const cv = ov.querySelector(".sm-cv"), cx = cv.getContext("2d"), col = SUMMON_COL[tier], t0 = performance.now(), parts = [];
    let raf = 0, done = false, ended = false; const timers = [], still = RM.matches;
    const at = (ms, fn) => timers.push(setTimeout(fn, ms));
    const size = () => { const d = Math.min(2, window.devicePixelRatio || 1); cv.width = innerWidth * d; cv.height = innerHeight * d; cx.setTransform(d, 0, 0, d, 0, 0); };
    size(); window.addEventListener("resize", size);
    for (let i = 0; i < 140; i++) parts.push({a: rnd(0, 6.283), d: rnd(0.4, 1.4), s: rnd(0.4, 1), r: rnd(0.8, 2.4), ph: rnd(0, 6.3)});
    const sparks = [];
    const frame = (now) => {
      const t = (now - t0) / 1000 * sp, w = innerWidth, h = innerHeight, cxp = w / 2, cy = h * 0.66, R = Math.min(w, h) * 0.36, sq = 0.34;
      cx.clearRect(0, 0, w, h);
      const bg = cx.createRadialGradient(cxp, cy, 0, cxp, cy, Math.max(w, h)); bg.addColorStop(0, "rgba(14,26,58,0.96)"); bg.addColorStop(1, "rgba(2,4,12,0.98)"); cx.fillStyle = bg; cx.fillRect(0, 0, w, h);
      const spin = t < 1.2 ? t * 0.5 : 0.6 + (t - 1.2) * (t < 2.5 ? 2.4 : 0.8);
      const draw = Math.min(1, t / 1.0), glow = t < 2.4 ? 1 : Math.max(0.35, 1 - (t - 2.4) * 0.4);
      const CY = [140, 220, 255];
      cx.save(); cx.translate(cxp, cy); cx.scale(1, sq); cx.shadowBlur = 18; cx.shadowColor = rgba(CY, 0.9);
      cx.strokeStyle = rgba(CY, 0.85 * glow); cx.lineWidth = 3;
      cx.beginPath(); cx.arc(0, 0, R, spin, spin + draw * 6.283); cx.stroke();
      cx.lineWidth = 1.6; cx.beginPath(); cx.arc(0, 0, R * 0.88, -spin, -spin + draw * 6.283); cx.stroke();
      cx.beginPath(); cx.arc(0, 0, R * 0.52, spin * 1.5, spin * 1.5 + draw * 6.283); cx.stroke();
      if (draw > 0.3) {
        cx.rotate(spin); cx.globalAlpha = Math.min(1, (draw - 0.3) / 0.5) * glow;
        for (let i = 0; i < 48; i++) { const a = i / 48 * 6.283; cx.beginPath(); cx.moveTo(Math.cos(a) * R * 0.89, Math.sin(a) * R * 0.89); cx.lineTo(Math.cos(a) * R * (i % 4 ? 0.95 : 0.99), Math.sin(a) * R * (i % 4 ? 0.95 : 0.99)); cx.stroke(); }
        for (let tri = 0; tri < 2; tri++) { cx.beginPath(); for (let i = 0; i < 3; i++) { const a = tri * Math.PI / 3 + i * 2.094 - Math.PI / 2; cx.lineTo(Math.cos(a) * R * 0.86, Math.sin(a) * R * 0.86); } cx.closePath(); cx.stroke(); }
        cx.globalAlpha = 1;
      }
      cx.restore();
      if (t > 0.6 && t < 2.6) for (const q of parts) {
        const f = Math.min(1, Math.max(0, (t - 0.6) / 1.9)), d = q.d * (1 - f * q.s), a = q.a + t * 1.6 * q.s;
        const x = cxp + Math.cos(a) * d * R, y = cy - (1 - d) * R * 0.5 + Math.sin(a) * d * R * sq;
        cx.fillStyle = rgba(t > 1.4 ? col : CY, 0.5 + 0.4 * Math.sin(t * 6 + q.ph)); cx.beginPath(); cx.arc(x, y, q.r, 0, 6.283); cx.fill();
      }
      if (t > 1.1 && t < 2.65) {
        const p = (t - 1.1) / 1.55;
        for (let i = 0; i < 3; i++) {
          const rr = R * (1.05 - 0.28 * i) * (1 - 0.85 * p), yy = cy - R * (0.15 + 0.55 * p) - i * R * 0.1 * (1 - p), tilt = Math.sin(t * 3 + i * 2.1) * 0.35;
          cx.save(); cx.translate(cxp, yy); cx.rotate(tilt); cx.scale(1, 0.3); cx.shadowBlur = 24; cx.shadowColor = rgba(col, 1);
          cx.strokeStyle = rgba(i === 1 ? [255, 255, 255] : col, 0.9); cx.lineWidth = 4 - i; cx.beginPath(); cx.arc(0, 0, Math.max(2, rr), 0, 6.283); cx.stroke(); cx.restore();
        }
      }
      if (t > 2.4) {
        const p = Math.min(1, (t - 2.4) / 0.35), fade = t < 3.4 ? 1 : Math.max(0.3, 1 - (t - 3.4) * 0.5), pw = R * (0.25 + 0.4 * p);
        const pc = tier === "gold5" ? hslToRgb(((t * 0.3) % 1), 0.85, 0.72) : col;
        const g = cx.createLinearGradient(cxp - pw, 0, cxp + pw, 0); g.addColorStop(0, rgba(pc, 0)); g.addColorStop(0.5, rgba(pc, 0.75 * fade)); g.addColorStop(1, rgba(pc, 0));
        cx.fillStyle = g; cx.fillRect(cxp - pw, 0, pw * 2, cy + R * sq);
        const g2 = cx.createLinearGradient(cxp - pw * 0.25, 0, cxp + pw * 0.25, 0); g2.addColorStop(0, "rgba(255,255,255,0)"); g2.addColorStop(0.5, "rgba(255,255,255," + (0.9 * fade).toFixed(3) + ")"); g2.addColorStop(1, "rgba(255,255,255,0)");
        cx.fillStyle = g2; cx.fillRect(cxp - pw * 0.25, 0, pw * 0.5, cy + R * sq);
        if (sparks.length < 160 && t < 3.2) for (let i = 0; i < 6; i++) sparks.push({x: cxp + rnd(-pw, pw) * 0.5, y: cy - rnd(0, R), vx: rnd(-160, 160), vy: rnd(-260, -40), life: 1, c: tier === "gold5" ? hslToRgb(Math.random(), 0.9, 0.7) : col});
      }
      // the card opening: gold motes lift off its edge
      if (t > 4.3 && t < 7.4 && sparks.length < 320) for (let i = 0; i < 3; i++) { const a = rnd(0, 6.283); sparks.push({x: cxp + Math.cos(a) * rnd(40, 120), y: h * 0.43 + Math.sin(a) * rnd(60, 160), vx: rnd(-40, 40), vy: rnd(-120, -30), life: 1, c: tier === "gold5" ? hslToRgb(Math.random(), 0.9, 0.72) : [255, 220, 140]}); }
      for (const q of sparks) { q.x += q.vx * 0.016; q.y += q.vy * 0.016; q.vy += 240 * 0.016; q.life -= 0.012; if (q.life > 0) { cx.fillStyle = rgba(q.c, q.life); cx.beginPath(); cx.arc(q.x, q.y, 2.2 * q.life + 0.5, 0, 6.283); cx.fill(); } }
      if (t > 2.3 && t < 3.0) { const f = 1 - Math.abs(t - 2.5) / 0.5; cx.fillStyle = "rgba(255,255,255," + Math.max(0, f * 0.85).toFixed(3) + ")"; cx.fillRect(0, 0, w, h); }
      if (!done && !still) raf = requestAnimationFrame(frame);
    };
    const reveal = () => { if (!ov.classList.contains("open")) ov.classList.add("now"); ov.classList.add("card", "open", "hss", "info"); const b = ov.querySelector(".sm-done"); if (b) b.focus(); ended = true; };
    const close = () => {
      if (done) return; done = true; cancelAnimationFrame(raf); timers.forEach(clearTimeout); window.removeEventListener("resize", size); document.removeEventListener("keydown", onKey, true);
      if (shell) shell.inert = false;
      ov.classList.add("out"); setTimeout(() => { ov.hidden = true; ov.innerHTML = ""; ov.className = "summon"; resolve(); }, 320);
    };
    const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); if (ended) close(); else reveal(); } };
    document.addEventListener("keydown", onKey, true);
    ov.querySelector(".sm-skip").addEventListener("click", () => { if (ended) close(); else reveal(); });
    ov.querySelector(".sm-done").addEventListener("click", close);
    ov.addEventListener("click", (e) => { if (ended && e.target === ov.querySelector(".sm-cv")) close(); });
    if (RM.matches) { reveal(); frame(t0 + 3600 / sp); return; }
    raf = requestAnimationFrame(frame);
    ov.querySelector(".sm-skip").focus();
    at(T(2600), () => ov.classList.add("card"));
    at(T(3750), () => ov.classList.add("charge"));
    at(T(4350), () => ov.classList.add("open"));
    at(T(5400), () => ov.classList.add("hss"));
    at(T(7700), reveal);
  });
};
const STAT_KEYS = ["level", "npLevel", "skills", "hp", "atk", "fouHp", "fouAtk", "artStage"];
summonServant = async function (id) {
  const s = S.servants.find((x) => x.id === id); if (!s || !s.wish || S.readOnly) return;
  await playSummon(s);
  const cur = S.servants.find((x) => x.id === id) || s;
  if (S.editing) dropFormArt();
  const before = {}; STAT_KEYS.forEach((k) => { before[k] = cur[k] === undefined ? undefined : JSON.parse(JSON.stringify(cur[k])); });
  const filled = ["level", "npLevel", "hp", "atk", "fouHp", "fouAtk"].some((k) => (num(cur[k]) || 0) > 1) || (Array.isArray(cur.skills) && cur.skills.some((v) => typeof v === "number" && v > 1));
  if (filled) cur.goal = {level: num(cur.level), skills: Array.isArray(cur.skills) ? cur.skills.slice() : null, hp: num(cur.hp), atk: num(cur.atk), fouHp: num(cur.fouHp), fouAtk: num(cur.fouAtk)};
  // a fresh summon: Lv 1, NP1, skill 1 at Lv 1 and the other two still locked, no Fou, first stage
  cur.level = 1; cur.npLevel = 1; cur.skills = [1, "Locked", "Locked"]; cur.fouHp = 0; cur.fouAtk = 0; cur.hp = null; cur.atk = null;
  if (artOf(cur, "1")) cur.artStage = "1";
  delete cur.wish; S.tab = "servants"; S.selected = id; S.editing = null; S.justSummoned = id;
  await writeDoc("servants", cur); renderAll(); window.scrollTo({top: 0});
  if (filled) toastAction(cur.name + " joined your roster at Lv 1. Their Guests stats are kept as a goal.", "Keep the old stats", async () => {
    STAT_KEYS.forEach((k) => { if (before[k] === undefined) delete cur[k]; else cur[k] = before[k]; }); delete cur.goal;
    await writeDoc("servants", cur); renderAll(); toast("Stats put back.");
  });
  else toast(cur.name + " joined your roster!");
  setTimeout(() => { if (S.justSummoned === id) { S.justSummoned = null; } }, 3200);
};
function goalHTML(s) {
  const g = s.goal; if (!g || s.wish) return "";
  const bits = [g.level ? "Lv " + g.level : "", g.hp ? "HP " + fmt(g.hp + (num(g.fouHp) || 0)) : "", g.atk ? "ATK " + fmt(g.atk + (num(g.fouAtk) || 0)) : "", Array.isArray(g.skills) ? "skills " + g.skills.map((v) => typeof v === "number" ? v : "–").join("/") : ""].filter(Boolean);
  if (!bits.length) return "";
  return `<p class="goal-line"><span class="lbl">Goal</span> ${esc(bits.join(" · "))}${S.readOnly ? "" : ` <button type="button" class="btn ghost sm" data-action="goal-clear">Clear goal</button>`}</p>`;
}

/* ---------- Guests: the old Guests tab's entries move into the Guests list (nothing is deleted) ---------- */
let guestsMoved = false;
function moveGuests() {
  if (guestsMoved || S.readOnly || !S.loaded.servants || !S.loaded.guests) return;
  guestsMoved = true;
  (S.guests || []).forEach((g) => {
    if (!g || !g.name || g.movedTo) return;
    const nm = normName(g.name);
    let s = S.servants.find((x) => normName(x.name) === nm);
    const mates = [g.pairedWith ? "Best with " + g.pairedWith : "", g.alsoGood ? "also good with " + g.alsoGood : ""].filter(Boolean).join("; ");
    if (!s) {
      s = {id: slug(g.name, S.servants), order: nextOrder(S.servants), name: g.name, cls: g.cls || null, wish: true};
      if (mates) s.mates = mates; if (g.why) s.notes = g.why;
      S.servants.push(s); writeDoc("servants", s);
    } else {
      let ch = false;
      if (!s.mates && mates) { s.mates = mates; ch = true; }
      if (!s.notes && g.why) { s.notes = g.why; ch = true; }
      if (ch) scheduleWrite("servants", s);
    }
    g.movedTo = s.id; scheduleWrite("guests", g);
  });
}
function guestSelectHTML(p) {
  const g = wished().map((s) => s.name), o = owned().map((s) => s.name), cur = p.guest || "";
  const extra = cur && !g.includes(cur) && !o.includes(cur) ? [cur] : [];
  const op = (n) => `<option${n === cur ? " selected" : ""}>${esc(n)}</option>`;
  const grp = (label, arr) => arr.length ? `<optgroup label="${label}">${arr.map(op).join("")}</optgroup>` : "";
  return `<select id="pt-guest"><option value="">None</option>${grp("Guests", g.concat(extra))}${grp("A friend's copy of your servant", o)}</select>`;
}
