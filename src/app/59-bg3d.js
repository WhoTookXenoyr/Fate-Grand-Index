/* ================= 0.53.0-beta: 3D backgrounds, drawn by vanta.js on three.js =================
   Noyr asked for 3D backgrounds made with vanta.js. One WebGL picture lies behind the page:
   - on the usual background, an effect of your choice in the page's colours (the globe to begin with);
   - with the Story look, one that fits the scene: a 3D sea under the horizon where the scene has water, clouds over
     open country by day, a net of stars under a night sky, drifting haze everywhere else. The drawn landmarks of
     57-story-scenes.js stay in front of it.

   WebGL draws every frame, which is what the power saving of 0.52 took out of the page, so it's kept on a short lead:
   - it's drawn small and stretched (BG3D_PX megapixels for each effect; "Full" on Settings draws four times as many);
   - it follows the frame-rate switch and power saving (half the chosen rate), not the screen's own rate;
   - it stops while the page rests (a minute without input, another window in front, the tab hidden) and while
     something covers it (the summoning, a phone's servant sheet);
   - with "reduce motion", or without WebGL, the page keeps the drawn background of 0.52.
   The libraries are in the page (src/vendor) and only run when the 3D background is on. */
const BG3D_KEY = "spirit-origin-list:v1:bg3d";       // "off": no 3D background ("on" only matters to a test tool's browser)
const BG3D_FX_KEY = "spirit-origin-list:v1:bg3d-fx"; // the effect on the usual background
const BG3D_Q_KEY = "spirit-origin-list:v1:bg3d-q";   // "full": four times the pixels
const BG3D_KINDS = [["globe", "Globe"], ["net", "Net"], ["fog", "Haze"], ["waves", "Waves"], ["clouds", "Clouds"], ["cells", "Cells"]];
// how many megapixels each effect is drawn at (its cost for each pixel differs a lot: clouds cost about 18 times haze)
const BG3D_PX = {globe: 1, net: 1, waves: 0.8, fog: 0.5, cells: 0.3, clouds: 0.1};
// (a browser driven by a test tool starts without it unless the key says "on": the tests' machines draw WebGL on the
// processor, and every page of every suite would pay for it)
const bg3dAuto = !navigator.webdriver;
let bg3dOn = lsGet(BG3D_KEY) === "on" || (bg3dAuto && lsGet(BG3D_KEY) !== "off");
const BG3D_BROKEN = {}; // effects that wouldn't start in this browser
let bg3dPick = BG3D_KINDS.some((k) => k[0] === lsGet(BG3D_FX_KEY)) ? lsGet(BG3D_FX_KEY) : "globe";
let bg3dFull = lsGet(BG3D_Q_KEY) === "full";
let bg3d = null;       // what's running: {kind, fx, sig, sea}
let bg3dLib = 0;       // 0 not run yet, 1 ready, -1 failed
let bg3dDead = "";     // why it can't run here ("" while it can)
let bg3dSleep = false; // the loop has stopped and waits for bg3dWake

/* ---------- the libraries: run once, the first time a 3D background is wanted ---------- */
function bg3dLoad() {
  if (bg3dLib) return bg3dLib > 0;
  try {
    (function () {
/* three.js r134. Copyright (c) 2010-2021 three.js authors. MIT licence: src/vendor/LICENSE-three.txt */
@@include:vendor/three.min.js@@
;
/* vanta.js 0.5.24. Copyright 2020 Teng Bao. MIT licence: src/vendor/LICENSE-vanta.txt */
@@include:vendor/vanta.waves.min.js@@
;
@@include:vendor/vanta.fog.min.js@@
;
@@include:vendor/vanta.clouds.min.js@@
;
@@include:vendor/vanta.net.min.js@@
;
@@include:vendor/vanta.globe.min.js@@
;
@@include:vendor/vanta.cells.min.js@@
;
@@include:vendor/vanta.birds.min.js@@
;
@@include:vendor/vanta.dots.min.js@@
;
    }).call(window);
    bg3dLib = window.THREE && window.VANTA && window.VANTA.FOG ? 1 : -1;
  } catch (e) { console.error(e); bg3dLib = -1; }
  if (bg3dLib < 0) bg3dDead = "The 3D library didn't start in this browser.";
  return bg3dLib > 0;
}
let bg3dGl = null;
function bg3dCan() {
  if (bg3dGl == null) {
    try {
      const c = document.createElement("canvas"), gl = window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl"));
      bg3dGl = !!gl;
      if (gl) { const x = gl.getExtension("WEBGL_lose_context"); if (x) x.loseContext(); }
    } catch (e) { bg3dGl = false; }
    if (!bg3dGl) bg3dDead = "This browser has WebGL switched off, so the drawn background is used.";
  }
  return bg3dGl;
}

/* ---------- what should be up ---------- */
// (the keys ending in a colour: color, color2, backgroundColor…; birds' colorMode is a word)
const bg3dNum = (c) => { const n = parseInt(String(c).replace("#", ""), 16); return Number.isFinite(n) ? n : 0; };
// which effect a story scene gets: the scene can name one (v), otherwise its weather and what's drawn in it decide
function bg3dActKind(act) {
  if (act.v) return act.v;
  const has = (k) => (act.d || []).some((x) => x[0] === k) || (act.t || []).some((x) => x[0] === k);
  const fx = act.fx || [];
  if (has("flat") && (act.m === "waves" || fx.includes("shine"))) return "waves";
  if (act.m === "stars" || act.stars === 2) return "net";
  if (has("ceiling") || act.stars) return "fog";
  if (["dust", "petals", "leaves"].includes(act.m) && !fx.includes("mist") && !fx.includes("heat")) return "clouds";
  return "fog";
}
// the options vanta gets: sky is [top, middle, horizon] in this theme's tones, hi a light in the scene
function bg3dOpts(kind, sky, hi, dark) {
  const W = "#ffffff", K = "#000000", line = dark ? scMix(sky[2], W, 0.45) : scMix(sky[0], K, 0.45);
  if (kind === "fog") return {baseColor: sky[0], lowlightColor: sky[1], midtoneColor: sky[2], highlightColor: scMix(sky[2], hi, 0.5), blurFactor: 0.62, speed: 0.75, zoom: 0.85};
  if (kind === "clouds") return {backgroundColor: sky[0], skyColor: sky[2], cloudColor: scMix(sky[1], W, dark ? 0.22 : 0.55), cloudShadowColor: scMix(sky[0], sky[1], 0.35), sunColor: hi, sunGlareColor: scMix(sky[2], hi, 0.5), sunlightColor: scMix(sky[2], hi, 0.6), speed: 0.55};
  if (kind === "cells") return {color1: sky[0], color2: sky[2], backgroundColor: sky[1], size: 1.7, speed: 0.7, amplitudeFactor: 1, ringFactor: 1, rotationFactor: 1};
  // (in the dark theme the lines are added to what lies under the canvas, so their own "background" is black)
  if (kind === "net") return {color: line, backgroundColor: dark ? K : sky[1], backgroundAlpha: 0, points: 9, maxDistance: 21, spacing: 17, showDots: true};
  if (kind === "globe") return {color: line, color2: dark ? scMix(sky[2], W, 0.6) : scMix(sky[0], K, 0.2), backgroundColor: dark ? K : sky[1], backgroundAlpha: 0, size: 1.05, points: 9, maxDistance: 21, spacing: 17, showDots: true};
  return {color: scMix(sky[1], K, dark ? 0.2 : 0.14), shininess: 26, waveHeight: 14, waveSpeed: 0.55, zoom: 0.85, backgroundColor: sky[0]};
}
function bg3dWant() {
  if (!bg3dOn || bg3dDead || RM.matches) return null;
  const dark = isDark(), now = typeof scNow === "function" ? scNow() : null;
  if (now) {
    const act = SCENES[now.c.id].acts[now.a], sky = scSky(act), kind = bg3dActKind(act);
    const orb = (act.d || []).find((x) => x[0] === "orb"), hi = scTone(orb && /^#[0-9a-f]{6}$/i.test(orb[4]) ? orb[4] : scMix(act.sky[2], "#ffffff", 0.45));
    // (vanta's clouds are seen from above them, the sun high; over a landscape they're turned over: clouds overhead,
    // clear sky and the light at the horizon)
    const w = {story: true, kind: kind, flip: kind === "clouds", css: scSkyCss(sky), opts: bg3dOpts(kind, sky, hi, dark), a: kind === "fog" ? 0.62 : kind === "cells" ? 0.5 : kind === "clouds" ? 0.9 : 1};
    if (kind === "waves") {
      // a sea: the mesh lies from the scene's waterline down, and the sky above it stays the drawn one
      const flat = (act.d || []).find((x) => x[0] === "flat"), M = scMetrics();
      w.sea = {line: flat ? clamp((M.H - (560 - flat[2]) * M.k) / M.H, 0.3, 0.95) : 0.8, far: scTone(scMix(flat ? flat[1] : act.sky[1], act.sky[2], 0.55))};
      w.opts = {color: scTone(flat ? scMix(flat[1], act.sky[2], 0.12) : act.sky[1]), shininess: 70, waveHeight: 11, waveSpeed: 0.5, zoom: 1, backgroundColor: sky[2], backgroundAlpha: 0};
    }
    return w;
  }
  if (typeof storyOn === "function" && storyOn()) return null; // a chapter without scenes keeps its drawn backdrop
  const kind3 = bg3dPick, st = document.documentElement.style, g = [1, 2, 3].map((i) => st.getPropertyValue("--g" + i).trim());
  if (!g.every((c) => /^#[0-9a-f]{6}$/i.test(c))) return null;
  // (the page's three tones lie close together; haze and cells need more room between dark and light to show at all)
  const soft = kind3 === "fog" || kind3 === "cells";
  const sky = soft ? [scMix(g[1], "#000000", dark ? 0.3 : 0.06), g[0], scMix(g[2], "#ffffff", dark ? 0.2 : 0.4)] : [g[1], g[0], g[2]], hi = scMix(g[2], dark ? "#ffffff" : "#fff6d8", 0.5);
  const o3 = bg3dOpts(kind3, sky, hi, dark);
  // on true black the page's tones are all black (60-palette.js), so the picture takes the gold
  if (dark) {
    if (kind3 === "net" || kind3 === "globe") { o3.color = "#b39a5e"; if (o3.color2) o3.color2 = "#ecdcae"; }
    else Object.assign(o3, bg3dOpts(kind3, ["#000000", "#0c0a06", "#4a3d22"], "#d9b86c", true));
  }
  return {story: false, kind: kind3, css: "", opts: o3, a: kind3 === "fog" ? 0.9 : kind3 === "cells" ? 0.6 : kind3 === "clouds" ? 0.85 : kind3 === "waves" ? 0.8 : 1};
}

/* ---------- the element it's drawn in: right after the page's own background, under everything else ---------- */
function bg3dHost() {
  let h = document.getElementById("bg3d");
  const pb = document.querySelector(".page-bg"); if (!pb) return null;
  if (!h) { h = document.createElement("div"); h.id = "bg3d"; h.className = "bg3d"; h.setAttribute("aria-hidden", "true"); h.innerHTML = `<div class="bg3d-cv"></div>`; }
  if (pb.nextElementSibling !== h) pb.after(h);
  return h;
}
// how much smaller than the screen it's drawn (vanta divides the screen's pixel ratio by this)
function bg3dScale(kind, host) {
  const dpr = window.devicePixelRatio || 1, w = host.offsetWidth || window.innerWidth, h = host.offsetHeight || window.innerHeight;
  const px = BG3D_PX[kind] * 1e6 * (bg3dFull ? 4 : 1) * (isCoarse() ? 0.6 : 1);
  const ratio = Math.min(dpr, 2, Math.sqrt(px / Math.max(1, w * h)));
  return dpr / ratio;
}
const isCoarse = () => { try { return window.matchMedia("(pointer: coarse)").matches; } catch (e) { return false; } };

/* ---------- its frames: at the background's frame rate, and none while the page rests ---------- */
let bg3dCover = false, bg3dCoverAt = 0;
function bg3dCovered() {
  const now = performance.now();
  if (now - bg3dCoverAt > 400) {
    bg3dCoverAt = now;
    bg3dCover = !!document.querySelector("#summon:not([hidden])") || document.documentElement.classList.contains("sheet-on");
  }
  return bg3dCover;
}
const bg3dPaused = () => resting || idleRest || document.hidden || bg3dCovered();
function bg3dDrive(fx) {
  const draw = fx.animationLoop; // vanta's own: one frame, then it asks for the next through fx.animationLoop
  let next = 0;
  fx.animationLoop = function () {
    if (!bg3d || bg3d.fx !== fx) return;
    if (bg3dPaused()) { bg3dSleep = true; fx.req = 0; return; }
    const now = performance.now(), k = 1000 / ambFps();
    if (now < next - 1) { fx.req = requestAnimationFrame(fx.animationLoop); return; }
    next = next + k < now ? now + k : next + k;
    bg3dFrames++;
    draw();
  };
}
let bg3dFrames = 0;
function bg3dWake() {
  if (!bg3d || !bg3dSleep || bg3dPaused()) return;
  bg3dSleep = false; bg3d.fx.prevNow = performance.now();
  bg3d.fx.req = requestAnimationFrame(bg3d.fx.animationLoop);
}
// (a covered page is only noticed by the loop itself, so something has to look again once it has stopped)
setInterval(() => { if (bg3d && bg3dSleep) { bg3dCoverAt = 0; bg3dWake(); } }, 700);
document.addEventListener("visibilitychange", () => { if (!document.hidden) bg3dWake(); });
const setResting59 = setResting;
setResting = function () { const r = setResting59.apply(this, arguments); bg3dWake(); return r; };
const setIdleRest59 = setIdleRest;
setIdleRest = function () { const r = setIdleRest59.apply(this, arguments); bg3dWake(); return r; };

/* ---------- starting, changing and ending an effect ---------- */
// a sea seen from a mast's height: the far edge of the mesh lies on the scene's waterline, and the water fills the
// window below it. The mesh is three times vanta's size, so its facets can be seen in so low a strip.
function bg3dSea(fx, sea) {
  const T = window.THREE, fov = 35, S = 3, h = 240, D = 1500, zc = D - 720 * S;
  const below = Math.atan((h + 10) / D), up = -below - Math.atan((1 - 2 * sea.line) * Math.tan(fov * Math.PI / 360));
  fx.cameraPosition.set(0, h, zc); fx.cameraTarget.set(0, h + Math.tan(up) * 1000, zc - 1000);
  const c = fx.camera; c.position.copy(fx.cameraPosition); c.tx = 0; c.ty = h; c.tz = zc; c.lookAt(fx.cameraTarget);
  fx.plane.scale.set(S, 2, S);
  fx.scene.fog = new T.Fog(bg3dNum(sea.far), D * 0.82, D * 1.12);
  // the light stands low over the far water, so the facets that face it glint and the ones that don't stay dark
  fx.scene.children.forEach((o) => { if (o.isPointLight) { o.position.set(-300, 420, zc - D * 0.95); o.intensity = 0.8; o.distance = 0; } else if (o.isAmbientLight) o.intensity = 0.5; });
  // the pointer moves the eye a little, never under the water
  fx.onMouseMove = (x, y) => { c.tx = (x - 0.5) * 110; c.ty = h + (0.5 - y) * 30; c.tz = zc; };
}
// net and globe: vanta draws their lines as solid colour faded towards its background colour, which shows as dark
// strokes over a sky that isn't that colour. In the dark theme they're added to the picture under the canvas instead.
function bg3dGlow(fx) {
  const T = window.THREE, m = fx.linesMesh && fx.linesMesh.material;
  if (!m || fx.blending !== "additive") return;
  m.blending = T.CustomBlending; m.blendEquation = T.AddEquation; m.blendSrc = T.OneFactor; m.blendDst = T.OneFactor; m.blendSrcAlpha = T.ZeroFactor; m.blendDstAlpha = T.OneFactor; m.needsUpdate = true;
}
function bg3dStart(want) {
  const host = bg3dHost(); if (!host || !bg3dCan() || !bg3dLoad()) return false;
  const make = window.VANTA[want.kind.toUpperCase()]; if (!make) return false;
  const el = host.querySelector(".bg3d-cv"), sc = bg3dScale(want.kind, host), o = {};
  Object.keys(want.opts).forEach((k) => { o[k] = /colou?r\d?$/i.test(k) ? bg3dNum(want.opts[k]) : want.opts[k]; });
  let fx = null;
  try {
    fx = make(Object.assign(o, {el: el, THREE: window.THREE, scale: sc, scaleMobile: sc, mouseControls: scCamOn && !isCoarse(), touchControls: false, gyroControls: false, minHeight: 100, minWidth: 100}));
  } catch (e) { console.error(e); fx = null; }
  const cv = fx && fx.renderer && fx.renderer.domElement;
  if (!cv || !cv.isConnected) {
    try { if (fx) fx.destroy(); } catch (e) {}
    // (a class background that won't start here gives way to haze; only the usual one switches 3D off)
    if (want.cls) { BG3D_BROKEN[want.kind] = 1; setTimeout(bg3dSoon, 0); return false; }
    bg3dDead = "The 3D background couldn't start on this graphics card, so the drawn background is used."; bg3dPaint(); return false;
  }
  bg3d = {kind: want.kind, fx: fx, sig: "", sea: !!want.sea, scale: sc, lost: (e) => { e.preventDefault(); bg3dDead = "The graphics card stopped the 3D background, so the drawn background is used."; bg3dKill(); bg3dSync(); bg3dPaint(); }};
  cv.addEventListener("webglcontextlost", bg3d.lost);
  bg3dSleep = false;
  bg3dDrive(fx);
  bg3dApply(want, true);
  return true;
}
// the same effect in other colours (or at another size): no new picture, only new values
function bg3dApply(want, fresh) {
  const host = document.getElementById("bg3d"), sig = JSON.stringify([want.opts, want.sea || 0, want.css, want.a, !!want.flip]);
  if (!bg3d || !host) return;
  host.style.background = want.css || "";
  host.style.setProperty("--b3a", String(want.a));
  host.classList.toggle("flip", !!want.flip);
  if (bg3d.sig === sig) return;
  bg3d.sig = sig;
  const fx = bg3d.fx, o = {};
  Object.keys(want.opts).forEach((k) => { o[k] = /colou?r\d?$/i.test(k) ? bg3dNum(want.opts[k]) : want.opts[k]; });
  try {
    if (!fresh) {
      fx.setOptions(o);
      // lines and dots take their colours when they're made, so those are made again (the renderer stays)
      if (["net", "globe", "birds", "dots"].includes(bg3d.kind)) fx.restart();
    }
    if (want.sea && fx.plane) bg3dSea(fx, want.sea);
    bg3dGlow(fx);
  } catch (e) { console.error(e); }
}
function bg3dKill() {
  const b = bg3d; if (!b) return;
  bg3d = null; bg3dSleep = false;
  const r = b.fx.renderer, cv = r && r.domElement;
  try { if (cv) cv.removeEventListener("webglcontextlost", b.lost); } catch (e) {}
  try { cancelAnimationFrame(b.fx.req); b.fx.destroy(); } catch (e) {}
  try { if (r) { r.dispose(); r.forceContextLoss(); } } catch (e) {}
  const host = document.getElementById("bg3d"); if (host) host.querySelectorAll("canvas").forEach((c) => c.remove());
}
let bg3dT = 0;
function bg3dSync() {
  clearTimeout(bg3dT);
  const root = document.documentElement, want = bg3dWant(), host = want ? bg3dHost() : document.getElementById("bg3d");
  const flags = (w) => { root.classList.toggle("bg3d-on", !!w); root.classList.toggle("bg3d-story", !!(w && w.story)); root.classList.toggle("bg3d-sea", !!(w && w.sea)); };
  if (!want || !host) {
    // nothing wanted: it fades out and is taken away
    if (host) host.classList.remove("on");
    flags(null); bg3dPaint();
    if (bg3d) bg3dT = setTimeout(() => { if (!bg3dWant()) bg3dKill(); else bg3dSync(); }, 650);
    return;
  }
  const scale = bg3dScale(want.kind, host);
  if (bg3d && bg3d.kind === want.kind && !!want.sea === bg3d.sea && Math.abs(scale / bg3d.scale - 1) < 0.12) { bg3dApply(want); flags(want); host.classList.add("on"); bg3dWake(); return; }
  if (bg3d) {
    // another effect: the old one fades out first
    host.classList.remove("on");
    bg3dT = setTimeout(() => { bg3dKill(); bg3dSync(); }, 480);
    return;
  }
  if (!bg3dStart(want)) { flags(null); bg3dPaint(); return; } // (Settings says why it isn't there)
  flags(want);
  void host.offsetWidth; host.classList.add("on");
}
// asked for from many places at once (a new scene paints the page's colours, then the scene): once, a moment later
let bg3dSoonT = 0;
function bg3dSoon() { if (bg3dSoonT) return; bg3dSoonT = setTimeout(() => { bg3dSoonT = 0; try { bg3dSync(); } catch (e) { console.error(e); } }, 30); }

/* ---------- everything that changes what's wanted ---------- */
const paintPage59 = paintPage;
paintPage = function () { const r = paintPage59.apply(this, arguments); bg3dSoon(); return r; };
const scPaint59 = scPaint;
scPaint = function () { const r = scPaint59.apply(this, arguments); bg3dSoon(); return r; };
const storyPaint59 = storyPaint;
storyPaint = function () { const r = storyPaint59.apply(this, arguments); bg3dSoon(); return r; };
const setSceneCam59 = setSceneCam;
setSceneCam = function () { const r = setSceneCam59.apply(this, arguments); if (bg3d) { bg3dKill(); bg3dSoon(); } return r; };
document.addEventListener("fgi-theme", bg3dSoon);
DARK_Q.addEventListener("change", bg3dSoon);
RM.addEventListener("change", bg3dSoon);
let bg3dSizeT = 0;
window.addEventListener("resize", () => { clearTimeout(bg3dSizeT); bg3dSizeT = setTimeout(bg3dSoon, 300); });

/* ---------- Settings ---------- */
function bg3dPaint() {
  document.querySelectorAll('[data-action="bg3d"]').forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.v === "1") === bg3dOn)));
  document.querySelectorAll('[data-action="bg3d-fx"]').forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === bg3dPick)));
  document.querySelectorAll('[data-action="bg3d-q"]').forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.v === "full") === bg3dFull)));
  document.querySelectorAll(".bg3d-note").forEach((n) => { n.textContent = bg3dDead || (RM.matches ? "Your device asks for less motion, so the drawn background is used." : ""); n.hidden = !n.textContent; });
}
function setBg3d(on, quiet) {
  bg3dOn = !!on; try { if (bg3dOn && bg3dAuto) localStorage.removeItem(BG3D_KEY); else localStorage.setItem(BG3D_KEY, bg3dOn ? "on" : "off"); } catch (e) {}
  bg3dPaint(); bg3dSync();
  if (!quiet) toastAction(bg3dOn ? "The 3D background is on." : "The 3D background is off: the drawn one is back.", "Undo", () => setBg3d(!bg3dOn, true));
}
function setBg3dPick(k) {
  if (!BG3D_KINDS.some((x) => x[0] === k)) return;
  bg3dPick = k; try { if (k === "globe") localStorage.removeItem(BG3D_FX_KEY); else localStorage.setItem(BG3D_FX_KEY, k); } catch (e) {}
  bg3dPaint(); bg3dSync();
}
function setBg3dFull(full) {
  bg3dFull = !!full; try { if (bg3dFull) localStorage.setItem(BG3D_Q_KEY, "full"); else localStorage.removeItem(BG3D_Q_KEY); } catch (e) {}
  bg3dPaint(); bg3dSync();
}
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest('[data-action="bg3d"], [data-action="bg3d-fx"], [data-action="bg3d-q"]'); if (!b) return;
  const a = b.dataset.action;
  if (a === "bg3d") { const on = b.dataset.v === "1"; if (on !== bg3dOn) setBg3d(on); }
  else if (a === "bg3d-fx") { if (b.dataset.v !== bg3dPick) setBg3dPick(b.dataset.v); }
  else { const full = b.dataset.v === "full"; if (full !== bg3dFull) setBg3dFull(full); }
});
const renderSettings59 = typeof renderSettings === "function" ? renderSettings : null;
if (renderSettings59) renderSettings = function () { const r = renderSettings59.apply(this, arguments); bg3dPaint(); return r; };
bg3dPaint();
// for the tests, and for looking at an effect
window.__fgi3d = {
  state: () => ({on: bg3dOn, pick: bg3dPick, full: bg3dFull, dead: bg3dDead, kind: bg3d ? bg3d.kind : null, sea: bg3d ? bg3d.sea : false, asleep: bg3dSleep, frames: bg3dFrames, lib: bg3dLib,
    size: bg3d && bg3d.fx.renderer ? [bg3d.fx.renderer.domElement.width, bg3d.fx.renderer.domElement.height] : null, opts: bg3d ? Object.assign({}, bg3d.fx.options, {el: null, THREE: null}) : null}),
  want: () => { const w = bg3dWant(); return w ? {kind: w.kind, story: w.story, sea: w.sea || null, a: w.a, opts: w.opts} : null; },
  kindOf: (w, a) => bg3dActKind(SCENES[w].acts[a]),
  fx: () => bg3d ? bg3d.fx : null,
  sync: () => bg3dSync()
};
// (the page is up first; the libraries are a big piece of script to run)
setTimeout(bg3dSoon, 0);
