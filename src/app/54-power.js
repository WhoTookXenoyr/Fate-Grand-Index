/* ================= 0.52.0-beta: power saving =================
   Noyr's laptop sat at 60–65 °C with the page just open. Where that went, measured on the page as it was:
   the screen was redrawn 60 times a second on every view (the background's rings, glows and twinkles all move), a
   servant's particle canvases were redrawn from JavaScript 60 times a second, and a hidden canvas kept the page awake
   on every other view.

   Power saving (on unless switched off on Settings):
   - looping animations and the particle canvases run at half the chosen frame rate (60 → 30); things that play once
     (pages, windows, the summoning) keep the full rate (22-frame-rate-costumes-glare.js);
   - after a minute without a move, a key, a scroll or a touch, the looping animations rest until the next one;
   - nothing is drawn for a canvas nobody can see.
   Off gives the page as it was: everything at the chosen rate, and it only rests when the window isn't in front. */
const IDLE_MS = 60000;
let idleMs = IDLE_MS, lastInput = performance.now();
// a looping animation that's part of something being watched mustn't stop: a fight playing, the summoning
const idleBlocked = () => !!document.querySelector("#summon:not([hidden])") || BT.play;
function idleCheck() {
  if (!powerSave || idleRest || resting || document.hidden) return;
  if (performance.now() - lastInput < idleMs) return;
  if (idleBlocked()) { lastInput = performance.now() - idleMs + 10000; return; }
  setIdleRest(true);
}
const onInput = () => { lastInput = performance.now(); if (idleRest) setIdleRest(false); };
["pointermove", "pointerdown", "keydown", "wheel", "touchstart", "scroll"].forEach((t) => window.addEventListener(t, onInput, {passive: true, capture: true}));
document.addEventListener("visibilitychange", () => { if (!document.hidden) onInput(); });
setInterval(idleCheck, 5000);
// a looping animation that starts while the page rests (part of the page redrawn by a timer) rests too
let idleNewT = 0;
document.addEventListener("animationstart", () => { if (!idleRest || idleNewT) return; idleNewT = setTimeout(() => { idleNewT = 0; idlePausePass(); }, 120); }, true);

/* ---------- the page canvas isn't on screen while it has nothing on it ----------
   It covers the whole window; empty, it was still laid over the page on every redraw. */
let pageFxShown = null;
function syncPageFxVis() {
  const cv = document.getElementById("page-fx"); if (!cv) return;
  const on = !!PAGE.p;
  if (on === pageFxShown) return;
  pageFxShown = on; cv.style.visibility = on ? "" : "hidden";
}
const fxAttach54 = fxAttach;
fxAttach = function () { const r = fxAttach54.apply(this, arguments); syncPageFxVis(); return r; };
syncPageFxVis();

/* ---------- the switch ---------- */
function setPowerSave(on, quiet) {
  powerSave = !!on;
  try { if (powerSave) localStorage.removeItem(POWER_KEY); else localStorage.setItem(POWER_KEY, "full"); } catch (e) {}
  if (!powerSave && idleRest) setIdleRest(false);
  lastInput = performance.now();
  stepAll();
  powerPaint();
  if (!quiet) toastAction(powerSave ? "Power saving is on: the background moves at half the frame rate and rests after a minute without input." : "Power saving is off: everything moves at the full frame rate.", "Undo", () => setPowerSave(!powerSave, true));
}
function powerPaint() {
  document.querySelectorAll('[data-action="power"]').forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.v === "1") === powerSave)));
}
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest('[data-action="power"]'); if (!b) return;
  const on = b.dataset.v === "1"; if (on !== powerSave) setPowerSave(on);
});
powerPaint();
// for the tests
window.__fgiPower = {state: () => ({save: powerSave, idle: idleRest, resting: resting, amb: ambFps(), fps: motionFps}), idleAfter: (ms) => { idleMs = ms == null ? IDLE_MS : ms; lastInput = performance.now(); }, check: () => idleCheck()};
