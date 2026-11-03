/* ================= 0.50.0-beta: the Saint Graph maker =================
   For servants of your own (made in the Workshop, or not one of NA's): make their four ascension pictures from a
   picture of theirs, in the shape of the game's Saint Graphs (512 × 724). Each stage is that picture (placed with zoom,
   position and a mirror) over a scene drawn here (Chaldea, twilight, a starfield, an inferno …), with a colour, a light
   and effects (sparkles, petals, embers, snow, a magic circle, an aura). "Make all four from this one" builds a rising
   set: plain at Stage 1, the most ornate at Stage 4. A picture with a see-through background looks best; an ordinary
   one works too (the scene then colours it, and the circle and aura go over it).
   Save puts a stage's picture in its place, with Undo. The picture it was made from is kept with the servant (art
   "sg1" … "sg4", which backups, servant files and the clean-ups already count as theirs), and so are the settings
   (s.sgMaker), so the maker opens where you left it. A stage picture it replaced is removed a little later, once
   nothing uses it any more. Everything is drawn on a canvas in this browser when something changes: nothing is sent
   anywhere, and nothing moves on its own. */
const SG_W = 512, SG_H = 724, SG_STAGES = ["1", "2", "3", "4"];
const SG_SCENES = [["chaldea", "Chaldea"], ["twilight", "Twilight"], ["stars", "Starfield"], ["inferno", "Inferno"], ["sakura", "Sakura"], ["ocean", "Ocean"], ["throne", "Throne room"], ["void", "The Void"], ["holy", "Holy light"]];
// [key, name, canvas filter, the tint used where a browser can't filter: [colour, blend, strength]]
const SG_GRADES = [["natural", "As it is", "none", null], ["warm", "Warm", "sepia(.22) saturate(1.15) hue-rotate(-6deg)", ["#ff9a4a", "soft-light", 0.45]],
  ["cool", "Cool", "saturate(1.08) hue-rotate(10deg) brightness(1.03)", ["#4a8cff", "soft-light", 0.4]], ["vivid", "Vivid", "saturate(1.45) contrast(1.08)", ["#ffffff", "overlay", 0.12]],
  ["noir", "Noir", "grayscale(1) contrast(1.18)", ["#808080", "saturation", 1]], ["dusk", "Dusk", "sepia(.32) hue-rotate(-22deg) saturate(1.3) brightness(.96)", ["#c0508a", "soft-light", 0.5]]];
const SG_LIGHTS = [["none", "None"], ["rim", "Rim light"], ["glow", "Glow"], ["rays", "Light rays"]];
const SG_FX = [["sparkle", "Sparkles"], ["petals", "Petals"], ["embers", "Embers"], ["snow", "Snow"], ["circle", "Magic circle"], ["aura", "Aura"]];
// each scene's colours: top, middle, bottom, and its light
const SG_PAL = {chaldea: ["#0b1638", "#1b3270", "#0a1229", "#7cc4ff"], twilight: ["#3b1d5a", "#e0607a", "#f6b26b", "#ffd9a0"], stars: ["#04051a", "#141a4a", "#0a0a24", "#c9d6ff"],
  inferno: ["#1a0505", "#6a1208", "#ff6a1a", "#ffb04a"], sakura: ["#f7dbe6", "#f1b5c9", "#fbeff3", "#ff8fb6"], ocean: ["#06294d", "#1a6fa8", "#7fd0e8", "#e8fbff"],
  throne: ["#1e1206", "#5a3a12", "#20140a", "#f0c86a"], void: ["#060010", "#2a0a4a", "#05000c", "#b48cff"], holy: ["#fff8e6", "#f6e2a8", "#fffdf6", "#ffd36b"]};
const SG = {s: null, stage: "1", cfg: {}, img: {}, files: {}, owner: {}, busy: false, raf: 0, miniT: 0, n: 0};
const sgRand = (seed) => { let a = (seed >>> 0) || 7; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; };
const sgDefault = (st) => ({src: "", zoom: 1, x: 0, y: 0, flip: false, scene: "chaldea", grade: "natural", light: st >= 2 ? "glow" : "none", fx: st >= 3 ? ["sparkle"] : [], amt: 0.6, seed: 1000 + st * 37});
const sgA = (hex, a) => { const r = hexToRgb(hex); return `rgba(${r[0]},${r[1]},${r[2]},${clamp(a, 0, 1).toFixed(3)})`; };
const sgCanvas = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
const SG_FILTER = (() => { try { return typeof document.createElement("canvas").getContext("2d").filter === "string"; } catch (e) { return false; } })();
const sgOneOf = (list, k) => list.some((x) => x[0] === k) ? k : list[0][0];
// settings as they come back from a saved servant (or anything odd), made safe to draw
function sgClean(c, st) {
  const d = sgDefault(st), o = Object.assign({}, d, c && typeof c === "object" ? c : {});
  o.zoom = clamp(num(o.zoom) || 1, 0.6, 2.4); o.x = clamp(num(o.x) || 0, -1, 1); o.y = clamp(num(o.y) || 0, -1, 1); o.flip = !!o.flip;
  o.scene = sgOneOf(SG_SCENES, o.scene); o.grade = sgOneOf(SG_GRADES, o.grade); o.light = sgOneOf(SG_LIGHTS, o.light);
  o.fx = Array.isArray(o.fx) ? o.fx.filter((k) => SG_FX.some((x) => x[0] === k)) : []; o.amt = clamp(num(o.amt) != null ? num(o.amt) : 0.6, 0, 1);
  o.seed = Math.floor(num(o.seed) || d.seed); o.src = typeof o.src === "string" ? o.src : "";
  return o;
}

/* ---------- drawing ---------- */
function sgScene(cx, c, R) {
  const P = SG_PAL[c.scene] || SG_PAL.chaldea, g = cx.createLinearGradient(0, 0, 0, SG_H);
  g.addColorStop(0, P[0]); g.addColorStop(0.55, P[1]); g.addColorStop(1, P[2]);
  cx.fillStyle = g; cx.fillRect(0, 0, SG_W, SG_H);
  const glow = (x, y, r, col, a) => { const rg = cx.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, sgA(col, a)); rg.addColorStop(1, sgA(col, 0)); cx.fillStyle = rg; cx.fillRect(0, 0, SG_W, SG_H); };
  const k = c.scene;
  if (k === "chaldea") {
    glow(SG_W / 2, SG_H * 0.42, 340, P[3], 0.35);
    cx.strokeStyle = sgA(P[3], 0.16); cx.lineWidth = 1;
    for (let y = 0, row = 0; y < SG_H + 20; y += 26, row++) for (let x = row % 2 ? 15 : 0; x < SG_W + 20; x += 30) { cx.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i; cx.lineTo(x + Math.cos(a) * 9, y + Math.sin(a) * 9); } cx.closePath(); cx.stroke(); }
    cx.strokeStyle = sgA(P[3], 0.3); cx.lineWidth = 1.5; [0.2, 0.8].forEach((p) => { cx.beginPath(); cx.moveTo(SG_W * p, 0); cx.lineTo(SG_W * p, SG_H); cx.stroke(); });
  } else if (k === "twilight") {
    glow(SG_W * 0.5, SG_H * 0.62, 160, "#fff1c4", 0.9); glow(SG_W * 0.5, SG_H * 0.62, 380, P[3], 0.4);
    cx.fillStyle = sgA("#2a1236", 0.85); cx.beginPath(); cx.moveTo(0, SG_H * 0.8); for (let x = 0; x <= SG_W; x += 32) cx.lineTo(x, SG_H * (0.76 + R() * 0.06)); cx.lineTo(SG_W, SG_H); cx.lineTo(0, SG_H); cx.fill();
  } else if (k === "stars") {
    glow(SG_W * 0.3, SG_H * 0.3, 260, "#5a3aa8", 0.45); glow(SG_W * 0.75, SG_H * 0.62, 300, "#1a6aa8", 0.4);
    for (let i = 0; i < 220; i++) { cx.fillStyle = sgA("#ffffff", 0.3 + R() * 0.7); const r = R() < 0.06 ? 1.6 : 0.8; cx.beginPath(); cx.arc(R() * SG_W, R() * SG_H, r, 0, 7); cx.fill(); }
  } else if (k === "inferno") {
    glow(SG_W / 2, SG_H * 1.05, 520, P[3], 0.75);
    // tongues of fire, in three layers from dark red at the back to gold at the front
    [["#8a1a08", 0.55, 0.62, 150], ["#ff5a14", 0.36, 0.46, 120], ["#ffc45a", 0.3, 0.3, 90]].forEach(([col, al, tall, wd]) => {
      cx.fillStyle = sgA(col, al);
      for (let x = -wd * 0.3; x < SG_W + wd * 0.5; x += wd * (0.55 + R() * 0.25)) {
        const ht = SG_H * tall * (0.5 + R() * 0.5), sw = (R() - 0.5) * wd * 0.5, w2 = wd / 2;
        cx.beginPath(); cx.moveTo(x - w2, SG_H); cx.bezierCurveTo(x - w2, SG_H - ht * 0.45, x - w2 * 0.2, SG_H - ht * 0.7, x + sw, SG_H - ht);
        cx.bezierCurveTo(x + w2 * 0.3, SG_H - ht * 0.62, x + w2, SG_H - ht * 0.42, x + w2, SG_H); cx.closePath(); cx.fill();
      }
    });
    glow(SG_W / 2, SG_H * 0.15, 300, "#2a0303", 0.5);
  } else if (k === "sakura") {
    glow(SG_W * 0.72, SG_H * 0.2, 300, "#ffffff", 0.7);
    // two branches reaching in from the top corners, in bloom
    [[-10, 1], [SG_W + 10, -1]].forEach(([x0, dir], b) => {
      for (let i = 0; i < 3; i++) {
        const y0 = SG_H * (0.04 + i * 0.07 + b * 0.05), x1 = x0 + dir * SG_W * (0.42 - i * 0.08), y1 = y0 + SG_H * (0.07 + R() * 0.05);
        cx.strokeStyle = sgA("#5a2e3a", 0.6); cx.lineWidth = 6 - i * 1.6; cx.lineCap = "round";
        cx.beginPath(); cx.moveTo(x0, y0); cx.quadraticCurveTo(x0 + dir * SG_W * 0.2, y0 - 14, x1, y1); cx.stroke();
        for (let j = 0; j < 14; j++) { const t = 0.25 + R() * 0.75, bx = x0 + (x1 - x0) * t + (R() - 0.5) * 30, by = y0 + (y1 - y0) * t + (R() - 0.5) * 26, r = 4 + R() * 6;
          cx.fillStyle = sgA(R() < 0.5 ? "#ff9ec0" : "#ffd0e0", 0.75 + R() * 0.25); cx.beginPath(); cx.arc(bx, by, r, 0, 7); cx.fill(); cx.fillStyle = sgA("#ffffff", 0.6); cx.beginPath(); cx.arc(bx, by, r * 0.3, 0, 7); cx.fill(); }
      }
    });
  } else if (k === "ocean") {
    glow(SG_W * 0.5, -40, 420, "#ffffff", 0.55);
    for (let i = 0; i < 7; i++) { cx.fillStyle = sgA("#ffffff", 0.05 + R() * 0.07); cx.beginPath(); const x = R() * SG_W; cx.moveTo(x - 20, 0); cx.lineTo(x + 20, 0); cx.lineTo(x + 140 * (R() - 0.3), SG_H); cx.lineTo(x - 140 * (R() + 0.2), SG_H); cx.fill(); }
    cx.strokeStyle = sgA("#e8fbff", 0.25); cx.lineWidth = 2; for (let y = SG_H * 0.72; y < SG_H; y += 18) { cx.beginPath(); for (let x = 0; x <= SG_W; x += 16) cx.lineTo(x, y + Math.sin(x / 26 + y) * 3); cx.stroke(); }
  } else if (k === "throne") {
    glow(SG_W / 2, SG_H * 0.35, 380, P[3], 0.45);
    cx.fillStyle = sgA("#0c0703", 0.55); [0.06, 0.24, 0.76, 0.94].forEach((p) => cx.fillRect(SG_W * p - 22, 0, 44, SG_H));
    cx.fillStyle = sgA(P[3], 0.18); [0.06, 0.24, 0.76, 0.94].forEach((p) => cx.fillRect(SG_W * p - 22, 0, 4, SG_H));
  } else if (k === "void") {
    glow(SG_W / 2, SG_H * 0.45, 360, P[3], 0.4);
    cx.strokeStyle = sgA(P[3], 0.22); for (let i = 1; i < 9; i++) { cx.lineWidth = 1 + i * 0.3; cx.beginPath(); cx.ellipse(SG_W / 2, SG_H * 0.45, i * 34, i * 20, -0.4, 0, Math.PI * 2); cx.stroke(); }
  } else if (k === "holy") {
    glow(SG_W / 2, SG_H * 0.3, 420, "#ffffff", 0.95); glow(SG_W / 2, SG_H * 0.3, 520, P[3], 0.35);
    cx.save(); cx.translate(SG_W / 2, SG_H * 0.3);
    for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; cx.fillStyle = sgA(P[3], 0.1 + (i % 2) * 0.06); cx.beginPath(); cx.moveTo(0, 0); cx.lineTo(Math.cos(a - 0.05) * 900, Math.sin(a - 0.05) * 900); cx.lineTo(Math.cos(a + 0.05) * 900, Math.sin(a + 0.05) * 900); cx.fill(); }
    cx.strokeStyle = sgA("#e9b94a", 0.45); cx.lineWidth = 2; cx.beginPath(); cx.arc(0, 0, 150, 0, Math.PI * 2); cx.stroke(); cx.lineWidth = 1; cx.beginPath(); cx.arc(0, 0, 162, 0, Math.PI * 2); cx.stroke();
    cx.restore();
  }
}
function sgCircle(cx, col, a) {
  cx.save(); cx.translate(SG_W / 2, SG_H * 0.45); cx.strokeStyle = sgA(col, a);
  [210, 196, 150, 110].forEach((r, i) => { cx.lineWidth = i % 2 ? 1 : 2; cx.beginPath(); cx.arc(0, 0, r, 0, Math.PI * 2); cx.stroke(); });
  cx.lineWidth = 1.5;
  for (let i = 0; i < 7; i++) { const a1 = i / 7 * Math.PI * 2, a2 = (i + 3) / 7 * Math.PI * 2; cx.beginPath(); cx.moveTo(Math.cos(a1) * 196, Math.sin(a1) * 196); cx.lineTo(Math.cos(a2) * 196, Math.sin(a2) * 196); cx.stroke(); }
  for (let i = 0; i < 48; i++) { const a1 = i / 48 * Math.PI * 2, r2 = i % 4 ? 203 : 210; cx.beginPath(); cx.moveTo(Math.cos(a1) * 196, Math.sin(a1) * 196); cx.lineTo(Math.cos(a1) * r2, Math.sin(a1) * r2); cx.stroke(); }
  cx.restore();
}
function sgAura(cx, col, amt) { const rg = cx.createRadialGradient(SG_W / 2, SG_H * 0.5, 30, SG_W / 2, SG_H * 0.5, 330); rg.addColorStop(0, sgA(col, 0.2 + amt * 0.5)); rg.addColorStop(1, sgA(col, 0)); cx.fillStyle = rg; cx.fillRect(0, 0, SG_W, SG_H); }
function sgRays(cx, R, amt) {
  cx.save(); cx.globalCompositeOperation = "screen"; cx.translate(SG_W / 2, -60);
  for (let i = 0; i < 12; i++) { const a = -0.6 + i * 0.11 + R() * 0.04; cx.fillStyle = sgA("#ffffff", 0.05 + amt * 0.09); cx.beginPath(); cx.moveTo(0, 0); cx.lineTo(Math.sin(a - 0.03) * 1000, Math.cos(a - 0.03) * 1000); cx.lineTo(Math.sin(a + 0.03) * 1000, Math.cos(a + 0.03) * 1000); cx.fill(); }
  cx.restore();
}
function sgParticles(cx, kind, n, R, col) {
  for (let i = 0; i < n; i++) {
    const x = R() * SG_W, y = R() * SG_H, s = 0.5 + R();
    cx.save(); cx.translate(x, y); cx.rotate(R() * 6.28);
    if (kind === "sparkle") { const r = 3 + s * 6; cx.fillStyle = sgA(col, 0.3); cx.beginPath(); cx.arc(0, 0, r * 0.8, 0, 7); cx.fill(); cx.fillStyle = sgA("#ffffff", 0.6 + R() * 0.4); cx.beginPath(); cx.moveTo(0, -r); cx.quadraticCurveTo(0, 0, r, 0); cx.quadraticCurveTo(0, 0, 0, r); cx.quadraticCurveTo(0, 0, -r, 0); cx.quadraticCurveTo(0, 0, 0, -r); cx.fill(); }
    else if (kind === "petals") { cx.fillStyle = sgA(R() < 0.5 ? "#ffc1d6" : "#ffe1ea", 0.85); cx.beginPath(); cx.ellipse(0, 0, 7 * s, 4 * s, 0, 0, 7); cx.fill(); }
    else if (kind === "embers") { cx.fillStyle = sgA(R() < 0.5 ? "#ffb04a" : "#ff6a1a", 0.55 + R() * 0.45); cx.beginPath(); cx.arc(0, 0, 1.4 + s * 1.8, 0, 7); cx.fill(); }
    else if (kind === "snow") { cx.fillStyle = sgA("#ffffff", 0.55 + R() * 0.4); cx.beginPath(); cx.arc(0, 0, 1.5 + s * 2.4, 0, 7); cx.fill(); }
    cx.restore();
  }
}
// a soft copy of a card-sized canvas (a filter where the browser has one, else shrunk and stretched back)
function sgBlur(src, px) {
  const o = sgCanvas(SG_W, SG_H), x = o.getContext("2d");
  if (SG_FILTER) { x.filter = "blur(" + px + "px)"; x.drawImage(src, 0, 0); x.filter = "none"; return o; }
  const f = Math.max(2, Math.round(px / 1.5)), sm = sgCanvas(Math.ceil(SG_W / f), Math.ceil(SG_H / f)), y = sm.getContext("2d");
  y.imageSmoothingQuality = "high"; y.drawImage(src, 0, 0, sm.width, sm.height); x.imageSmoothingQuality = "high"; x.drawImage(sm, 0, 0, SG_W, SG_H); return o;
}
// the picture, placed and coloured, on a canvas the size of the card
function sgPic(img, c) {
  const o = sgCanvas(SG_W, SG_H), x = o.getContext("2d"), G = SG_GRADES.find((g) => g[0] === c.grade) || SG_GRADES[0];
  const sc = Math.max(SG_W / img.width, SG_H / img.height) * c.zoom, w = img.width * sc, h = img.height * sc;
  const px = (SG_W - w) / 2 + c.x * SG_W / 2, py = (SG_H - h) / 2 + c.y * SG_H / 2;
  if (SG_FILTER && G[2] !== "none") x.filter = G[2];
  if (c.flip) { x.translate(SG_W, 0); x.scale(-1, 1); x.drawImage(img, SG_W - px - w, py, w, h); } else x.drawImage(img, px, py, w, h);
  x.setTransform(1, 0, 0, 1, 0, 0); x.filter = "none";
  if (!SG_FILTER && G[3]) {
    // no canvas filters here: tint it instead, then cut the tint back to the picture's own shape
    const keep = sgCanvas(SG_W, SG_H); keep.getContext("2d").drawImage(o, 0, 0);
    x.globalAlpha = G[3][2]; x.globalCompositeOperation = G[3][1]; x.fillStyle = G[3][0]; x.fillRect(0, 0, SG_W, SG_H);
    x.globalAlpha = 1; x.globalCompositeOperation = "destination-in"; x.drawImage(keep, 0, 0); x.globalCompositeOperation = "source-over";
  }
  return o;
}
// does the picture have a see-through background? (its corners and edges tell)
const SG_ALPHA = new WeakMap();
function sgSeeThrough(img) {
  if (SG_ALPHA.has(img)) return SG_ALPHA.get(img);
  let t = false;
  try { const c = sgCanvas(24, 24), x = c.getContext("2d"); x.drawImage(img, 0, 0, 24, 24); const d = x.getImageData(0, 0, 24, 24).data; t = [0, 11, 23, 264, 287, 552, 563, 575].some((p) => d[p * 4 + 3] < 200); } catch (e) {}
  SG_ALPHA.set(img, t); return t;
}
// one stage, drawn onto a canvas of the Saint Graph's size
function sgDraw(cv, c) {
  const cx = cv.getContext("2d"), R = sgRand(c.seed), P = SG_PAL[c.scene] || SG_PAL.chaldea, img = SG.img[c.src], fx = new Set(c.fx), amt = c.amt;
  if (cv.width !== SG_W) cv.width = SG_W; if (cv.height !== SG_H) cv.height = SG_H;
  cx.setTransform(1, 0, 0, 1, 0, 0); cx.globalAlpha = 1; cx.globalCompositeOperation = "source-over"; cx.clearRect(0, 0, SG_W, SG_H);
  sgScene(cx, c, R);
  const cut = img ? sgSeeThrough(img) : true;
  // behind them when the picture has a see-through background; over it (as light) when it doesn't
  const back = () => {
    if (fx.has("circle")) sgCircle(cx, P[3], 0.25 + amt * 0.45);
    if (fx.has("aura")) sgAura(cx, P[3], amt);
    if (c.light === "rays") sgRays(cx, R, amt);
  };
  if (cut) back();
  if (img) {
    const pic = sgPic(img, c);
    if (c.light === "rim" && cut) {
      const halo = sgBlur(pic, 9), hx = halo.getContext("2d"); hx.globalCompositeOperation = "source-in"; hx.fillStyle = P[3]; hx.fillRect(0, 0, SG_W, SG_H);
      cx.save(); cx.globalCompositeOperation = "lighter"; cx.globalAlpha = 0.45 + amt * 0.45; cx.drawImage(halo, 0, 0); cx.drawImage(halo, 0, 0); cx.restore();
    }
    cx.drawImage(pic, 0, 0);
    if (c.light === "glow") { cx.save(); cx.globalCompositeOperation = "screen"; cx.globalAlpha = 0.18 + amt * 0.32; cx.drawImage(sgBlur(pic, 14), 0, 0); cx.restore(); }
    if (!cut) {
      // a picture that fills the card: the scene colours it, so stages still differ
      cx.save(); cx.globalAlpha = 0.14 + amt * 0.24; cx.globalCompositeOperation = "soft-light"; sgScene(cx, c, sgRand(c.seed)); cx.restore();
      cx.save(); cx.globalCompositeOperation = "screen"; cx.globalAlpha = 0.75; back(); cx.restore();
      if (c.light === "rim") { [0, SG_W].forEach((ex) => { const g = cx.createLinearGradient(ex, 0, ex ? ex - 90 : 90, 0); g.addColorStop(0, sgA(P[3], 0.35 + amt * 0.4)); g.addColorStop(1, sgA(P[3], 0)); cx.save(); cx.globalCompositeOperation = "screen"; cx.fillStyle = g; cx.fillRect(0, 0, SG_W, SG_H); cx.restore(); }); }
    }
  }
  const n = Math.round(10 + amt * 50);
  ["petals", "snow", "embers", "sparkle"].forEach((k) => { if (fx.has(k)) { cx.save(); if (k === "sparkle" || k === "embers") cx.globalCompositeOperation = "screen"; sgParticles(cx, k, k === "sparkle" ? Math.round(n * 0.5) : n, R, P[3]); cx.restore(); } });
  // a soft vignette, like the game's Saint Graphs
  const vg = cx.createRadialGradient(SG_W / 2, SG_H / 2, SG_H * 0.35, SG_W / 2, SG_H / 2, SG_H * 0.75); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0," + (0.16 + amt * 0.18).toFixed(2) + ")");
  cx.fillStyle = vg; cx.fillRect(0, 0, SG_W, SG_H);
}

/* ---------- which pictures they can start from ---------- */
const sgSv = () => S.servants.find((x) => x.id === SG.s) || null;
function sgSources(s) {
  const out = [], seen = new Set(), made = new Set((s.sgMaker && Array.isArray(s.sgMaker.made)) ? s.sgMaker.made : []);
  const add = (id, t) => { if (id && !seen.has(id)) { seen.add(id); out.push(["id:" + id, t, artSrc(id)]); } };
  // the pictures they were made from come first: those are the ones to make new stages from
  SG_STAGES.forEach((k) => add(artOf(s, "sg" + k), "Your picture for " + slotLabel(s, k)));
  artSlots(s).forEach((x) => { const id = artOf(s, x.k); if (id) add(id, slotLabel(s, x.k) + (made.has(id) ? " (made here)" : " picture")); });
  Object.keys(SG.files).filter((k) => SG.owner[k] === s.id).forEach((k, i) => out.push([k, "Your upload " + (i + 1), ""]));
  // one this window still has open that isn't theirs any more (a picture that was replaced, say)
  SG_STAGES.forEach((k) => { const c = SG.cfg[s.id] && SG.cfg[s.id][k]; if (c && c.src && SG.img[c.src] && !out.some((o) => o[0] === c.src)) out.push([c.src, "An earlier picture", ""]); });
  return out;
}
const sgFirst = (s) => { const m = new Set((s.sgMaker && s.sgMaker.made) || []), l = sgSources(s); const f = l.find((x) => !(x[0].startsWith("id:") && m.has(x[0].slice(3)))); return f ? f[0] : ""; };
function sgCanUse(s) { return !!s && !S.readOnly && !!S.assets && (!!s.custom || !atlasOf(s)); }
function sgLoad(key, url) {
  if (SG.img[key]) return Promise.resolve(SG.img[key]);
  if (!url) return Promise.resolve(null);
  return new Promise((res) => { const im = new Image(); if (/^https?:/.test(url) && !url.startsWith(location.origin)) im.crossOrigin = "anonymous"; im.onload = () => { SG.img[key] = im; res(im); }; im.onerror = () => res(null); im.src = url; });
}

/* ---------- the window ---------- */
const sgDlg = document.createElement("div");
sgDlg.id = "sg-dlg"; sgDlg.className = "pcd sg-dlg"; sgDlg.hidden = true; sgDlg.setAttribute("role", "dialog"); sgDlg.setAttribute("aria-modal", "true"); sgDlg.setAttribute("aria-labelledby", "sg-title");
document.body.appendChild(sgDlg);
let sgBack = null;
function sgOpenFor(id) {
  const s = S.servants.find((x) => x.id === id); if (!sgCanUse(s)) return;
  sgBack = document.activeElement; SG.s = s.id; SG.stage = "1";
  if (!SG.cfg[s.id]) {
    // where they left it last time, if they saved something here before
    const kept = (s.sgMaker && s.sgMaker.cfg) || {};
    SG.cfg[s.id] = {}; SG_STAGES.forEach((k, i) => { const c = sgClean(kept[k], i + 1); if (c.src && !c.src.includes(":")) c.src = "id:" + c.src; if (c.src.startsWith("id:") && !S.urlCache[c.src.slice(3)]) c.src = ""; SG.cfg[s.id][k] = c; });
  }
  const first = sgFirst(s), list = sgSources(s);
  SG_STAGES.forEach((k) => { const c = SG.cfg[s.id][k]; if (!c.src || !list.some((x) => x[0] === c.src)) c.src = first; });
  sgDlg.hidden = false; document.documentElement.classList.add("pcd-on");
  const sh = document.querySelector(".shell"); if (sh) sh.inert = true; const side = document.getElementById("side"); if (side) side.inert = true;
  sgRender();
  Promise.all(list.map((x) => sgLoad(x[0], x[2]))).then(() => { if (!sgDlg.hidden) sgRender(); });
  const x = sgDlg.querySelector(".pcd-x"); if (x) x.focus({preventScroll: true});
}
function sgClose() {
  if (sgDlg.hidden) return;
  sgDlg.hidden = true; sgDlg.innerHTML = ""; document.documentElement.classList.remove("pcd-on");
  cancelAnimationFrame(SG.raf); clearTimeout(SG.miniT);
  const sh = document.querySelector(".shell"); if (sh) sh.inert = false;
  if (typeof uiSync === "function") uiSync(); else { const side = document.getElementById("side"); if (side) side.inert = false; }
  if (sgBack && sgBack.isConnected) sgBack.focus({preventScroll: true}); sgBack = null;
}
const sgCfg = () => SG.cfg[SG.s] && SG.cfg[SG.s][SG.stage];
const sgChips = (attr, label, list, on) => `<div class="sg-chips" role="group" aria-label="${esc(label)}">${list.map((x) => `<button type="button" class="sg-chip" data-sg-${attr}="${x[0]}" aria-pressed="${on(x[0])}">${esc(x[1])}</button>`).join("")}</div>`;
function sgRender() {
  if (sgDlg.hidden) return;
  const s = sgSv(); if (!s) { sgClose(); return; }
  const c = sgCfg(), src = sgSources(s), ready = !!(c.src && SG.img[c.src]), loading = !!c.src && !ready;
  const a = document.activeElement, fk = a && sgDlg.contains(a) ? Object.keys(a.dataset || {}).map((k) => `[data-${k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase())}="${CSS.escape(a.dataset[k])}"]`).join("") : "";
  const scroll = (sgDlg.querySelector(".sg-ctl") || {}).scrollTop || 0, pscroll = (sgDlg.querySelector(".sg-panel") || {}).scrollTop || 0;
  sgDlg.innerHTML = `<div class="pcd-panel sg-panel" tabindex="-1">
    <button type="button" class="pcd-x" data-sg-act="close" aria-label="Close the Saint Graph maker">×</button>
    <header class="sg-head"><p class="pcd-kick">Saint Graph maker</p><h2 id="sg-title" class="pcd-name">${esc(s.name)}</h2></header>
    <div class="sg-tabs" role="tablist" aria-label="Stages">${SG_STAGES.map((k) => `<button type="button" role="tab" class="sg-tab" aria-selected="${k === SG.stage}" tabindex="${k === SG.stage ? 0 : -1}" data-sg-stage="${k}"><canvas class="sg-mini" data-sg-mini="${k}" width="128" height="181" aria-hidden="true"></canvas><span>${esc(slotLabel(s, k))}</span></button>`).join("")}</div>
    <div class="sg-body">
      <figure class="sg-view"><canvas id="sg-cv" width="${SG_W}" height="${SG_H}" role="img" aria-label="${esc(slotLabel(s, SG.stage))}, as it will be saved"></canvas>
        ${!src.length ? `<figcaption class="sg-empty"><b>Start with a picture of ${esc(s.name)}</b><span>Press Upload a picture. A PNG with a see-through background works best.</span></figcaption>` : loading ? `<figcaption class="sg-empty"><span>Opening the picture…</span></figcaption>` : ""}</figure>
      <div class="sg-ctl">
        <section class="sg-grp"><h4>Picture</h4>
          <div class="sg-row">${src.length ? `<select data-sg-src aria-label="Picture for ${esc(slotLabel(s, SG.stage))}">${src.map(([k, t]) => `<option value="${esc(k)}"${k === c.src ? " selected" : ""}>${esc(t)}</option>`).join("")}</select>` : ""}
            <label class="btn sm file-btn">Upload a picture<input type="file" accept="image/png,image/jpeg,image/webp" data-sg-file></label></div>
          <p class="sg-tip">A PNG with a see-through background looks best: the scene shows around them.</p>
          <div class="sg-sliders">
            <label class="sg-sl"><span>Zoom</span><input type="range" min="0.6" max="2.4" step="0.02" value="${c.zoom}" data-sg-num="zoom"></label>
            <label class="sg-sl"><span>Left, right</span><input type="range" min="-1" max="1" step="0.01" value="${c.x}" data-sg-num="x"></label>
            <label class="sg-sl"><span>Up, down</span><input type="range" min="-1" max="1" step="0.01" value="${c.y}" data-sg-num="y"></label>
          </div>
          <div class="sg-row"><label class="sg-ck"><input type="checkbox" data-sg-flip${c.flip ? " checked" : ""}> Mirror</label><button type="button" class="btn ghost sm" data-sg-act="centre">Centre it</button></div></section>
        <section class="sg-grp"><h4>Scene</h4>${sgChips("scene", "Scene", SG_SCENES, (k) => k === c.scene)}</section>
        <section class="sg-grp"><h4>Colour</h4>${sgChips("grade", "Colour", SG_GRADES, (k) => k === c.grade)}</section>
        <section class="sg-grp"><h4>Light</h4>${sgChips("light", "Light", SG_LIGHTS, (k) => k === c.light)}</section>
        <section class="sg-grp"><h4>Effects</h4>${sgChips("fx", "Effects", SG_FX, (k) => c.fx.includes(k))}
          <div class="sg-row"><label class="sg-sl"><span>How strong</span><input type="range" min="0" max="1" step="0.01" value="${c.amt}" data-sg-num="amt"></label><button type="button" class="btn ghost sm" data-sg-act="reroll">Scatter again</button></div></section>
      </div>
    </div>
    <footer class="sg-acts">
      <button type="button" class="btn sm" data-sg-act="all"${ready ? "" : " disabled"} title="Stage 1 plain, then more light and effects at each stage, all from this picture">Make all four from this one</button>
      <span class="sg-grow"></span>
      <button type="button" class="btn ghost sm" data-sg-act="download"${ready ? "" : " disabled"}>Download</button>
      <button type="button" class="btn sm" data-sg-act="save-all"${SG_STAGES.some((k) => SG.img[SG.cfg[s.id][k].src]) && !SG.busy ? "" : " disabled"}>Save all four</button>
      <button type="button" class="btn primary sm" data-sg-act="save"${ready && !SG.busy ? "" : " disabled"}>${SG.busy ? "Saving…" : "Save as " + esc(slotLabel(s, SG.stage))}</button>
    </footer></div>`;
  const ctl = sgDlg.querySelector(".sg-ctl"); if (ctl) ctl.scrollTop = scroll; const pn = sgDlg.querySelector(".sg-panel"); if (pn) pn.scrollTop = pscroll;
  sgPaint(true);
  if (fk) { const f = sgDlg.querySelector(fk); if (f) f.focus({preventScroll: true}); }
}
// the big picture right away; the four small ones a moment after you stop dragging a slider
function sgPaint(minis) {
  cancelAnimationFrame(SG.raf);
  SG.raf = requestAnimationFrame(() => { const cv = document.getElementById("sg-cv"), c = sgCfg(); if (cv && c) sgDraw(cv, c); });
  clearTimeout(SG.miniT);
  SG.miniT = setTimeout(() => {
    const all = SG.cfg[SG.s]; if (!all || sgDlg.hidden) return;
    const off = sgCanvas(SG_W, SG_H);
    sgDlg.querySelectorAll("[data-sg-mini]").forEach((m) => { sgDraw(off, all[m.dataset.sgMini]); const x = m.getContext("2d"); x.clearRect(0, 0, m.width, m.height); x.drawImage(off, 0, 0, m.width, m.height); });
  }, minis ? 30 : 260);
}
const sgBlob = (c) => new Promise((res) => { const cv = sgCanvas(SG_W, SG_H); sgDraw(cv, c); try { cv.toBlob((b) => res(b && b.size ? b : null), "image/webp", 0.92); } catch (e) { res(null); } });
const sgPlain = (c) => { const o = sgClean(c, 1); o.src = o.src.startsWith("id:") ? o.src.slice(3) : ""; return o; };
const sgUsed = () => { const u = new Set(); S.servants.forEach((x) => Object.values(x.art || {}).forEach((v) => u.add(v))); return u; };
const sgDrop = (ids) => { const u = sgUsed(); ids.forEach((id) => { if (/^img_/.test(id) && !u.has(id)) Promise.resolve().then(() => S.assets && S.assets.delete(id)).catch(() => {}); }); };
// a picture as a file again (one that was removed while this window still had it open)
const sgImgBlob = (img) => new Promise((res) => {
  if (!img) { res(null); return; }
  const sc = Math.min(1, 1100 / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height)), cv = sgCanvas(Math.max(1, Math.round((img.naturalWidth || img.width) * sc)), Math.max(1, Math.round((img.naturalHeight || img.height) * sc)));
  try { cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height); cv.toBlob((b) => res(b && b.size ? b : null), "image/webp", 0.92); } catch (e) { res(null); }
});
const sgRekey = (from, to) => Object.values(SG.cfg).forEach((m) => SG_STAGES.forEach((j) => { if (m[j].src === from) m[j].src = to; }));
// the picture a stage is made from, kept with the servant: an upload is stored once, however many stages use it
async function sgKeep(key, fresh, re) {
  if (key.startsWith("id:") && S.urlCache[key.slice(3)]) return key.slice(3);
  const blob = key.startsWith("up:") ? await shrink(SG.files[key]) : await sgImgBlob(SG.img[key]);
  if (!blob) throw {code: "draw"};
  const r = await S.assets.upload(blob, {type: blob.type || "image/png"}); S.urlCache[r.id] = r.url; fresh.push(r.id);
  const nk = "id:" + r.id; SG.img[nk] = SG.img[key]; re.push([key, nk]); sgRekey(key, nk);
  return r.id;
}
// put stage pictures on the servant (with Undo); a picture they replace goes once nothing uses it
async function sgSave(keys) {
  const s = sgSv(); if (!s || SG.busy || !S.assets || S.readOnly) return;
  const all = SG.cfg[s.id], todo = keys.filter((k) => all[k] && SG.img[all[k].src]); if (!todo.length) return;
  SG.busy = true; sgRender();
  const fresh = [], made = {}, from = {}, re = [];
  const undo = () => { re.slice().reverse().forEach(([o, n]) => { sgRekey(n, o); delete SG.img[n]; }); sgDrop(fresh); };
  try {
    for (const k of todo) from[k] = await sgKeep(all[k].src, fresh, re);
    for (const k of todo) {
      const blob = await sgBlob(all[k]); if (!blob) throw {code: "draw"};
      const r = await S.assets.upload(blob, {type: blob.type || "image/png"}); S.urlCache[r.id] = r.url; fresh.push(r.id); made[k] = r.id;
    }
  } catch (e) {
    SG.busy = false; undo();
    if (e && e.code === "draw") toast("This browser couldn't draw that picture. Try a smaller one."); else uploadFailed(e);
    sgRender(); return;
  }
  const cur = sgSv() || s, before = {art: Object.assign({}, cur.art || {}), artStage: cur.artStage, sgMaker: cur.sgMaker ? JSON.parse(JSON.stringify(cur.sgMaker)) : null};
  const art = Object.assign({}, cur.art || {}), kept = Object.assign({}, (cur.sgMaker && cur.sgMaker.cfg) || {});
  todo.forEach((k) => { art[k] = made[k]; art["sg" + k] = from[k]; kept[k] = sgPlain(all[k]); });
  const ids = new Set(Object.values(art));
  cur.art = art; cur.sgMaker = {v: 1, cfg: kept, made: ((cur.sgMaker && cur.sgMaker.made) || []).filter((id) => ids.has(id)).concat(Object.values(made))};
  if (!artOf(cur, cur.artStage)) cur.artStage = todo[0];
  S.viewStage[cur.id] = made[SG.stage] ? SG.stage : todo[0];
  const ok = await writeDoc("servants", cur);
  SG.busy = false;
  if (!ok) { cur.art = before.art; cur.artStage = before.artStage; if (before.sgMaker) cur.sgMaker = before.sgMaker; else delete cur.sgMaker; undo(); sgRender(); return; }
  // an upload is one of their pictures now, so it's listed once, under that name
  re.forEach(([o]) => { if (o.startsWith("up:")) { delete SG.files[o]; delete SG.owner[o]; delete SG.img[o]; } });
  renderList(); renderDossier(); renderParties(); sgRender();
  // the stage pictures these replaced stay while Undo is on offer
  const old = Object.values(before.art).filter((id) => !ids.has(id));
  let undone = false;
  setTimeout(() => { if (!undone) sgDrop(old); }, 20000);
  toastAction((todo.length === 1 ? slotLabel(cur, todo[0]) : todo.length + " stages") + " saved for " + cur.name + ".", "Undo", async () => {
    undone = true;
    const x = S.servants.find((y) => y.id === cur.id); if (!x) return;
    x.art = before.art; x.artStage = before.artStage; if (before.sgMaker) x.sgMaker = before.sgMaker; else delete x.sgMaker;
    // what this save stored goes again; this window still has the pictures, so saving again later stores them again
    if (await writeDoc("servants", x)) { sgDrop(fresh); renderList(); renderDossier(); renderParties(); sgRender(); toast("Back to " + x.name + "'s pictures from before."); }
  });
}
// one picture, a rising set: plain, then a glow, then rays and effects, then the most ornate
function sgAll() {
  const all = SG.cfg[SG.s], c = all[SG.stage], scene = c.scene;
  const alt = {chaldea: "stars", twilight: "holy", stars: "void", inferno: "throne", sakura: "holy", ocean: "stars", throne: "holy", void: "stars", holy: "throne"}[scene] || "stars";
  const theme = {inferno: "embers", sakura: "petals", twilight: "petals", throne: "embers"}[scene] || "sparkle";
  const base = {src: c.src, zoom: c.zoom, x: c.x, y: c.y, flip: c.flip};
  const set = (k, o) => { all[k] = sgClean(Object.assign({}, base, {seed: all[k].seed}, o), Number(k)); };
  set("1", {scene: scene, grade: c.grade, light: "none", fx: [], amt: 0.35});
  set("2", {scene: scene, grade: c.grade, light: "glow", fx: ["aura"], amt: 0.5});
  set("3", {scene: scene, grade: c.grade === "natural" ? "vivid" : c.grade, light: "rays", fx: ["aura", theme], amt: 0.65});
  set("4", {scene: alt, grade: "vivid", light: "rim", fx: Array.from(new Set(["circle", "aura", theme, "sparkle"])), amt: 0.85});
  sgRender(); toast("Four stages made from this picture. Look through them, change what you like, then Save all four.");
}

/* ---------- its buttons ---------- */
sgDlg.addEventListener("click", (e) => {
  if (e.target === sgDlg) { sgClose(); return; }
  const b = e.target.closest("button"); if (!b || b.disabled) return;
  const c = sgCfg(); if (!c) return;
  const d = b.dataset;
  if (d.sgStage) { SG.stage = d.sgStage; sgRender(); return; }
  if (d.sgScene) { c.scene = d.sgScene; sgRender(); return; }
  if (d.sgGrade) { c.grade = d.sgGrade; sgRender(); return; }
  if (d.sgLight) { c.light = d.sgLight; sgRender(); return; }
  if (d.sgFx) { const i = c.fx.indexOf(d.sgFx); if (i >= 0) c.fx.splice(i, 1); else c.fx.push(d.sgFx); sgRender(); return; }
  const a = d.sgAct;
  if (a === "close") sgClose();
  else if (a === "centre") { c.zoom = 1; c.x = 0; c.y = 0; sgRender(); }
  else if (a === "reroll") { c.seed = Math.floor(Math.random() * 1e9); sgRender(); }
  else if (a === "all") sgAll();
  else if (a === "save") sgSave([SG.stage]);
  else if (a === "save-all") sgSave(SG_STAGES.slice());
  else if (a === "download") {
    const s = sgSv(), name = String(s ? s.name : "Saint Graph").replace(/[\\/:*?"<>|]+/g, "").trim() || "Saint Graph";
    sgBlob(c).then((blob) => { if (!blob) { toast("This browser couldn't draw that picture."); return; } (S.downloads || localDownloads).save({filename: name + " - " + slotLabel(s, SG.stage) + (/png/.test(blob.type) ? ".png" : ".webp"), data: blob}); });
  }
});
sgDlg.addEventListener("input", (e) => {
  const t = e.target, c = sgCfg(); if (!c || !t.dataset || t.dataset.sgNum == null) return;
  c[t.dataset.sgNum] = num(t.value); sgPaint(false);
});
sgDlg.addEventListener("change", (e) => {
  const t = e.target, c = sgCfg(); if (!c) return;
  if (t.dataset.sgSrc != null) { c.src = t.value; const s = sgSv(), x = s && sgSources(s).find((y) => y[0] === t.value); sgLoad(t.value, x ? x[2] : "").then(() => sgRender()); sgRender(); }
  else if (t.dataset.sgFlip != null) { c.flip = t.checked; sgPaint(true); }
  else if (t.dataset.sgNum != null) sgPaint(true);
  else if (t.dataset.sgFile != null && t.files && t.files[0]) {
    const f = t.files[0]; t.value = "";
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) { toast("Use a PNG, JPG or WebP picture."); return; }
    if (f.size > 20e6) { toast("That picture is over 20 MB. Use a smaller one."); return; }
    const key = "up:" + (++SG.n), url = URL.createObjectURL(f);
    sgLoad(key, url).then((im) => {
      if (!im) { toast("Couldn't open that picture."); URL.revokeObjectURL(url); return; }
      SG.files[key] = f; SG.owner[key] = SG.s;
      // the stage you're on takes it, and so does any stage that had nothing yet
      SG_STAGES.forEach((k) => { const m = SG.cfg[SG.s][k]; if (k === SG.stage || !m.src || !SG.img[m.src]) m.src = key; });
      sgRender();
    });
  }
});
sgDlg.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { e.stopPropagation(); sgClose(); return; }
  // arrows move between the stage tabs, like any tab list
  const tab = e.target.closest && e.target.closest(".sg-tab");
  if (tab && (e.key === "ArrowRight" || e.key === "ArrowLeft")) { e.preventDefault(); const i = SG_STAGES.indexOf(SG.stage); SG.stage = SG_STAGES[(i + (e.key === "ArrowRight" ? 1 : 3)) % 4]; sgRender(); const n = sgDlg.querySelector(`[data-sg-stage="${SG.stage}"]`); if (n) n.focus(); }
  if (e.key === "Tab") { const f = Array.from(sgDlg.querySelectorAll("button:not([disabled]):not([tabindex='-1']), input, select")).filter((x) => x.offsetParent || x.type === "file"); if (!f.length) return; const first = f[0], last = f[f.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } }
});

/* ---------- the way in: on the servant's page, beside their pictures ---------- */
const renderDossier52 = renderDossier;
renderDossier = function () {
  const r = renderDossier52.apply(this, arguments);
  try {
    const d = document.getElementById("dossier"), s = d && S.editing == null ? S.servants.find((x) => x.id === shownId()) : null;
    const side = s && sgCanUse(s) ? d.querySelector(".art-side") : null;
    if (side && !side.querySelector(".sg-open")) side.insertAdjacentHTML("beforeend", `<button type="button" class="btn sm sg-open" data-action="sg-open" data-id="${esc(s.id)}"><span aria-hidden="true">✦</span> Saint Graph maker</button>`);
  } catch (e) {}
  if (!sgDlg.hidden && !sgSv()) sgClose();
  return r;
};
document.addEventListener("click", (e) => { const b = e.target.closest && e.target.closest('[data-action="sg-open"]'); if (b) { e.preventDefault(); e.stopPropagation(); sgOpenFor(b.dataset.id); } }, true);
