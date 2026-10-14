/* ================= 0.18.0: a lighter background, Overcharge rows, removable costumes, a glare that grows with grails ================= */

/* ---------- frame rate, kept by the graphics card ----------
   The old limiter paused every CSS animation and pushed each one forward from JavaScript several times a second,
   which cost more than it saved, and "60 fps" let a 144 or 240 Hz screen redraw the background 144 or 240 times a second.
   Now every animation moves in steps of 1/fps of a second on one shared clock: between steps nothing changes on screen,
   so the browser draws nothing, at any refresh rate, and no JavaScript runs per frame. */
cancelAnimationFrame(limRaf); limRaf = 0;
limiterTick = function () { limRaf = 0; };
document.getAnimations().forEach((a) => { if (heldAnims.has(a) && a.playState === "paused" && !animOff(a)) a.play(); });
demoteAll();
const tickMs = () => 1000 / motionFps;
const STEPPED = new WeakMap();
// a still element's animation is left alone; the summon's own clockwork is timed in JavaScript, so it runs free
const inSummon = (a) => { const t = a.effect && a.effect.target; return !!(t && t.closest && t.closest("#summon")); };
function alignAnim(a) {
  if (a.playState !== "running") return;
  const st = a.startTime;
  if (st == null) { a.ready.then(() => alignAnim(a)).catch(() => {}); return; }
  const k = tickMs(), g = Math.round(st / k) * k;
  if (Math.abs(g - st) > 0.5) { try { a.startTime = g; } catch (e) {} }
}
function stepAnim(a) {
  if (!isCssAnim(a) || inSummon(a)) return;
  const ef = a.effect; if (!ef || !ef.getTiming) return;
  let o = STEPPED.get(a);
  if (!o) {
    const t = ef.getTiming();
    if (typeof t.duration !== "number" || !(t.duration > 0)) return;
    o = {d: t.duration, dl: t.delay || 0, fps: 0}; STEPPED.set(a, o);
  }
  if (o.fps !== motionFps) {
    const k = tickMs(), n = Math.max(1, Math.round(o.d / k));
    try { ef.updateTiming({duration: n * k, delay: Math.round(o.dl / k) * k, easing: "steps(" + n + ", end)"}); } catch (e) { return; }
    o.fps = motionFps;
  }
  alignAnim(a);
}
const stepAll = () => { if (!resting) document.getAnimations().forEach(stepAnim); };
document.addEventListener("animationstart", (e) => { const t = e.target; if (t && t.getAnimations) t.getAnimations({subtree: true}).forEach(stepAnim); }, true);
// new pictures, pages and class changes start new animations (some only after a delay): catch them right away
let stepT = 0;
if (window.MutationObserver) new MutationObserver(() => { if (!stepT) stepT = setTimeout(() => { stepT = 0; stepAll(); }, 120); })
  .observe(document.documentElement, {childList: true, subtree: true, attributes: true, attributeFilter: ["class", "data-off"]});
setInterval(stepAll, 2500);
const setMotionFps18 = setMotionFps;
setMotionFps = function (v, quiet) { setMotionFps18(v, quiet); stepAll(); };

/* ---------- the particle canvases: never more than the chosen frame rate, on the same clock ---------- */
const fxDims = new WeakMap();
const fxRO = "ResizeObserver" in window ? new ResizeObserver((es) => es.forEach((e) => fxDims.set(e.target, [e.contentRect.width, e.contentRect.height]))) : null;
// the canvas size comes from a watcher instead of being measured on every frame
fxSize = function (F) {
  const c = F.cv, dpr = F.page ? 1 : Math.min(2, window.devicePixelRatio || 1);
  let d = fxRO && fxDims.get(c);
  if (!d) { d = [c.clientWidth, c.clientHeight]; if (fxRO) { fxDims.set(c, d); fxRO.observe(c); } }
  const w = d[0], h = d[1]; if (!w || !h) return false;
  const W = Math.round(w * dpr), H = Math.round(h * dpr);
  if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
  F.cx.setTransform(dpr, 0, 0, dpr, 0, 0); F.w = w; F.h = h; return true;
};
fxLoop = function (now) {
  fxRaf = 0; let live = false;
  // the same steps as the CSS animations, so a canvas update and a CSS step share one redraw
  const slot = Math.floor((now + 0.5) / tickMs());
  for (const F of [SCENE, PAGE]) {
    if (F.cv && !F.cv.isConnected) { F.cv = null; F.p = null; F.key = ""; }
    if (!F.cv || !F.p) continue;
    live = true;
    if (document.hidden || resting) continue;
    if (F === PAGE && S.selected && !isWide()) continue;
    if (F === SCENE && F.cv.closest("[data-off]")) continue;
    if (F.slot === slot) continue;
    F.slot = slot; fxFrame(F, now);
  }
  if (live && !resting) {
    // sleep until just before the next step instead of waking on every frame of a fast screen
    const wait = (slot + 1) * tickMs() - performance.now() - 7;
    if (wait > 6) { fxRaf = -1; setTimeout(() => { fxRaf = requestAnimationFrame(fxLoop); }, wait); }
    else fxRaf = requestAnimationFrame(fxLoop);
  }
};

/* ---------- the background rests while this window isn't the one you're using (a game, another app) ---------- */
let resting = false;
const restHeld = new Set();
function setResting(on) {
  if (on === resting) return;
  if (on && document.querySelector("#summon.go")) return;
  resting = on;
  if (on) {
    document.getAnimations().forEach((a) => { if (isCssAnim(a) && a.playState === "running" && !inSummon(a)) { a.pause(); restHeld.add(a); } });
  } else {
    restHeld.forEach((a) => { if (a.playState === "paused" && !animOff(a)) { a.play(); alignAnim(a); } });
    restHeld.clear(); stepAll();
    if (!fxRaf) fxRaf = requestAnimationFrame(fxLoop);
  }
}
window.addEventListener("blur", () => setResting(true));
window.addEventListener("focus", () => setResting(false));
document.addEventListener("pointerdown", () => setResting(false), true);
stepAll();

/* ---------- costumes: a servant without one can lose the slot (and get it back with + Add costume) ---------- */
// costumeSlots 0 now means "no costume slot"; a costume picture always keeps its slot
costumeCount = function (s) {
  let n = s && s.costumeSlots === 0 ? 0 : Math.max(1, num(s && s.costumeSlots) || 1);
  Object.keys((s && s.art) || {}).forEach((k) => { const m = /^c(\d*)$/.exec(k); if (m) n = Math.max(n, m[1] ? Number(m[1]) : 1); });
  return Math.min(MAX_COSTUMES, n);
};
const cosKeys = (n) => { const ks = []; for (let i = 1; i <= n; i++) ks.push(i === 1 ? "c" : "c" + i); return ks; };
const isUpload = (v) => typeof v === "string" && v && !/^(https?:|data:|blob:)/.test(v);
function cosSnap(s) {
  const has = (k) => Object.prototype.hasOwnProperty.call(s, k);
  return {id: s.id, art: has("art") ? Object.assign({}, s.art) : undefined, artNames: has("artNames") ? Object.assign({}, s.artNames) : undefined,
    costumeSlots: has("costumeSlots") ? s.costumeSlots : undefined, artStage: has("artStage") ? s.artStage : undefined, view: S.viewStage[s.id]};
}
function cosRestore(o) {
  const s = S.servants.find((x) => x.id === o.id); if (!s) return;
  ["art", "artNames", "costumeSlots", "artStage"].forEach((k) => { if (o[k] === undefined) delete s[k]; else s[k] = o[k]; });
  if (o.view === undefined) delete S.viewStage[s.id]; else S.viewStage[s.id] = o.view;
  scheduleWrite("servants", s);
}
// a picture uploaded for a removed costume is deleted once Undo is no longer offered
function dropLater(ids, undone) {
  if (!S.assets || !ids.length) return;
  setTimeout(() => {
    if (undone()) return;
    const used = new Set(); S.servants.forEach((s) => Object.values(s.art || {}).forEach((v) => used.add(v)));
    ids.forEach((id) => { if (!used.has(id)) Promise.resolve().then(() => S.assets.delete(id)).catch(() => {}); });
  }, 12000);
}
function cosRemoveFrom(s, k) {
  const n = costumeCount(s), ks = cosKeys(n), i = ks.indexOf(k); if (i < 0) return false;
  const art = Object.assign({}, s.art || {}), nm = Object.assign({}, s.artNames || {}), gone = art[k];
  const mv = (o, a, b) => { if (Object.prototype.hasOwnProperty.call(o, a)) o[b] = o[a]; else delete o[b]; };
  for (let j = i; j < n - 1; j++) { mv(art, ks[j + 1], ks[j]); mv(nm, ks[j + 1], ks[j]); }
  delete art[ks[n - 1]]; delete nm[ks[n - 1]];
  s.art = art; if (Object.keys(nm).length) s.artNames = nm; else delete s.artNames;
  s.costumeSlots = n - 1;
  // the icon stays on the same picture; if that picture is gone, the first one left becomes the icon
  const si = ks.indexOf(s.artStage);
  if (s.artStage === k) s.artStage = null; else if (si > i) s.artStage = ks[si - 1];
  if (!s.artStage || !artOf(s, s.artStage)) { const f = slotsOf(s).find((x) => artOf(s, x.k)); s.artStage = f ? f.k : null; }
  const v = S.viewStage[s.id], vi = ks.indexOf(v);
  if (v === k || vi > i) { if (vi > i) S.viewStage[s.id] = ks[vi - 1]; else delete S.viewStage[s.id]; }
  return {gone: gone || null};
}
const emptyCostumes = (s) => costumeCount(s) > 0 && cosKeys(costumeCount(s)).every((k) => !artOf(s, k));
function toastButtons(msg, btns) {
  const t = $("#toast"); t.textContent = msg + " ";
  btns.forEach(([label, fn]) => {
    const b = document.createElement("button"); b.type = "button"; b.className = "toast-btn"; b.textContent = label;
    b.addEventListener("click", () => { t.classList.remove("show", "has-btn"); fn(); }, {once: true});
    t.appendChild(b);
  });
  t.classList.add("show", "has-btn");
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show", "has-btn"), 10000);
}
const cosRefresh = () => { renderList(); renderDossier(true); renderParties(); };
function removeCostume(id, k) {
  const s = S.servants.find((x) => x.id === id); if (!s || S.readOnly) return;
  const snap = cosSnap(s), label = slotLabel(s, k) || "Costume";
  const res = cosRemoveFrom(s, k); if (!res) return;
  const gone = res.gone;
  S.artConfirm = null; scheduleWrite("servants", s); cosRefresh();
  let undone = false;
  dropLater(isUpload(gone) ? [gone] : [], () => undone);
  const undo = ["Undo", () => { undone = true; cosRestore(snap); cosRefresh(); toast(label + " is back."); }];
  // most servants have no costume: offer to clear every other empty costume slot in one go
  const rest = S.servants.filter((x) => x !== s && emptyCostumes(x));
  const all = ["Every servant (" + rest.length + ")", () => {
    const snaps = rest.map(cosSnap);
    rest.forEach((x) => { x.costumeSlots = 0; const v = S.viewStage[x.id]; if (v && /^c\d*$/.test(v)) delete S.viewStage[x.id]; scheduleWrite("servants", x); });
    cosRefresh();
    toastAction("Removed the empty costume slot from " + plural(rest.length, "more servant") + ".", "Undo", () => { snaps.forEach(cosRestore); cosRefresh(); toast("Their costume slots are back."); });
  }];
  toastButtons((gone ? label + " and its picture removed" : label + " slot removed") + " from " + s.name + ".", rest.length >= 2 ? [undo, all] : [undo]);
}
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest('[data-action="cos-del"]'); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  removeCostume(shownId(), b.dataset.slot);
}, true);

/* ---------- after the servant page draws: costume × buttons and how much the picture shines ---------- */
// like a graded card: the more a servant is grailed, the more their picture shines
function shineOf(s) {
  const lv = num(s.level) || 0, cap = CAPS[s.rarity] || 90;
  return lv >= 120 ? 4 : lv >= 110 ? 3 : lv >= 100 ? 2 : lv > cap ? 1 : 0;
}
const renderDossier19 = renderDossier;
renderDossier = function (force) {
  const r = renderDossier19(force);
  const d = document.getElementById("dossier");
  const s = d && !S.editing ? S.servants.find((v) => v.id === shownId()) : null;
  if (s) {
    const af = d.querySelector(".art-frame:not(.drop)");
    if (af) { af.dataset.shine = String(shineOf(s)); if (af.querySelector(".art-glare") && !af.querySelector(".art-sheen")) af.insertAdjacentHTML("beforeend", `<i class="art-sheen" aria-hidden="true"></i>`); }
    if (S.assets && !S.readOnly) d.querySelectorAll('.stage-list .stage-btn[data-action="stage"]').forEach((btn) => {
      const k = btn.dataset.slot; if (!/^c\d*$/.test(k) || btn.parentElement.classList.contains("cos-cell")) return;
      const cell = document.createElement("span"); cell.className = "cos-cell";
      btn.before(cell); cell.append(btn);
      const nm = slotLabel(s, k) || "Costume", has = !!artOf(s, k);
      cell.insertAdjacentHTML("beforeend", `<button type="button" class="cos-x" data-action="cos-del" data-slot="${esc(k)}" title="${has ? "Remove this costume and its picture" : "Remove this costume slot"}" aria-label="Remove ${esc(nm)}${has ? " and its picture" : ""}">×</button>`);
    });
  }
  return r;
};

/* ---------- recent progress: a change you make in the first seconds after the page opens counts too ---------- */
// the log ignores the page's own setup for 2.5 s; your first click or key press ends that, and the "before" picture is taken right then
const logEarly = () => { try { logInit(); } catch (e) {} if (logMute > Date.now()) logMute = Date.now(); };
document.addEventListener("pointerdown", logEarly, true);
document.addEventListener("keydown", logEarly, true);

/* ---------- a change saved half a second later is no longer lost if you close or reload the page in between ---------- */
function flushWrites() {
  Object.keys(timers).forEach((key) => {
    if (!timers[key]) return;
    clearTimeout(timers[key]); timers[key] = null;
    const col = key.slice(0, key.indexOf("/")), obj = dirty[key];
    if (obj) writeDoc(col, obj);
  });
}
window.addEventListener("pagehide", flushWrites);
document.addEventListener("visibilitychange", () => { if (document.hidden) flushWrites(); });
