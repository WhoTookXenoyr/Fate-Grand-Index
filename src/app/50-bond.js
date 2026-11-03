/* ================= 0.50.0: Bond 10 and Bond 15 =================
   For a servant at Bond 10 or more, while their page is open:
   - the website's background gets a layer of slowly rising bond crystals and two soft bands of light (#bond-bg). It
     sits over the background and under the page, faint enough not to cover the servant's own colours;
   - their page itself (the SERVANTPAGE's white in light mode, its black in dark mode) takes a faint moving rainbow,
     with the Bond 10 crystal drawn large behind it (.bd-veil). At Bond 15 the rainbow is stronger and easy to see.
   At Bond 15, opening their page with a click plays a short intro: the crystal comes together from its nine gems, a ring
   of light opens, and the page rises in. Nothing waits for it; clicks go straight through.
   Everything moves with transform and opacity only, follows the frame-rate setting, and stands still for reduced motion.
   The veil is put back after every redraw of the page; its animations pick up where they were (their delay follows the
   clock), so a + or − doesn't restart them. */
const bdTier = (s) => { const b = num(s && s.bond) || 0; return b >= 15 ? 15 : b >= 10 ? 10 : 0; };

/* ---------- the Bond 10 crystal: nine gems in a diamond, drawn after the game's ---------- */
// [x, y, half-width, top colour, bottom colour], in a 100 × 104 box
const BD_GEMS = [
  [50, 19, 16, "#fff6b8", "#e8c63c"],     // top, yellow
  [33.5, 35.5, 11, "#fffbe6", "#e6dfa0"], // the small ones above, pale yellow
  [66.5, 35.5, 11, "#fffbe6", "#e6dfa0"],
  [18, 52, 15, "#c9f8ff", "#1797c4"],     // left and right, cyan
  [82, 52, 15, "#c9f8ff", "#1797c4"],
  [50, 52, 16, "#e9ffa8", "#1aa59a"],     // the middle, green to teal
  [33.5, 68.5, 11, "#cbe9ff", "#3a86dc"], // the small ones below, blue
  [66.5, 68.5, 11, "#cbe9ff", "#3a86dc"],
  [50, 85, 16, "#f8eeff", "#9d82e8"]      // bottom, violet to white
];
let bdUid = 0;
// one gem: a diamond with soft corners, its gradient, a light top-left facet and a pale edge
function bdGem(g, id, alone) {
  // (alone: centred in a box of its own, with room for its edge)
  const r = g[2], x = alone ? r + 1.5 : g[0], y = alone ? r + 1.5 : g[1], c1 = g[3], c2 = g[4], k = r * 0.16;
  const d = `M${x} ${y - r + k}Q${x} ${y - r} ${x + k} ${y - r + k}L${x + r - k} ${y - k}Q${x + r} ${y} ${x + r - k} ${y + k}L${x + k} ${y + r - k}Q${x} ${y + r} ${x - k} ${y + r - k}L${x - r + k} ${y + k}Q${x - r} ${y} ${x - r + k} ${y - k}Z`;
  const f = `M${x} ${y - r * 0.72}L${x + r * 0.34} ${y - r * 0.38}L${x} ${y - r * 0.04}L${x - r * 0.34} ${y - r * 0.38}Z`;
  return `<linearGradient id="${id}" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>`
    + `<path d="${d}" fill="url(#${id})" stroke="rgba(255,255,255,.85)" stroke-width="${(r * 0.09).toFixed(2)}"/>`
    + `<path d="${f}" fill="rgba(255,255,255,.55)"/><ellipse cx="${x - r * 0.28}" cy="${y - r * 0.1}" rx="${r * 0.12}" ry="${r * 0.06}" fill="rgba(255,255,255,.7)"/>`;
}
function bdCrystalSVG(cls) {
  const u = "bdg" + (++bdUid);
  return `<svg class="${cls}" viewBox="0 0 100 104" aria-hidden="true" focusable="false">${BD_GEMS.map((g, i) => bdGem(g, u + "-" + i)).join("")}</svg>`;
}
// one gem on its own (the intro moves each one), in a box its own size
function bdGemSVG(g, i) {
  const u = "bdi" + (++bdUid) + "-" + i, w = (g[2] + 1.5) * 2;
  return `<svg viewBox="0 0 ${w} ${w}" aria-hidden="true" focusable="false">${bdGem(g, u, true)}</svg>`;
}

/* ---------- the SERVANTPAGE's veil ---------- */
// (delays that follow the clock, so a redrawn page keeps the same moment of every animation)
const bdPhase = () => (-(Date.now() % 60000) / 1000).toFixed(2) + "s";
function bdVeilHTML() {
  return `<div class="bd-veil" aria-hidden="true" style="--bd-t:${bdPhase()}"><div class="bd-in"><i class="bd-rb"></i><i class="bd-rb b2"></i><div class="bd-cr">${bdCrystalSVG("bd-crs")}</div><i class="bd-glint"></i></div></div>`;
}
// the veil is as tall as the page's window and starts at its very top, padding included
function bdMeasure(d) {
  if (!d) return;
  const cs = getComputedStyle(d), st = d.style;
  st.setProperty("--bd-vh", d.clientHeight + "px");
  st.setProperty("--bd-pt", cs.paddingTop); st.setProperty("--bd-pl", cs.paddingLeft); st.setProperty("--bd-pr", cs.paddingRight);
  st.setProperty("--bd-gap", cs.rowGap && cs.rowGap !== "normal" ? cs.rowGap : "0px");
}
let bdRO = null;
function bdWatch(d) {
  if (bdRO || typeof ResizeObserver === "undefined") return;
  bdRO = new ResizeObserver(() => { if (d.classList.contains("bd10") || d.classList.contains("bd15")) bdMeasure(d); });
  bdRO.observe(d);
}

/* ---------- the website's background ---------- */
function bdBgHTML() {
  let seed = 1015; const rr = () => (seed = (seed * 16807) % 2147483647) / 2147483647, f = (n) => Math.round(n * 10) / 10;
  const cols = BD_GEMS.map((g) => [g[3], g[4]]);
  let gems = "";
  for (let i = 0; i < 26; i++) {
    const c = cols[i % cols.length], big = i % 9 === 0;
    gems += `<i class="bdb-g${i >= 16 ? " more" : ""}" style="left:${f(rr() * 100)}%;--s:${f(big ? 14 + rr() * 6 : 5 + rr() * 8)}px;--d:${f(18 + rr() * 22)}s;--w:${f(-rr() * 40)}s;--x:${f(-60 + rr() * 120)}px;--r:${f(-40 + rr() * 80)}deg;--c1:${c[0]};--c2:${c[1]}"></i>`;
  }
  return `<div id="bond-bg" class="bond-bg" aria-hidden="true"><i class="bdb-band b1"></i><i class="bdb-band b2"></i><i class="bdb-band b3"></i>${gems}</div>`;
}
function bdBg(t) {
  let el = document.getElementById("bond-bg");
  if (!t) { if (el) el.classList.remove("on", "t10", "t15"); return; }
  if (!el) { const sh = document.querySelector(".shell"); if (!sh) return; sh.insertAdjacentHTML("beforebegin", bdBgHTML()); el = document.getElementById("bond-bg"); void el.offsetWidth; }
  el.classList.add("on"); el.classList.toggle("t10", t === 10); el.classList.toggle("t15", t === 15);
}

/* ---------- Bond 15: the intro when their page is opened ---------- */
let bdClick = null, bdIntroEl = null, bdIntroT = 0;
const BD_RM = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : {matches: false};
function bdIntro(d, s) {
  if (BD_RM.matches) return;
  if (bdIntroEl) bdIntroEl.remove(); clearTimeout(bdIntroT);
  const r = d.getBoundingClientRect(); if (r.width < 40 || r.height < 40) return;
  // the crystal gathers where the page's top half is
  const size = Math.round(clamp(Math.min(r.width, r.height) * 0.34, 120, 230));
  const gems = BD_GEMS.map((g, i) => {
    const w = (g[2] + 1.5) * 2, ang = Math.atan2(g[1] - 52, g[0] - 50) || (i * 0.7), dist = 70 + (i % 3) * 18;
    return `<i class="bdi-g" style="left:${(g[0] - w / 2)}%;top:${((g[1] - w / 2) / 104 * 100).toFixed(2)}%;width:${w}%;height:${(w / 104 * 100).toFixed(2)}%;--dx:${(Math.cos(ang) * dist).toFixed(1)}px;--dy:${(Math.sin(ang) * dist).toFixed(1)}px;--rot:${(i % 2 ? 1 : -1) * (30 + i * 6)}deg;--i:${i}">${bdGemSVG(g, i)}</i>`;
  }).join("");
  const el = document.createElement("div");
  el.className = "bd-intro"; el.setAttribute("aria-hidden", "true");
  el.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;--cs:${size}px`;
  el.innerHTML = `<i class="bdi-wash"></i><i class="bdi-glow"></i><i class="bdi-ring"></i><i class="bdi-ring r2"></i><div class="bdi-cr">${gems}</div><b class="bdi-t">Bond 15</b>`;
  document.body.appendChild(el); bdIntroEl = el;
  d.classList.remove("bd-enter"); void d.offsetWidth; d.classList.add("bd-enter");
  bdIntroT = setTimeout(() => { el.remove(); if (bdIntroEl === el) bdIntroEl = null; d.classList.remove("bd-enter"); }, 1900);
}
// a click that opens a servant (their row, or a link to them elsewhere)
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest('[data-action="select"][data-id]');
  bdClick = b ? b.dataset.id : bdClick;
}, true);

/* ---------- every redraw of the page ---------- */
function bdPaint() {
  const d = document.getElementById("dossier"); if (!d) return;
  const s = S.editing ? null : S.servants.find((x) => x.id === shownId());
  const t = s && d.childElementCount ? bdTier(s) : 0;
  d.classList.toggle("bd10", t === 10); d.classList.toggle("bd15", t === 15);
  const v = d.querySelector(":scope > .bd-veil");
  if (!t) { if (v) v.remove(); }
  else { if (!v) d.insertAdjacentHTML("afterbegin", bdVeilHTML()); bdMeasure(d); bdWatch(d); }
  bdBg(t && pageActive() ? t : 0);
  if (s && bdClick === s.id) { bdClick = null; if (t === 15) bdIntro(d, s); }
}
const renderDossier50 = renderDossier;
renderDossier = function () { const r = renderDossier50.apply(this, arguments); try { bdPaint(); } catch (e) {} return r; };
// leaving the Servants page, the background layer goes too
const renderAll50 = renderAll;
renderAll = function () { const r = renderAll50.apply(this, arguments); try { bdPaint(); } catch (e) {} return r; };
window.addEventListener("hashchange", () => setTimeout(() => { try { bdPaint(); } catch (e) {} }, 0));
