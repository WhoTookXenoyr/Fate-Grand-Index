/* ================= v11: motion ================= */

/* ---------- frame rate: 60, 30 or 15 frames a second for every looping animation ---------- */
const FPS_KEY = "spirit-origin-list:v1:fps";
let motionFps = (() => { try { const v = Number(localStorage.getItem(FPS_KEY)); return [15, 30, 60].includes(v) ? v : 60; } catch (e) { return 60; } })();
const heldAnims = new WeakSet(), offPaused = new WeakSet();
let limRaf = 0, limLast = 0;
// the light/dark switch's view transition must always run through: held, it would never finish and the page would stop taking clicks
const isVT = (a) => { const pe = a.effect && a.effect.pseudoElement; return !!(pe && pe.indexOf("view-transition") >= 0); };
const isCssAnim = (a) => typeof CSSAnimation !== "undefined" && a instanceof CSSAnimation && !isVT(a);
const animOff = (a) => { const t = a.effect && a.effect.target; return !!(t && t.closest && t.closest("[data-off]")); };
// a held animation no longer counts as "running" for the browser, so it would be repainted on every step;
// marking what it moves keeps it on its own GPU layer, where moving it costs almost nothing
const wcEls = new Set(), wcChecked = new WeakSet();
const MOVE_PROPS = ["transform", "opacity", "translate", "rotate", "scale"];
function promote(a) {
  const ef = a.effect, t = ef && ef.target; if (!t || wcChecked.has(a)) return; wcChecked.add(a);
  let props = []; try { ef.getKeyframes().forEach((k) => { props = props.concat(Object.keys(k)); }); } catch (e) { return; }
  if (!props.some((p) => MOVE_PROPS.includes(p))) return;
  if (ef.pseudoElement) t.setAttribute("data-wc", ""); else if (!t.style.willChange) t.style.willChange = "transform, opacity, translate";
  wcEls.add(t);
}
function demoteAll() { wcEls.forEach((t) => { t.removeAttribute("data-wc"); if (t.style.willChange === "transform, opacity, translate") t.style.willChange = ""; }); wcEls.clear(); }
// below 60, the page's CSS animations are held and stepped forward together a few times a second,
// so the browser only draws a new picture 30 or 15 times a second
function limiterTick(now) {
  limRaf = 0;
  if (motionFps >= 60) return;
  const gap = 1000 / motionFps;
  if (!limLast) limLast = now;
  if (now - limLast >= gap - 3 && !document.hidden) {
    const dt = Math.min(now - limLast, 250); limLast = now;
    for (const a of document.getAnimations()) {
      if (!isCssAnim(a)) continue;
      if (a.playState === "running") { a.pause(); heldAnims.add(a); promote(a); continue; }
      if (!heldAnims.has(a) || a.playState !== "paused" || animOff(a)) continue;
      a.currentTime = (a.currentTime || 0) + dt;
    }
  } else if (document.hidden) limLast = now;
  limRaf = requestAnimationFrame(limiterTick);
}
function setMotionFps(v, quiet) {
  motionFps = [15, 30, 60].includes(v) ? v : 60;
  try { localStorage.setItem(FPS_KEY, String(motionFps)); } catch (e) {}
  const b = document.getElementById("fps-btn");
  if (b) { b.dataset.fps = motionFps; b.querySelector("b").textContent = motionFps + " fps"; b.setAttribute("aria-label", "Animations at " + motionFps + " frames a second. Press to change"); b.title = "Animations at " + motionFps + " fps. Press for " + (motionFps === 60 ? 30 : motionFps === 30 ? 15 : 60) + " fps"; }
  if (motionFps >= 60) {
    cancelAnimationFrame(limRaf); limRaf = 0; limLast = 0;
    document.getAnimations().forEach((a) => { if (isCssAnim(a) && heldAnims.has(a) && a.playState === "paused" && !animOff(a)) a.play(); });
    demoteAll();
  } else if (!limRaf) { limLast = 0; limRaf = requestAnimationFrame(limiterTick); }
  if (!quiet) toast(motionFps === 60 ? "Animations at full speed, 60 frames a second." : "Animations at " + motionFps + " frames a second, easier on the graphics card.");
}

/* ---------- anything scrolled out of sight stops animating until it comes back ---------- */
const OFF_SEL = "#dossier > .d-sec, #dossier .skill, #dossier .npt-box, #dossier .scene, #list > .row, .wish-row, .hm-hero, .hm-block, .rank-row, .tier-row, .sm-sec";
const offSeen = new WeakSet();
const offObs = "IntersectionObserver" in window ? new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    const el = en.target;
    if (!en.isIntersecting) {
      if (el.hasAttribute("data-off")) return;
      el.setAttribute("data-off", "");
      el.getAnimations({subtree: true}).forEach((a) => { if (isCssAnim(a) && a.playState === "running") { a.pause(); offPaused.add(a); } });
    } else if (el.hasAttribute("data-off")) {
      el.removeAttribute("data-off");
      el.getAnimations({subtree: true}).forEach((a) => {
        if (!isCssAnim(a) || a.playState !== "paused" || animOff(a)) return;
        // back in view: it runs again, at every frame rate (the steps that cap the frame rate live on the animation itself)
        if (offPaused.has(a) || heldAnims.has(a)) { a.play(); offPaused.delete(a); heldAnims.delete(a); }
      });
    }
  });
}, {rootMargin: "120px 0px"}) : null;
function watchOffscreen() { if (!offObs) return; document.querySelectorAll(OFF_SEL).forEach((el) => { if (!offSeen.has(el)) { offSeen.add(el); offObs.observe(el); } }); }
let offT = 0;
if (window.MutationObserver) new MutationObserver(() => { clearTimeout(offT); offT = setTimeout(watchOffscreen, 120); }).observe(document.body, {childList: true, subtree: true});

/* ---------- the particle canvases follow the same frame rate, and rest while out of sight ---------- */
const fxDrawn = new WeakMap();
fxLoop = function (now) {
  fxRaf = 0; let live = false;
  for (const F of [SCENE, PAGE]) {
    if (F.cv && !F.cv.isConnected) { F.cv = null; F.p = null; F.key = ""; }
    if (!F.cv || !F.p) continue;
    live = true;
    if (document.hidden) continue;
    if (F === PAGE && S.selected && !isWide()) continue;
    if (F === SCENE && F.cv.closest("[data-off]")) continue;
    if (motionFps < 60) { const last = fxDrawn.get(F) || 0; if (now - last < 1000 / motionFps - 3) continue; fxDrawn.set(F, now); }
    fxFrame(F, now);
  }
  if (live) fxRaf = requestAnimationFrame(fxLoop);
};

/* ---------- the grail frame around the servant panel is drawn on its own layer, right on top of the panel ---------- */
// It sits next to the panel (0.20.1; it used to be a layer over the whole page, so it covered the Compact × too) and takes
// the panel's own z-index when the panel has one, so it is above the panel and below anything meant to be above the panel.
const dsFrame = document.createElement("div");
dsFrame.className = "ds-frame"; dsFrame.hidden = true; dsFrame.setAttribute("aria-hidden", "true");
dsFrame.innerHTML = `<i class="gr-ring"><b></b></i>`;
(() => { const d = document.getElementById("dossier"); if (d && d.parentNode) d.parentNode.insertBefore(dsFrame, d.nextSibling); else document.body.appendChild(dsFrame); })();
let dsRaf = 0;
function placeDsFrame() {
  dsRaf = 0;
  const d = document.getElementById("dossier");
  const g = d && S.tab === "servants" ? (d.classList.contains("gr102") ? "gr102" : d.classList.contains("gr100") ? "gr100" : "") : "";
  const r = g ? d.getBoundingClientRect() : null;
  if (!g || !r || r.width < 20 || r.height < 20 || getComputedStyle(d).display === "none") { dsFrame.hidden = true; return; }
  dsFrame.hidden = false;
  if (!dsFrame.classList.contains(g)) dsFrame.className = "ds-frame " + g;
  const st = dsFrame.style, zi = getComputedStyle(d).zIndex;
  st.zIndex = zi === "auto" ? "" : zi;
  st.left = r.left + "px"; st.top = r.top + "px"; st.width = r.width + "px"; st.height = r.height + "px"; st.borderRadius = getComputedStyle(d).borderTopLeftRadius;
}
const queueDsFrame = () => { if (!dsRaf) dsRaf = requestAnimationFrame(placeDsFrame); };
window.addEventListener("scroll", queueDsFrame, {passive: true});
window.addEventListener("resize", queueDsFrame);
const syncDossierFrame0 = syncDossierFrame;
syncDossierFrame = function () { syncDossierFrame0(); queueDsFrame(); };
const renderChrome10 = renderChrome;
renderChrome = function () { renderChrome10(); queueDsFrame(); };
if (window.MutationObserver) { const d = document.getElementById("dossier"); if (d) new MutationObserver(queueDsFrame).observe(d, {childList: true, attributes: true, attributeFilter: ["class"]}); }
if (window.ResizeObserver) { const d = document.getElementById("dossier"); if (d) new ResizeObserver(queueDsFrame).observe(d); }
document.addEventListener("click", (e) => { const b = e.target.closest && e.target.closest('[data-action="fps"]'); if (b) setMotionFps(motionFps === 60 ? 30 : motionFps === 30 ? 15 : 60); });
setMotionFps(motionFps, true);
