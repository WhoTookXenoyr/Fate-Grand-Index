/* ================= 0.52.0-beta: story scenes =================
   The chapter look used to be one of fourteen moods (embers, snow, petals …) shared by every chapter: up to sixty
   drifting specks, three big glows and a wheel of light. Now each chapter has scenes of its own, drawn from where its
   story takes place, and the scene changes as you move through the chapter: Fuyuki burns and then you stand before the
   Greater Grail's cave; Babylonia's walls give way to the underworld and then to the black sea; Nahui Mictlān goes down
   stratum by stratum, the old scene sliding up as the next comes from below.

   A scene has depth: its rows stand one behind the other in real perspective and a camera moves among them (see
   "depth" below). Each row is a still drawing: a sky, something in it (a sun, a moon, the ring of light of Part 1), three rows of
   silhouettes built from a few generators (ridges, forests, skylines) and a handful of landmarks. It's painted once.
   Only a few small things move over it (a dozen specks, a flicker of heat, a shooting star), which is far less for
   the graphics card than the old look. Which scene shows: the furthest act whose section (or place on the map) you've
   reached, by the names in NA's own data, or else by how far through the chapter you are.

   Everything is drawn in a 1600 x 560 box that sits on the bottom of the window (wider screens see more of the sides,
   phones the middle), with a second box hanging from the top for ceilings and things in the sky. */
const SCX0 = -900, SCX1 = 2500, SCYB = 640;
const scRnd = (seed) => { let s = (seed * 9301 + 49297) % 2147483647; if (s <= 0) s += 2147483646; return () => (s = s * 16807 % 2147483647) / 2147483647; };
const scMix = (a, b, t) => { const A = hexToRgb(a), B = hexToRgb(b); return "#" + [0, 1, 2].map((i) => Math.round(A[i] + (B[i] - A[i]) * t).toString(16).padStart(2, "0")).join(""); };
// colours are written for the dark theme; the light theme gets the same scene washed towards the page's white
const scTone = (c) => isDark() ? c : scMix(c, "#f4f6fb", 0.7);
const scN = (v) => Math.round(v);

/* ---------- generators: one closed outline from the left edge to the right ---------- */
const SCG = {
  hills(seed, y, amp, step) {
    const r = scRnd(seed), pts = []; for (let x = SCX0; x <= SCX1 + step; x += step) pts.push([x, y - amp * r()]);
    let d = `M${SCX0} ${SCYB}L${pts[0][0]} ${scN(pts[0][1])}`;
    for (let i = 1; i < pts.length; i++) { const p = pts[i - 1], q = pts[i]; d += `Q${p[0]} ${scN(p[1])} ${scN((p[0] + q[0]) / 2)} ${scN((p[1] + q[1]) / 2)}`; }
    return d + `L${SCX1} ${SCYB}Z`;
  },
  peaks(seed, y, amp, step) {
    const r = scRnd(seed); let d = `M${SCX0} ${SCYB}L${SCX0} ${y}`, x = SCX0, i = 0;
    while (x < SCX1) { x += step * (0.55 + 0.9 * r()); d += `L${scN(x)} ${scN(y - amp * (i++ % 2 ? 0.08 + 0.25 * r() : 0.5 + 0.5 * r()))}`; }
    return d + `L${SCX1} ${SCYB}Z`;
  },
  pines(seed, y, h, step) {
    const r = scRnd(seed); let d = `M${SCX0} ${SCYB}L${SCX0} ${y}`, x = SCX0;
    while (x < SCX1) { const w = step * (0.7 + 0.6 * r()), hh = h * (0.45 + 0.55 * r()); d += `L${scN(x + w * 0.5)} ${scN(y - hh)}L${scN(x + w)} ${scN(y - hh * 0.12 * r())}`; x += w; }
    return d + `L${SCX1} ${SCYB}Z`;
  },
  // a jungle's roof: small round crowns, now and then a tall one
  canopy(seed, y, amp, step) {
    const r = scRnd(seed); let d = `M${SCX0} ${SCYB}L${SCX0} ${y}`, x = SCX0;
    while (x < SCX1) { const w = step * (0.7 + 0.7 * r()), tall = r() < 0.12 ? 2.6 : 1, hh = amp * tall * (0.5 + 0.5 * r()); d += `Q${scN(x + w * 0.5)} ${scN(y - hh * 1.9)} ${scN(x + w)} ${scN(y - amp * 0.2 * r())}`; x += w; }
    return d + `L${SCX1} ${SCYB}Z`;
  },
  flat(y) { return `M${SCX0} ${y}H${SCX1}V${SCYB}H${SCX0}Z`; },
  // a skyline. kind: modern, ruin, house, edo, dome, onion, spire, block, wall. Returns [outline, lit windows]
  city(seed, y, kind, hmin, hmax, gap) {
    const r = scRnd(seed); let d = `M${SCX0} ${SCYB}L${SCX0} ${y}`, x = SCX0, win = "";
    const wide = {modern: [46, 120], ruin: [50, 130], house: [44, 84], edo: [70, 150], dome: [60, 150], onion: [50, 110], spire: [26, 70], block: [60, 170], wall: [90, 190]}[kind] || [50, 120];
    while (x < SCX1) {
      const w = wide[0] + (wide[1] - wide[0]) * r(), h = hmin + (hmax - hmin) * Math.pow(r(), kind === "spire" ? 0.7 : 1.5), t = y - h, a = x, b = x + w, m = x + w / 2, k = r();
      d += `L${scN(a)} ${scN(y)}`;
      if (kind === "modern") {
        d += `V${scN(t)}`;
        if (k < 0.22) d += `H${scN(m - 3)}V${scN(t - h * 0.22)}H${scN(m + 3)}V${scN(t)}`;
        else if (k < 0.45) d += `H${scN(a + w * 0.2)}V${scN(t - 16)}H${scN(b - w * 0.2)}V${scN(t)}`;
        d += `H${scN(b)}V${scN(y)}`;
        for (let wy = t + 12; wy < y - 10; wy += 15) for (let wx = a + 7; wx < b - 9; wx += 12) if (r() < 0.2) win += `M${scN(wx)} ${scN(wy)}h5v7h-5z`;
      } else if (kind === "ruin") {
        d += `V${scN(t + h * 0.3 * r())}L${scN(a + w * 0.3)} ${scN(t)}L${scN(a + w * 0.55)} ${scN(t + h * 0.25 * r())}L${scN(a + w * 0.8)} ${scN(t + h * 0.1)}L${scN(b)} ${scN(t + h * 0.5 * r())}V${scN(y)}`;
        if (r() < 0.5) win += `M${scN(a + w * 0.3)} ${scN(y - h * 0.4)}h6v9h-6z`;
      } else if (kind === "house") {
        if (k < 0.1) d += `V${scN(t - 30)}L${scN(m)} ${scN(t - 30 - w * 0.9)}L${scN(b)} ${scN(t - 30)}V${scN(y)}`;
        else d += `V${scN(t)}L${scN(m)} ${scN(t - w * 0.42)}L${scN(b)} ${scN(t)}V${scN(y)}`;
        if (r() < 0.45) win += `M${scN(m - 4)} ${scN(y - h * 0.55)}h7v8h-7z`;
      } else if (kind === "edo") {
        if (k < 0.08) { let ty = y; d += `V${scN(y - 14)}`; for (let i = 0; i < 4; i++) { const ww = w * (0.5 - i * 0.08); ty -= 30; d += `L${scN(m - ww * 0.62)} ${scN(ty + 8)}L${scN(m - ww * 0.7)} ${scN(ty + 2)}L${scN(m - ww * 0.4)} ${scN(ty)}`; } d += `L${scN(m)} ${scN(ty - 34)}`; for (let i = 3; i >= 0; i--) { const ww = w * (0.5 - i * 0.08); d += `L${scN(m + ww * 0.4)} ${scN(ty)}L${scN(m + ww * 0.7)} ${scN(ty + 2)}L${scN(m + ww * 0.62)} ${scN(ty + 8)}`; ty += 30; } d += `V${scN(y)}`; }
        else d += `V${scN(t + 8)}L${scN(a - 8)} ${scN(t + 2)}L${scN(a + w * 0.2)} ${scN(t - 12)}H${scN(b - w * 0.2)}L${scN(b + 8)} ${scN(t + 2)}L${scN(b)} ${scN(t + 8)}V${scN(y)}`;
        if (r() < 0.4) win += `M${scN(m - 5)} ${scN(y - 16)}h9v8h-9z`;
      } else if (kind === "dome" || kind === "onion") {
        d += `V${scN(t)}`;
        if (k < 0.4) { const rr = w * (kind === "onion" ? 0.3 : 0.38); d += `H${scN(m - rr)}`; d += kind === "onion" ? `C${scN(m - rr * 1.9)} ${scN(t - rr * 1.5)} ${scN(m - rr * 0.3)} ${scN(t - rr * 1.9)} ${scN(m)} ${scN(t - rr * 3)}C${scN(m + rr * 0.3)} ${scN(t - rr * 1.9)} ${scN(m + rr * 1.9)} ${scN(t - rr * 1.5)} ${scN(m + rr)} ${scN(t)}` : `A${scN(rr)} ${scN(rr)} 0 0 1 ${scN(m + rr)} ${scN(t)}`; }
        else if (k < 0.6) d += `L${scN(m)} ${scN(t - w * 0.28)}L${scN(b)} ${scN(t)}`;
        d += `H${scN(b)}V${scN(y)}`;
        if (r() < 0.4) win += `M${scN(m - 3)} ${scN(y - h * 0.5)}h6v10h-6z`;
      } else if (kind === "spire") {
        d += `V${scN(t + h * 0.2)}L${scN(m)} ${scN(t)}L${scN(b)} ${scN(t + h * 0.2)}V${scN(y)}`;
        if (r() < 0.5) win += `M${scN(m - 2)} ${scN(t + h * 0.4)}h4v${scN(h * 0.3)}h-4z`;
      } else if (kind === "wall") {
        d += `V${scN(t)}`; for (let cx = a; cx < b - 8; cx += 16) d += `H${scN(cx + 8)}V${scN(t + 8)}H${scN(Math.min(b, cx + 16))}V${scN(t)}`;
        d += `V${scN(y)}`;
        if (k < 0.3) { d += `M${scN(b - 14)} ${scN(y)}V${scN(t - 46)}L${scN(b + 4)} ${scN(t - 86)}L${scN(b + 22)} ${scN(t - 46)}V${scN(y)}Z`; }
      } else d += `V${scN(t)}H${scN(b)}V${scN(y)}`;
      x = b + (gap || 0) * r();
    }
    return [d + `L${SCX1} ${SCYB}Z`, win];
  }
};

/* ---------- landmarks: each returns one or more {d, f (fill), s (stroke), w (stroke width), o (opacity), eo (even-odd)} ----------
   Local coordinates: x to the right, y upwards from the landmark's foot; placed at (x, y) and scaled by k. */
const scPoly = (x, y, k, pts) => "M" + pts.map((p) => scN(x + p[0] * k) + " " + scN(y - p[1] * k)).join("L") + "Z";
const scCirc = (cx, cy, r) => `M${scN(cx - r)} ${scN(cy)}a${scN(r)} ${scN(r)} 0 1 0 ${scN(r * 2)} 0a${scN(r)} ${scN(r)} 0 1 0 ${scN(-r * 2)} 0Z`;
const scRect = (x, y, k, a, b, w, h) => `M${scN(x + a * k)} ${scN(y - b * k)}h${scN(w * k)}v${scN(-h * k)}h${scN(-w * k)}Z`;
const SCP = {
  // a tower: flat, cone, spire, dome or onion on top
  tower(x, y, k, c, w, h, top) {
    let d = scRect(x, y, k, -w / 2, 0, w, h);
    if (top === "cone") d += scPoly(x, y, k, [[-w / 2 - 4, h], [0, h + w * 1.3], [w / 2 + 4, h]]);
    else if (top === "spire") d += scPoly(x, y, k, [[-w / 2, h], [0, h + w * 3.2], [w / 2, h]]);
    else if (top === "dome") d += scCirc(x, y - h * k, w / 2 * k);
    else if (top === "onion") d += scCirc(x, y - (h + w * 0.42) * k, w * 0.56 * k) + scPoly(x, y, k, [[-w * 0.16, h + w * 0.8], [0, h + w * 1.7], [w * 0.16, h + w * 0.8]]);
    else d += scRect(x, y, k, -w / 2 - 4, h, w + 8, 10);
    return [{d: d, f: c}];
  },
  bigben(x, y, k, c, lit) {
    return [{d: scRect(x, y, k, -26, 0, 52, 300) + scRect(x, y, k, -32, 300, 64, 62) + scPoly(x, y, k, [[-32, 362], [0, 470], [32, 362]]) + scRect(x, y, k, -2, 470, 4, 26)
      + scRect(x, y, k, -420, 0, 380, 96) + [-400, -330, -260, -190, -120, -60].map((a) => scPoly(x, y, k, [[a - 9, 96], [a, 150], [a + 9, 96]])).join("") + scRect(x, y, k, -440, 0, 44, 170) + scPoly(x, y, k, [[-440, 170], [-418, 236], [-396, 170]]), f: c},
      {d: scCirc(x, y - 331 * k, 20 * k), f: lit, o: 0.85}];
  },
  ziggurat(x, y, k, c, lit) {
    return [{d: scPoly(x, y, k, [[-230, 0], [-196, 58], [196, 58], [230, 0]]) + scPoly(x, y, k, [[-160, 58], [-134, 108], [134, 108], [160, 58]]) + scPoly(x, y, k, [[-100, 108], [-82, 150], [82, 150], [100, 108]]) + scRect(x, y, k, -40, 150, 80, 34), f: c},
      {d: scPoly(x, y, k, [[-16, 0], [-8, 150], [8, 150], [16, 0]]), f: lit, o: 0.35}];
  },
  pyramid(x, y, k, c, lit) { return [{d: scPoly(x, y, k, [[-210, 0], [0, 170], [210, 0]]), f: c}].concat(lit ? [{d: scCirc(x, y - 172 * k, 9 * k), f: lit, o: 0.9}] : []); },
  // a temple front: columns under a lintel and a pediment
  temple(x, y, k, c) {
    let d = scRect(x, y, k, -110, 0, 220, 10) + scRect(x, y, k, -104, 96, 208, 16) + scPoly(x, y, k, [[-112, 112], [0, 152], [112, 112]]);
    for (let i = 0; i < 6; i++) d += scRect(x, y, k, -98 + i * 37, 10, 12, 86);
    return [{d: d, f: c}];
  },
  // arches on piers (an aqueduct): the openings are cut out
  aqueduct(x, y, k, c, n) {
    let d = scRect(x, y, k, 0, 0, n * 70, 120);
    for (let i = 0; i < n; i++) { const a = x + (i * 70 + 12) * k, w = 46 * k; d += `M${scN(a)} ${scN(y)}V${scN(y - 62 * k)}a${scN(w / 2)} ${scN(w / 2)} 0 0 1 ${scN(w)} 0V${scN(y)}Z`; }
    return [{d: d, f: c, eo: 1}];
  },
  colosseum(x, y, k, c, lit) {
    let d = `M${scN(x - 230 * k)} ${scN(y)}V${scN(y - 120 * k)}Q${scN(x)} ${scN(y - 168 * k)} ${scN(x + 230 * k)} ${scN(y - 130 * k)}L${scN(x + 230 * k)} ${scN(y - 80 * k)}L${scN(x + 180 * k)} ${scN(y - 60 * k)}V${scN(y)}Z`, w = "";
    for (let row = 0; row < 3; row++) for (let i = 0; i < 12 - row; i++) { const a = x + (-212 + i * 36 + row * 6) * k, b = y - (14 + row * 38) * k; if (a < x + 170 * k) w += `M${scN(a)} ${scN(b)}v${scN(-16 * k)}a${scN(8 * k)} ${scN(8 * k)} 0 0 1 ${scN(16 * k)} 0v${scN(16 * k)}Z`; }
    return [{d: d, f: c}, {d: w, f: lit, o: 0.3}];
  },
  torii(x, y, k, c) {
    return [{d: scPoly(x, y, k, [[-58, 0], [-50, 118], [-40, 118], [-46, 0]]) + scPoly(x, y, k, [[58, 0], [50, 118], [40, 118], [46, 0]]) + scRect(x, y, k, -62, 84, 124, 9) + scPoly(x, y, k, [[-84, 122], [-78, 108], [78, 108], [84, 122], [70, 130], [-70, 130]]), f: c}];
  },
  pagoda(x, y, k, c) {
    let d = scRect(x, y, k, -3, 0, 6, 330);
    for (let i = 0; i < 5; i++) { const w = 74 - i * 10, b = i * 52; d += scRect(x, y, k, -w * 0.5, b, w, 38) + scPoly(x, y, k, [[-w - 4, b + 36], [-w * 0.9, b + 42], [-w * 0.5, b + 54], [w * 0.5, b + 54], [w * 0.9, b + 42], [w + 4, b + 36]]); }
    return [{d: d, f: c}];
  },
  // a Japanese castle keep on its stone foot
  keep(x, y, k, c) {
    let d = scPoly(x, y, k, [[-130, 0], [-96, 70], [96, 70], [130, 0]]);
    for (let i = 0; i < 4; i++) { const w = 92 - i * 18, b = 70 + i * 44; d += scRect(x, y, k, -w * 0.8, b, w * 1.6, 30) + scPoly(x, y, k, [[-w - 12, b + 28], [-w, b + 36], [-w * 0.5, b + 48], [w * 0.5, b + 48], [w, b + 36], [w + 12, b + 28]]); }
    return [{d: d + scPoly(x, y, k, [[-22, 246], [0, 282], [22, 246]]), f: c}];
  },
  ship(x, y, k, c, sail) {
    return [{d: scPoly(x, y, k, [[-96, 0], [-112, 34], [-70, 26], [70, 26], [118, 44], [86, 0]]) + scRect(x, y, k, -52, 26, 5, 150) + scRect(x, y, k, 6, 26, 5, 186) + scRect(x, y, k, 58, 26, 4, 126) + scPoly(x, y, k, [[118, 44], [170, 62], [116, 38]]), f: c},
      {d: scPoly(x, y, k, [[-88, 60], [-84, 150], [-16, 150], [-12, 60]]) + scPoly(x, y, k, [[-30, 84], [-26, 196], [50, 196], [54, 84]]) + scPoly(x, y, k, [[36, 66], [40, 140], [92, 140], [96, 66]]), f: sail || c, o: sail ? 0.8 : 1}];
  },
  // a tree so tall its top is out of sight: a Fantasy Tree
  greatTree(x, y, k, c, glow) {
    const b = (x1, y1, cx, cy, x2, y2, w) => ({d: `M${scN(x + x1 * k)} ${scN(y - y1 * k)}Q${scN(x + cx * k)} ${scN(y - cy * k)} ${scN(x + x2 * k)} ${scN(y - y2 * k)}`, s: c, w: w * k});
    return [{d: scPoly(x, y, k, [[-70, 0], [-44, 300], [-34, 700], [-30, 1500], [30, 1500], [34, 700], [44, 300], [70, 0]]), f: c},
      b(-36, 520, -200, 640, -420, 600, 16), b(36, 430, 220, 560, 470, 500, 18), b(-34, 760, -180, 900, -380, 980, 12), b(34, 700, 200, 860, 420, 900, 12), b(-30, 980, -120, 1100, -260, 1260, 9), b(30, 940, 140, 1080, 300, 1200, 9)]
      .concat(glow ? [{d: scRect(x, y, k, -5, 0, 10, 1500), f: glow, o: 0.35}] : []);
  },
  deadTree(x, y, k, c) {
    const b = (x1, y1, x2, y2, w) => ({d: `M${scN(x + x1 * k)} ${scN(y - y1 * k)}L${scN(x + x2 * k)} ${scN(y - y2 * k)}`, s: c, w: w * k});
    return [{d: scPoly(x, y, k, [[-9, 0], [-5, 120], [5, 120], [9, 0]]), f: c}, b(0, 70, -50, 130, 5), b(-50, 130, -74, 150, 3), b(-30, 108, -34, 150, 3), b(0, 96, 46, 150, 5), b(46, 150, 80, 160, 3), b(26, 124, 28, 172, 3), b(0, 118, -14, 186, 4), b(0, 118, 18, 190, 3)];
  },
  // a flock: birds, crows, wyverns or bats, scattered in a box of the sky
  flock(x, y, k, c, n, seed, w, h) {
    const r = scRnd(seed || 5); let d = "";
    for (let i = 0; i < n; i++) { const a = x + (r() - 0.5) * w, b = y - r() * h, s = k * (0.6 + 0.8 * r()); d += scPoly(a, b, s, [[-16, 2], [-9, 9], [-3, 3], [0, 6], [3, 3], [9, 9], [16, 2], [8, 4], [3, -1], [0, 1], [-3, -1], [-8, 4]]); }
    return [{d: d, f: c}];
  },
  // the gun tower of Shinjuku
  barrel(x, y, k, c, lit) {
    return [{d: scPoly(x, y, k, [[-44, 0], [-34, 420], [34, 420], [44, 0]]) + scPoly(x, y, k, [[-52, 420], [-52, 456], [52, 456], [52, 420]]) + scPoly(x, y, k, [[-10, 456], [60, 640], [84, 630], [26, 456]]), f: c},
      {d: [80, 170, 260, 350].map((b) => scRect(x, y, k, -30, b, 60, 4)).join(""), f: lit, o: 0.5}];
  },
  // Chaldea: a dome on the ice
  chaldea(x, y, k, c, lit) {
    return [{d: scRect(x, y, k, -190, 0, 380, 46) + `M${scN(x - 110 * k)} ${scN(y - 46 * k)}a${scN(110 * k)} ${scN(96 * k)} 0 0 1 ${scN(220 * k)} 0Z` + scRect(x, y, k, 130, 46, 6, 120) + scRect(x, y, k, -150, 46, 60, 26), f: c},
      {d: [-150, -90, -30, 30, 90, 150].map((a) => scRect(x, y, k, a - 8, 16, 16, 8)).join(""), f: lit, o: 0.7}];
  },
  // the Storm Border, in the sky
  border(x, y, k, c, lit) {
    return [{d: scPoly(x, y, k, [[-150, 0], [-90, 26], [60, 30], [150, 8], [70, -10], [-100, -12]]) + scPoly(x, y, k, [[-20, 28], [0, 52], [40, 30]]) + scPoly(x, y, k, [[-150, 0], [-196, 30], [-120, 12]]), f: c},
      {d: scRect(x, y, k, -60, 6, 90, 4), f: lit, o: 0.7}];
  },
  // a Demon God Pillar
  pillar(x, y, k, c, lit) {
    const pts = []; for (let i = 0; i <= 12; i++) pts.push([-36 + i * 1.6 + (i % 2 ? -7 : 5), i * 46]); for (let i = 12; i >= 0; i--) pts.push([36 - i * 1.6 + (i % 2 ? 7 : -5), i * 46]);
    return [{d: scPoly(x, y, k, pts), f: c}, {d: [90, 190, 300, 410, 500].map((b, i) => scCirc(x + (i % 2 ? 8 : -8) * k, y - b * k, 9 * k)).join(""), f: lit, o: 0.85}];
  },
  // an Indian temple tower
  shikhara(x, y, k, c) {
    return [{d: scRect(x, y, k, -70, 0, 140, 50) + `M${scN(x - 56 * k)} ${scN(y - 50 * k)}Q${scN(x - 50 * k)} ${scN(y - 190 * k)} ${scN(x - 8 * k)} ${scN(y - 250 * k)}H${scN(x + 8 * k)}Q${scN(x + 50 * k)} ${scN(y - 190 * k)} ${scN(x + 56 * k)} ${scN(y - 50 * k)}Z` + scCirc(x, y - 258 * k, 13 * k) + scRect(x, y, k, -2, 268, 4, 26), f: c}];
  },
  // squares of nothing, where the world is being taken apart
  cubes(x, y, k, c, n, seed, w, h) {
    const r = scRnd(seed || 9); let d = "";
    for (let i = 0; i < n; i++) { const s = (10 + 34 * r()) * k; d += `M${scN(x + (r() - 0.5) * w)} ${scN(y - r() * h)}h${scN(s)}v${scN(s)}h${scN(-s)}Z`; }
    return [{d: d, f: c, o: 0.5}];
  },
  // ORT: a disc on legs of crystal
  ort(x, y, k, c, lit) {
    let d = `M${scN(x - 190 * k)} ${scN(y - 250 * k)}Q${scN(x)} ${scN(y - 330 * k)} ${scN(x + 190 * k)} ${scN(y - 250 * k)}Q${scN(x)} ${scN(y - 200 * k)} ${scN(x - 190 * k)} ${scN(y - 250 * k)}Z`;
    [[-150, -250, -250], [-90, -160, -140], [-30, -40, -30], [30, 50, 40], [90, 170, 150], [150, 260, 240]].forEach((l) => { d += scPoly(x, y, k, [[l[0] - 10, 236], [l[1], 110], [l[2], 0], [l[1] + 12, 116], [l[0] + 10, 236]]); });
    return [{d: d, f: c}, {d: scCirc(x, y - 262 * k, 26 * k), f: lit, o: 0.8}];
  },
  crystals(x, y, k, c, n, seed, w) {
    const r = scRnd(seed || 3); let d = "";
    for (let i = 0; i < n; i++) { const a = (r() - 0.5) * w, h = 60 + 240 * r(), ww = 8 + 16 * r(), lean = (r() - 0.5) * 40; d += scPoly(x, y, k, [[a - ww, 0], [a + lean, h], [a + ww, 0]]); }
    return [{d: d, f: c, o: 0.75}];
  },
  // a needle of a tower, and a sail of a hotel beside it
  needle(x, y, k, c, lit) {
    return [{d: scPoly(x, y, k, [[-30, 0], [-26, 210], [-17, 350], [-10, 450], [-4, 540], [0, 640], [4, 540], [10, 450], [17, 350], [26, 210], [30, 0]]), f: c},
      {d: [60, 120, 180, 240, 300, 360].map((b) => scRect(x, y, k, -3, b, 6, 30)).join(""), f: lit, o: 0.6}];
  },
  sail(x, y, k, c) { return [{d: `M${scN(x - 46 * k)} ${scN(y)}V${scN(y - 190 * k)}Q${scN(x + 70 * k)} ${scN(y - 150 * k)} ${scN(x + 64 * k)} ${scN(y)}Z` + scRect(x, y, k, -50, 190, 4, 40), f: c}]; },
  wheel(x, y, k, c) {
    let d = ""; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 8; d += `M${scN(x - Math.cos(a) * 90 * k)} ${scN(y - (120 - Math.sin(a) * 90) * k)}L${scN(x + Math.cos(a) * 90 * k)} ${scN(y - (120 + Math.sin(a) * 90) * k)}`; }
    return [{d: scCirc(x, y - 120 * k, 90 * k), s: c, w: 5 * k}, {d: d, s: c, w: 1.6 * k}, {d: scPoly(x, y, k, [[-50, 0], [-4, 120], [4, 120], [50, 0], [40, 0], [0, 100], [-40, 0]]), f: c}];
  },
  palm(x, y, k, c) {
    const f = (dx, dy) => ({d: `M${scN(x + 14 * k)} ${scN(y - 150 * k)}Q${scN(x + (14 + dx * 0.5) * k)} ${scN(y - (150 + dy + 26) * k)} ${scN(x + (14 + dx) * k)} ${scN(y - (150 + dy) * k)}`, s: c, w: 6 * k});
    return [{d: `M${scN(x)} ${scN(y)}Q${scN(x + 4 * k)} ${scN(y - 90 * k)} ${scN(x + 14 * k)} ${scN(y - 150 * k)}`, s: c, w: 9 * k}, f(-70, -6), f(-48, 22), f(70, -10), f(52, 20), f(4, 36), f(-80, -34), f(84, -36)];
  },
  // a school with a clock
  school(x, y, k, c, lit) {
    let w = ""; for (let i = 0; i < 9; i++) for (let j = 0; j < 3; j++) if (i !== 4) w += scRect(x, y, k, -206 + i * 46, 14 + j * 30, 26, 14);
    return [{d: scRect(x, y, k, -220, 0, 440, 104) + scRect(x, y, k, -34, 104, 68, 76) + scPoly(x, y, k, [[-40, 180], [0, 206], [40, 180]]) + scRect(x, y, k, -1.5, 206, 3, 34), f: c}, {d: w, f: lit, o: 0.35}, {d: scCirc(x, y - 146 * k, 18 * k), f: lit, o: 0.85}];
  },
  // a hall with a sweeping roof on a high platform (a Chinese palace)
  palace(x, y, k, c) {
    return [{d: scPoly(x, y, k, [[-260, 0], [-236, 56], [236, 56], [260, 0]]) + scRect(x, y, k, -190, 56, 380, 70) + scPoly(x, y, k, [[-250, 122], [-226, 134], [-150, 176], [150, 176], [226, 134], [250, 122], [236, 146], [0, 206], [-236, 146]])
      + scRect(x, y, k, -110, 176, 220, 36) + scPoly(x, y, k, [[-150, 208], [-132, 218], [-80, 250], [80, 250], [132, 218], [150, 208], [0, 276]]), f: c}];
  },
  // a castle of many spires behind a wall
  castle(x, y, k, c, lit) {
    let d = scRect(x, y, k, -330, 0, 660, 90);
    for (let i = 0; i < 20; i++) d += scRect(x, y, k, -330 + i * 33, 90, 17, 12);
    [[-250, 46, 190], [-150, 40, 300], [-60, 54, 420], [20, 44, 520], [100, 50, 380], [190, 40, 280], [270, 46, 200]].forEach((t) => { d += scRect(x, y, k, t[0] - t[1] / 2, 0, t[1], t[2]) + scPoly(x, y, k, [[t[0] - t[1] / 2 - 5, t[2]], [t[0], t[2] + t[1] * 2.2], [t[0] + t[1] / 2 + 5, t[2]]]); });
    return [{d: d, f: c}].concat(lit ? [{d: [[-60, 300], [20, 380], [100, 260], [-150, 200]].map((p) => scRect(x, y, k, p[0] - 4, p[1], 8, 16)).join(""), f: lit, o: 0.7}] : []);
  },
  bellTower(x, y, k, c, lit) {
    return [{d: scRect(x, y, k, -32, 0, 64, 230) + scPoly(x, y, k, [[-38, 230], [0, 320], [38, 230]]) + `M${scN(x - 14 * k)} ${scN(y - 170 * k)}V${scN(y - 204 * k)}a${scN(14 * k)} ${scN(14 * k)} 0 0 1 ${scN(28 * k)} 0V${scN(y - 170 * k)}Z`, f: c, eo: 1},
      {d: scCirc(x, y - 186 * k, 8 * k), f: lit, o: 0.9}];
  },
  // the two horns of the sea of life, rising over the horizon
  horns(x, y, k, c) {
    const h = (m) => `M${scN(x + m * 150 * k)} ${scN(y)}Q${scN(x + m * 330 * k)} ${scN(y - 240 * k)} ${scN(x + m * 250 * k)} ${scN(y - 520 * k)}Q${scN(x + m * 250 * k)} ${scN(y - 250 * k)} ${scN(x + m * 60 * k)} ${scN(y)}Z`;
    return [{d: h(-1) + h(1) + `M${scN(x - 170 * k)} ${scN(y)}Q${scN(x)} ${scN(y - 150 * k)} ${scN(x + 170 * k)} ${scN(y)}Z`, f: c}];
  },
  // a shaft of light from the sky
  beam(x, y, k, c, w) { return [{d: scRect(x, y, 1, -w * 2.4, 0, w * 4.8, 1700), f: c, o: 0.14}, {d: scRect(x, y, 1, -w * 1.1, 0, w * 2.2, 1700), f: c, o: 0.26}, {d: scRect(x, y, 1, -w * 0.3, 0, w * 0.6, 1700), f: "#ffffff", o: 0.75}]; },
  // rings going down: a pit, or the eye of a whirlpool
  pit(x, y, k, c, lit) {
    return [0, 1, 2, 3].map((i) => ({d: `M${scN(x - (260 - i * 56) * k)} ${scN(y - i * 5 * k)}a${scN((260 - i * 56) * k)} ${scN((46 - i * 9) * k)} 0 1 0 ${scN((520 - i * 112) * k)} 0a${scN((260 - i * 56) * k)} ${scN((46 - i * 9) * k)} 0 1 0 ${scN(-(520 - i * 112) * k)} 0Z`, f: i === 3 ? c : null, s: i === 3 ? null : lit, w: 2.4, o: i === 3 ? 1 : 0.45}));
  },
  // lights in a row: lanterns, lamps, windows
  lights(x, y, k, c, n, seed, w, h) {
    const r = scRnd(seed || 4); let d = "";
    for (let i = 0; i < n; i++) d += scCirc(x + (r() - 0.5) * w, y - r() * h, (2.5 + 2.5 * r()) * k);
    return [{d: d, f: c, o: 0.85}];
  },
  // swords and spears left standing in the ground
  blades(x, y, k, c, n, seed, w) {
    const r = scRnd(seed || 6), out = [];
    for (let i = 0; i < n; i++) { const a = x + (r() - 0.5) * w, h = (40 + 70 * r()) * k, lean = (r() - 0.5) * 30 * k; out.push(`M${scN(a)} ${scN(y)}L${scN(a + lean)} ${scN(y - h)}M${scN(a + lean * 0.72 - 8 * k)} ${scN(y - h * 0.74)}L${scN(a + lean * 0.72 + 8 * k)} ${scN(y - h * 0.7)}`); }
    return [{d: out.join(""), s: c, w: 2.6 * k}];
  },
  banner(x, y, k, c, flag) { return [{d: scRect(x, y, k, -2, 0, 4, 190), f: c}, {d: scPoly(x, y, k, [[2, 186], [70, 172], [58, 150], [74, 126], [2, 116]]), f: flag, o: 0.8}]; },
  // nine tails of light
  tails(x, y, k, c) {
    return Array.from({length: 9}, (_, i) => { const a = (-64 + i * 16) * Math.PI / 180, L = 560 * k; return {d: `M${scN(x)} ${scN(y)}Q${scN(x + Math.sin(a) * L * 0.4)} ${scN(y - L * 0.72)} ${scN(x + Math.sin(a) * L * 1.5)} ${scN(y - Math.cos(a) * L)}`, s: c, w: (16 - Math.abs(i - 4) * 2) * k, o: 0.42}; });
  },
  // a floor of lines running to the horizon
  grid(x, y, k, c) {
    let d = ""; for (let i = -14; i <= 14; i++) d += `M${scN(x + i * 34)} ${scN(y)}L${scN(x + i * 260)} ${SCYB}`;
    for (let j = 0; j < 7; j++) d += `M${SCX0} ${scN(y + 6 + j * j * 5.4)}H${SCX1}`;
    return [{d: d, s: c, w: 1.4, o: 0.5}];
  },
  // a ridge of rock with a hole of light: a cave mouth
  cave(x, y, k, c, lit) { return [{d: `M${scN(x - 150 * k)} ${scN(y)}Q${scN(x - 130 * k)} ${scN(y - 230 * k)} ${scN(x)} ${scN(y - 250 * k)}Q${scN(x + 130 * k)} ${scN(y - 230 * k)} ${scN(x + 150 * k)} ${scN(y)}Z`, f: lit, o: 0.22}, {d: `M${scN(x - 90 * k)} ${scN(y)}Q${scN(x - 80 * k)} ${scN(y - 150 * k)} ${scN(x)} ${scN(y - 168 * k)}Q${scN(x + 80 * k)} ${scN(y - 150 * k)} ${scN(x + 90 * k)} ${scN(y)}Z`, f: lit, o: 0.4}]; },
  // huts with smoke
  huts(x, y, k, c, n, seed, w) {
    const r = scRnd(seed || 8), out = []; let d = "";
    for (let i = 0; i < n; i++) { const a = (r() - 0.5) * w, s = 0.7 + 0.5 * r(); d += scPoly(x + a * k, y, k * s, [[-34, 0], [-34, 30], [-44, 30], [0, 70], [44, 30], [34, 30], [34, 0]]); out.push({d: `M${scN(x + (a + 14) * k)} ${scN(y - 60 * k * s)}q${scN(14 * k)} ${scN(-40 * k)} ${scN(-6 * k)} ${scN(-80 * k)}`, s: c, w: 5 * k, o: 0.4}); }
    return [{d: d, f: c}].concat(out);
  }
};
/* ---------- things in the sky, drawn in the box that hangs from the top (y downwards from the top of the window) ---------- */
const SCK = {
  // the band of light over every Singularity of Part 1
  ring(c) { return [{d: `M-160 250a960 150 -8 1 0 1920 -270a960 150 -8 1 0 -1920 270Z`, s: c, w: 22, o: 0.1}, {d: `M-160 250a960 150 -8 1 0 1920 -270a960 150 -8 1 0 -1920 270Z`, s: c, w: 5, o: 0.6}]; },
  // the wall that runs round the sky of the Qin
  wall(c) { return [{d: `M${SCX0} 330Q800 30 ${SCX1} 330`, s: c, w: 14, o: 0.55}, {d: `M${SCX0} 318Q800 18 ${SCX1} 318`, s: c, w: 5, o: 0.55, dash: "16 12"}]; },
  aurora(c, c2) {
    const band = (y, a, col, o) => ({d: `M${SCX0} ${y}Q200 ${y - a} 800 ${y + a * 0.4}T${SCX1} ${y - a * 0.3}V${y + 150}Q1400 ${y + 150 + a * 0.5} 800 ${y + 190}T${SCX0} ${y + 160}Z`, f: col, o: o});
    return [band(120, 70, c, 0.2), band(210, -60, c2 || c, 0.16), band(60, 40, c2 || c, 0.1)];
  },
  // a roof of rock with hanging stone: underground
  ceiling(c, seed, depth) {
    const r = scRnd(seed || 2); let d = `M${SCX0} -40L${SCX0} ${depth * 0.5}`, x = SCX0;
    while (x < SCX1) { x += 40 + 110 * r(); d += `L${scN(x)} ${scN(depth * (0.25 + 0.75 * r()))}L${scN(x + 16 + 30 * r())} ${scN(depth * 0.2 * r())}`; }
    return [{d: d + `L${SCX1} -40Z`, f: c}];
  },
  // lamps of the underworld, hung from above
  cages(c, lit, seed) {
    const r = scRnd(seed || 7), out = []; let d = "", g = "";
    for (let i = 0; i < 9; i++) { const x = 60 + i * 190 + 80 * r(), y = 120 + 260 * r(); out.push(`M${scN(x)} -20V${scN(y)}`); d += `M${scN(x - 13)} ${scN(y)}h26v34q-13 12 -26 0Z`; g += scCirc(x, y + 18, 6); }
    return [{d: out.join(""), s: c, w: 2}, {d: d, f: c}, {d: g, f: lit, o: 0.9}];
  },
  // a moon of paper on a string, and paper stars
  paperMoon(c, lit) {
    return [{d: `M1090 -20V96`, s: lit, w: 2, o: 0.6}, {d: `M1090 96a150 150 0 1 0 130 250a122 122 0 1 1 -130 -250Z`, f: lit, o: 0.92},
      {d: [[420, 150], [620, 260], [300, 330], [1380, 120], [1480, 300]].map((p) => `M${p[0]} -20V${p[1] - 14}` ).join(""), s: lit, w: 1.4, o: 0.5},
      {d: [[420, 150], [620, 260], [300, 330], [1380, 120], [1480, 300]].map((p) => scPoly(p[0], p[1], 1, [[0, 16], [5, 5], [16, 4], [8, -4], [10, -15], [0, -9], [-10, -15], [-8, -4], [-16, 4], [-5, 5]])).join(""), f: lit, o: 0.85}];
  },
  // a hole in the sky, ringed with light
  blackSun(c, rim, x, y, rad) { return [{d: scCirc(x, y, rad * 1.5), f: rim, o: 0.12}, {d: scCirc(x, y, rad * 1.16), f: rim, o: 0.3}, {d: scCirc(x, y, rad), f: c}]; },
  // a falling star as big as a hill
  meteor(c, x, y, rad) { return [{d: `M${x + rad * 0.5} ${y - rad * 0.86}L${x + rad * 7} ${y - rad * 5}L${x + rad * 0.9} ${y + rad * 0.4}Z`, f: c, o: 0.3}, {d: scCirc(x, y, rad), f: c, o: 0.95}]; },
  // great wheels turning in the sky (machines of the gods)
  halos(c, x, y) { return [{d: scCirc(x, y, 250), s: c, w: 3, o: 0.4}, {d: scCirc(x, y, 190), s: c, w: 9, o: 0.16, dash: "40 18"}, {d: scCirc(x, y, 130), s: c, w: 2, o: 0.4}]; },
  // four seals of the Ordeal Call
  sigils(c) { return [{d: [520, 710, 890, 1080].map((x, i) => scPoly(x, 210 + (i % 2) * 40, 1, [[0, 34], [22, 0], [0, -34], [-22, 0]])).join(""), s: c, w: 3, o: 0.7}, {d: [520, 710, 890, 1080].map((x, i) => scCirc(x, 210 + (i % 2) * 40, 5)).join(""), f: c, o: 0.9}]; },
  // an airship high up
  border(c, lit, x, y, k) { return SCP.border(x, y, k || 1, c, lit); },
  flock(c, n, seed, x, y, w, h, k) { return SCP.flock(x, y + h, k || 1, c, n, seed, w, h); },
  cubes(c, n, seed) { return SCP.cubes(800, 420, 1, c, n, seed, 1700, 420); },
  // the planet, seen from far above it
  planet(c, c2, x, y, rad) { return [{d: scCirc(x, y, rad * 1.04), f: c2, o: 0.25}, {d: scCirc(x, y, rad), f: c}, {d: `M${x - rad * 0.7} ${y - rad * 0.3}q${rad * 0.5} ${-rad * 0.4} ${rad * 0.9} ${-rad * 0.1}q${rad * 0.1} ${rad * 0.3} ${-rad * 0.3} ${rad * 0.5}q${-rad * 0.4} ${rad * 0.1} ${-rad * 0.6} ${-rad * 0.4}Z`, f: c2, o: 0.5}]; }
};
// water coming down a cliff
SCP.falls = (x, y, k, c, h) => [{d: scRect(x, y, k, -9, 0, 18, h), f: c, o: 0.5}, {d: scRect(x, y, k, -3, 0, 6, h), f: "#ffffff", o: 0.55}, {d: `M${scN(x - 34 * k)} ${scN(y)}a${scN(34 * k)} ${scN(9 * k)} 0 1 0 ${scN(68 * k)} 0a${scN(34 * k)} ${scN(9 * k)} 0 1 0 ${scN(-68 * k)} 0Z`, f: "#ffffff", o: 0.3}];
// an island adrift in the air, with a town on its back
SCK.island = (c, lit, x, y, k) => [{d: scPoly(x, y, k, [[-170, 0], [-120, -40], [-60, -120], [0, -170], [50, -110], [130, -50], [170, 0], [120, 14], [90, 60], [70, 14], [30, 14], [10, 90], [-10, 14], [-60, 14], [-80, 50], [-100, 14]]), f: c}, {d: SCP.lights(x, y - 20 * k, k, lit, 8, 3, 240 * k, 30 * k)[0].d, f: lit, o: 0.8}];

/* ---------- the scenes ----------
   Each chapter: {dir, acts}. An act: n (its name, shown on the Story page), at (how far through the chapter it starts,
   0–1), re (a section or place name that starts it, when NA's data has one that matches), sky (top, middle, horizon),
   stars (0–2), t (things in the sky), d (the land, back to front), m and pn (which specks drift over it, and how
   many), fx (the few things that move: heat, flash, mist, shoot, shine, pulse). In d: ["orb", x, y, radius, colour,
   glow], [generator, colour, …], ["city", colour, seed, y, kind, lowest, highest, gap, windows], ["p", landmark, x, y,
   size, colour, …]. */
const PART1_RING = ["ring", "#ffe9a8"];
const SCENES = {
  100: {acts: [
    {n: "The burning city", sky: ["#140707", "#3a120c", "#8a2f12"], d: [["city", "#2a0d0a", 11, 372, "ruin", 80, 250, 30, "#ff9a3c"], ["city", "#1c0806", 12, 446, "ruin", 50, 190, 20, "#ffb05a"], ["hills", "#0d0404", 13, 522, 26, 300]], m: "embers", pn: 14, fx: ["heat"]},
    {n: "The cave under Mount Enzo", at: 0.6, re: /Enzo|Cavern|Greater Grail|Cave|Grotto/i, sky: ["#07060c", "#141024", "#3a2a4a"], t: [["ceiling", "#05040a", 21, 180]],
      d: [["peaks", "#1c1630", 22, 410, 150, 150], ["p", "cave", 800, 474, 1.2, "#c9a23a", "#e8c66a"], ["orb", 800, 372, 30, "#fff2c0", 0.9], ["peaks", "#0b0914", 23, 524, 70, 120]], m: "motes", pn: 10}]},
  101: {acts: [
    {n: "The fields of France", sky: ["#0c1a3a", "#274a80", "#d9a35a"], t: [PART1_RING, ["flock", "#0f1c2c", 6, 31, 520, 60, 700, 180, 1.3]], d: [["orb", 1150, 320, 40, "#ffd9a0", 0.7], ["hills", "#1f3a52", 31, 362, 60, 280], ["hills", "#173046", 32, 440, 40, 240], ["city", "#10222f", 33, 452, "house", 26, 56, 220, "#ffd9a0"], ["p", "tower", 930, 452, 1, "#10222f", 26, 96, "spire"], ["hills", "#0a1620", 34, 518, 26, 300]], m: "dust", pn: 10},
    {n: "Burning towns", at: 0.36, re: /Lyon|La Charit|Thiers|Bordeaux|Marseille|Jura/i, sky: ["#1a0d14", "#5a2218", "#c2531c"], t: [PART1_RING, ["flock", "#12070a", 9, 41, 900, 40, 900, 220, 1.4]], d: [["hills", "#5a2418", 41, 366, 54, 280], ["city", "#1a0806", 42, 446, "ruin", 50, 150, 40, "#ffae5a"], ["p", "tower", 980, 446, 1, "#1a0806", 26, 110, "spire"], ["hills", "#0c0403", 43, 520, 26, 300]], m: "embers", pn: 12, fx: ["heat"]},
    {n: "Orléans", at: 0.74, re: /Orl[eé]ans|Dragon Witch|Fafnir|Castle/i, sky: ["#12060c", "#4a0f1a", "#a0241a"], t: [PART1_RING, ["flock", "#0c0406", 13, 51, 800, 30, 1300, 260, 1.7]], d: [["peaks", "#2a0c12", 51, 372, 110, 190], ["p", "castle", 800, 448, 0.8, "#170609", "#ff7a3a"], ["hills", "#0a0305", 52, 520, 30, 280]], m: "embers", pn: 12, fx: ["heat"]}]},
  102: {acts: [
    {n: "Rome", sky: ["#1a1230", "#5a2a4a", "#e0935a"], t: [PART1_RING], d: [["orb", 420, 262, 46, "#ffd08a", 0.8], ["hills", "#4a2a44", 61, 370, 40, 320], ["p", "aqueduct", 40, 380, 0.9, "#3a1f36", 9], ["p", "temple", 1090, 380, 1, "#3a1f36"], ["p", "colosseum", 760, 448, 0.9, "#2a1428", "#ffcf8a"], ["city", "#24101f", 62, 452, "dome", 34, 100, 30, "#ffcf8a"], ["hills", "#12070f", 63, 520, 22, 300]], m: "petals", pn: 12},
    {n: "The road to Gaul", at: 0.34, re: /Gaul|Massilia|Mediolanum|Britannia|Etna|Florentia/i, sky: ["#0e1836", "#2c5088", "#b8c890"], t: [PART1_RING, ["flock", "#0c1626", 5, 71, 1050, 80, 500, 120, 1]], d: [["peaks", "#24406a", 71, 356, 170, 190], ["hills", "#173052", 72, 438, 44, 260], ["p", "banner", 600, 470, 0.8, "#0d1c30", "#b3203a"], ["p", "banner", 760, 478, 0.9, "#0d1c30", "#b3203a"], ["p", "banner", 940, 468, 0.8, "#0d1c30", "#e9c46a"], ["hills", "#0a1624", 73, 516, 26, 280]], m: "dust", pn: 10},
    {n: "The United Empire", at: 0.62, re: /United|Romulus|Imperial|Capital/i, sky: ["#150a1a", "#4a1430", "#c04a3a"], t: [PART1_RING], d: [["city", "#2a0f22", 81, 388, "dome", 60, 180, 20, "#ffb05a"], ["p", "greatTree", 800, 452, 0.5, "#1c0a18", "#ffb05a"], ["hills", "#160811", 82, 462, 30, 260], ["hills", "#0b0408", 83, 522, 22, 300]], m: "petals", pn: 12},
    {n: "The white titan's light", at: 0.87, re: /Altera|Attila|Flauros|Titan|Final/i, sky: ["#06091a", "#141e44", "#3a4a8a"], stars: 2, t: [PART1_RING], d: [["p", "beam", 800, 470, 1, "#bfe0ff", 14], ["hills", "#121b3a", 91, 380, 50, 300], ["city", "#0b1226", 92, 450, "ruin", 30, 120, 60, "#bfe0ff"], ["hills", "#05081a", 93, 520, 22, 300]], m: "motes", pn: 10, fx: ["pulse"]}]},
  103: {acts: [
    {n: "The open sea", sky: ["#081a3a", "#1a5a9a", "#8ad0e8"], t: [PART1_RING, ["flock", "#0a2238", 5, 101, 420, 120, 420, 90, 0.8]], d: [["orb", 1200, 190, 44, "#fff2c0", 0.8], ["hills", "#1c5a8a", 101, 380, 50, 560], ["flat", "#0e3f6e", 384], ["p", "ship", 770, 392, 1.1, "#0a2238", "#d9e8f2"], ["flat", "#0a3258", 446], ["flat", "#06223e", 506]], m: "waves", pn: 3, fx: ["shine"]},
    {n: "Storm over the sealed seas", at: 0.4, re: /Storm|Blackbeard|Hektor|Pirate|Queen Anne/i, sky: ["#070b14", "#1c2a3e", "#4a5a6a"], t: [["ring", "#8a93a0"]], d: [["peaks", "#121c2a", 111, 384, 130, 420], ["flat", "#0c1a2a", 388], ["p", "ship", 620, 396, 1.15, "#060d16", "#2a3644"], ["p", "ship", 1080, 394, 0.7, "#060d16", "#2a3644"], ["flat", "#081320", 450], ["flat", "#050c16", 508]], m: "rain", pn: 14, fx: ["flash"]},
    {n: "The Argo at sunset", at: 0.72, re: /Argo|Heracles|Jason|Ark|Medea|Forneus|Final/i, sky: ["#1a0e2a", "#6a2a4a", "#e88a4a"], t: [PART1_RING], d: [["orb", 800, 382, 62, "#ffb060", 0.95], ["hills", "#4a1f3e", 121, 384, 40, 620], ["flat", "#3a1c3a", 388], ["p", "ship", 560, 396, 1.3, "#170a1c", "#3a1c34"], ["p", "ship", 1100, 394, 0.8, "#170a1c", "#3a1c34"], ["flat", "#24102a", 452], ["flat", "#130818", 510]], m: "waves", pn: 3, fx: ["shine"]}]},
  104: {acts: [
    {n: "The Mist City", sky: ["#0b0e12", "#232b33", "#5a6570"], t: [["ring", "#c9b27a"]], d: [["orb", 1250, 120, 34, "#d8dde0", 0.5], ["city", "#1c242b", 131, 390, "house", 60, 150, 0, "#e8c070"], ["p", "bigben", 880, 452, 0.78, "#11181d", "#f2d48a"], ["city", "#0f1519", 132, 458, "house", 40, 110, 0, "#e8c070"], ["p", "lights", 800, 476, 1, "#f2d48a", 14, 133, 1700, 8], ["flat", "#080c0f", 524]], m: "fog", pn: 4, fx: ["mist", "mist2"]},
    {n: "Under the streets", at: 0.45, re: /Underground|Sewer|Subway|Angrboda|Laborator|Soho|Tunnel/i, sky: ["#080a0d", "#151c22", "#34404c"], t: [["ceiling", "#1c252d", 141, 210], ["p", "lights", 800, 250, 1, "#7fd0c0", 10, 145, 1700, 120]], d: [["peaks", "#1a232a", 142, 430, 90, 170], ["p", "aqueduct", 380, 470, 1.1, "#10171c", 12], ["p", "lights", 800, 440, 1, "#7fd0c0", 9, 143, 1500, 90], ["peaks", "#0a0f13", 144, 520, 60, 150]], m: "fog", pn: 3, fx: ["mist"]},
    {n: "The stair of lightning", at: 0.76, re: /Tesla|Lightning|Buckingham|Storm|Thunder|Final|Barbatos/i, sky: ["#080a16", "#1e2440", "#4a4a7a"], t: [["ring", "#c9b27a"]], d: [["p", "beam", 1100, 470, 1, "#cfd8ff", 5], ["city", "#161a30", 151, 390, "house", 60, 150, 0, "#cfd8ff"], ["p", "bigben", 880, 452, 0.78, "#0c0f20", "#e8ecff"], ["city", "#090b18", 152, 458, "house", 40, 110, 0, "#e8c070"], ["flat", "#05060e", 524]], m: "rain", pn: 12, fx: ["flash", "mist"]}]},
  105: {acts: [
    {n: "The frontier", sky: ["#0e1630", "#3a4a80", "#e0a070"], t: [PART1_RING, ["flock", "#1a0b12", 5, 161, 1000, 100, 500, 100, 0.9]], d: [["orb", 300, 340, 50, "#ffcf90", 0.8], ["city", "#5a2a2a", 161, 380, "block", 60, 150, 320], ["hills", "#3a1a1e", 162, 446, 26, 300], ["p", "deadTree", 1060, 470, 1, "#1a0b0e"], ["hills", "#1a0b0e", 163, 516, 22, 300]], m: "dust", pn: 12},
    {n: "Two armies", at: 0.4, re: /Celt|Edison|Denver|Dallas|Alexandria|Alcatraz|Chicago|Army|Des Moines|Riverton/i, sky: ["#101226", "#3a2a55", "#b85a4a"], t: [PART1_RING], d: [["city", "#3a1c2a", 171, 380, "block", 60, 150, 320], ["hills", "#22101c", 172, 446, 26, 300], ["p", "banner", 520, 474, 0.8, "#12080e", "#3b6fd0"], ["p", "banner", 660, 480, 0.9, "#12080e", "#3b6fd0"], ["p", "banner", 960, 478, 0.9, "#12080e", "#c0392b"], ["p", "banner", 1100, 472, 0.8, "#12080e", "#c0392b"], ["p", "lights", 800, 492, 1, "#ffb05a", 12, 173, 1500, 6], ["hills", "#0f060a", 174, 518, 22, 300]], m: "embers", pn: 8},
    {n: "Washington", at: 0.78, re: /Washington|White House|Medb|Clock|Final|Halphas/i, sky: ["#080a18", "#1a1c3c", "#5a2a4a"], stars: 1, t: [PART1_RING], d: [["city", "#14142c", 181, 388, "dome", 50, 130, 30, "#e8e1d0"], ["p", "pillar", 330, 452, 0.62, "#0e0c20", "#ff5a5a"], ["p", "pillar", 1290, 452, 0.7, "#0e0c20", "#ff5a5a"], ["p", "temple", 800, 452, 1.15, "#0c0c1e"], ["hills", "#06060f", 182, 520, 20, 300]], m: "stars", pn: 10, fx: ["shoot"]}]},
  106: {acts: [
    {n: "The desert", sky: ["#1a1430", "#6a4a5a", "#f0c080"], t: [PART1_RING], d: [["orb", 1150, 130, 54, "#fff0c0", 0.9], ["hills", "#8a6a4a", 191, 378, 50, 440], ["p", "pyramid", 430, 388, 1.2, "#6a4f3a", "#ffe9a8"], ["p", "pyramid", 720, 392, 0.6, "#6a4f3a"], ["hills", "#5a4030", 192, 446, 36, 380], ["hills", "#2a1c14", 193, 514, 26, 340]], m: "dust", pn: 14},
    {n: "The village in the mountains", at: 0.3, re: /Mountain|Village|Hassan|Atlas|Ruins|Canyon/i, sky: ["#0c1228", "#2a3a6a", "#c08a6a"], t: [PART1_RING], d: [["peaks", "#2a2a4a", 201, 346, 210, 180], ["peaks", "#1a1a30", 202, 436, 130, 160], ["city", "#10101f", 203, 470, "house", 20, 44, 160, "#ffcf8a"], ["hills", "#08080f", 204, 520, 24, 280]], m: "dust", pn: 10},
    {n: "The Holy City", at: 0.6, re: /Holy City|Camelot|Round Table|Gate|Knights/i, sky: ["#141a3a", "#5a6a9a", "#f0e8c8"], t: [PART1_RING], d: [["hills", "#6a6a7a", 211, 380, 36, 400], ["p", "castle", 800, 448, 1, "#b8b4a8", "#fff6d0"], ["hills", "#3a3a4a", 212, 462, 26, 320], ["hills", "#16161f", 213, 520, 22, 300]], m: "motes", pn: 10},
    {n: "The tower at the end of the world", at: 0.87, re: /Rhongomyniad|Lion King|Tower|Final|Goddess/i, sky: ["#0a0c20", "#2a2a5a", "#c0b890"], stars: 1, t: [PART1_RING], d: [["p", "beam", 800, 470, 1, "#fff2c0", 26], ["hills", "#3a3a55", 221, 384, 36, 400], ["p", "castle", 800, 452, 1, "#8e8a86", "#fff6d0"], ["hills", "#1a1a2a", 222, 468, 24, 320], ["hills", "#0a0a14", 223, 522, 20, 300]], m: "motes", pn: 12, fx: ["pulse"]}]},
  107: {acts: [
    {n: "Uruk", sky: ["#141026", "#5a3a5a", "#e8b070"], t: [PART1_RING], d: [["orb", 1180, 210, 50, "#ffe0a0", 0.9], ["hills", "#6a4a3a", 231, 368, 40, 420], ["p", "ziggurat", 800, 440, 1, "#3a2620", "#ffd9a0"], ["city", "#2a1a16", 232, 448, "wall", 36, 64, 0], ["p", "palm", 470, 476, 0.9, "#150c0a"], ["p", "palm", 1130, 480, 1, "#150c0a"], ["hills", "#150c0a", 233, 516, 20, 320]], m: "dust", pn: 12},
    {n: "The cedar forest", at: 0.3, re: /Cedar|Forest|Jungle|Quetz|Eridu|Ebih|Ur\b|Nippur/i, sky: ["#0a1420", "#1f4a4a", "#a0c080"], t: [PART1_RING, ["flock", "#081a16", 6, 241, 600, 90, 700, 130, 0.9]], d: [["peaks", "#1f4038", 241, 346, 180, 200], ["pines", "#12302a", 242, 446, 130, 40], ["canopy", "#081a16", 243, 516, 30, 60]], m: "leaves", pn: 10},
    {n: "Kur, the underworld", at: 0.55, re: /Kur\b|Underworld|Ereshkigal|Kutha|Cutha/i, sky: ["#04060e", "#0a1028", "#1c2a5a"], t: [["ceiling", "#0c1230", 251, 190], ["cages", "#24346a", "#7fc8ff", 252]], d: [["peaks", "#131d44", 253, 408, 130, 170], ["peaks", "#0b1230", 254, 474, 80, 150], ["hills", "#060a1c", 255, 524, 20, 280]], m: "motes", pn: 10, fx: ["mist"]},
    {n: "The sea of life", at: 0.78, re: /Tiamat|Lahmu|Chaos Tide|Sea of Life|Final|Decisive|Absolute Demonic/i, sky: ["#14060a", "#4a0c14", "#9a1c1c"], t: [["ring", "#ff9a7a"]], d: [["p", "horns", 800, 398, 1, "#1a0508"], ["flat", "#0c0306", 398], ["p", "ziggurat", 300, 400, 0.45, "#0c0306", "#ff9a7a"], ["flat", "#080204", 456], ["flat", "#040102", 512]], m: "embers", pn: 10, fx: ["heat"]}]},
  108: {acts: [
    {n: "The Temple of Time", sky: ["#05041a", "#1c1450", "#5a3a9a"], stars: 2, d: [["p", "pillar", 190, 470, 0.8, "#1a1038", "#ff5a5a"], ["p", "pillar", 490, 462, 0.95, "#1a1038", "#ff5a5a"], ["p", "pillar", 1110, 462, 0.95, "#1a1038", "#ff5a5a"], ["p", "pillar", 1410, 470, 0.8, "#1a1038", "#ff5a5a"], ["peaks", "#0f0a28", 261, 476, 50, 200], ["hills", "#07051a", 262, 524, 18, 300]], m: "stars", pn: 12, fx: ["shoot", "shoot2"]},
    {n: "The throne", at: 0.6, re: /Throne|Goetia|Solomon|Final|Ars |Crown/i, sky: ["#0a0624", "#2a1a6a", "#c9a23a"], stars: 2, t: [["halos", "#e8c66a", 800, 250]], d: [["orb", 800, 300, 56, "#fff0b0", 1], ["p", "pillar", 330, 470, 0.85, "#140c30", "#ffd76a"], ["p", "pillar", 1270, 470, 0.85, "#140c30", "#ffd76a"], ["peaks", "#0c0822", 271, 476, 46, 200], ["hills", "#060414", 272, 524, 18, 300]], m: "stars", pn: 12, fx: ["shoot", "pulse"]}]},
  201: {acts: [
    {n: "Shinjuku by night", sky: ["#06040e", "#1a1030", "#4a1a5a"], d: [["city", "#150d26", 281, 388, "modern", 120, 320, 6, "#ff5aa8"], ["city", "#0c0718", 282, 456, "modern", 80, 220, 4, "#5ad8ff"], ["flat", "#05030a", 524]], m: "rain", pn: 14, fx: ["mist"]},
    {n: "The Barrel Tower", at: 0.6, re: /Barrel|Tower|Moriarty|Meteor|Final|Phantom/i, sky: ["#0a040c", "#2a0c2a", "#7a1a3a"], t: [["meteor", "#ffb060", 1240, 120, 24]], d: [["city", "#1a0a22", 291, 388, "modern", 120, 300, 6, "#ff5aa8"], ["p", "barrel", 800, 456, 0.82, "#0a0614", "#ff5aa8"], ["city", "#0c0514", 292, 456, "modern", 80, 200, 4, "#5ad8ff"], ["flat", "#050208", 524]], m: "rain", pn: 12, fx: ["flash"]}]},
  202: {acts: [
    {n: "The world under the earth", sky: ["#041410", "#0c3a2c", "#3aa07a"], t: [["ceiling", "#03100c", 301, 160], ["p", "lights", 800, 150, 1, "#9af0c8", 26, 302, 1800, 130]], d: [["canopy", "#0f3a2a", 303, 388, 40, 70], ["canopy", "#0a2a1e", 304, 456, 40, 60], ["canopy", "#051610", 305, 520, 30, 60]], m: "motes", pn: 12},
    {n: "Ys, the city on the water", at: 0.3, re: /Ys\b|Dahut|Pirate|Water|Port/i, sky: ["#04121a", "#0c3a4a", "#3ab0b0"], t: [["ceiling", "#030d12", 311, 160]], d: [["city", "#082630", 312, 404, "house", 30, 90, 20, "#ffd88a"], ["flat", "#0a3240", 404], ["p", "ship", 620, 412, 0.9, "#051a22", "#0f3a48"], ["flat", "#072630", 460], ["flat", "#041a22", 514]], m: "motes", pn: 10, fx: ["shine"]},
    {n: "The Nightless City", at: 0.55, re: /Nightless|Wu Zetian|Castle|Amazon|El Dorado|Empress/i, sky: ["#0c0a14", "#3a1c2a", "#b0503a"], t: [["ceiling", "#08060c", 321, 150]], d: [["city", "#2a121c", 322, 404, "edo", 50, 120, 10, "#ffb060"], ["p", "pagoda", 560, 456, 0.9, "#1a0a12"], ["p", "pagoda", 1040, 456, 1.05, "#1a0a12"], ["p", "lights", 800, 470, 1, "#ff9a4a", 34, 323, 1700, 90], ["hills", "#0c0508", 324, 520, 20, 300]], m: "embers", pn: 8},
    {n: "The falling island", at: 0.82, re: /Laputa|Columbus|Megalos|Scheherazade|Final|Phenex|Heracles/i, sky: ["#0a0c14", "#2a2a3a", "#8a6a4a"], t: [["ceiling", "#07080c", 331, 130], ["island", "#15161c", "#ffcf8a", 800, 300, 1.5]], d: [["canopy", "#1c2420", 332, 400, 40, 70], ["city", "#111614", 333, 462, "ruin", 30, 100, 80, "#ffb05a"], ["hills", "#080a09", 334, 520, 20, 300]], m: "dust", pn: 12, fx: ["heat"]}]},
  203: {acts: [
    {n: "The villages of Shimousa", sky: ["#0c1026", "#2a3a6a", "#c08a8a"], d: [["orb", 1180, 130, 46, "#f0e8d8", 0.7], ["hills", "#1c2a4a", 341, 370, 60, 300], ["city", "#121c33", 342, 448, "edo", 26, 56, 120, "#ffcf8a"], ["p", "torii", 520, 506, 1.1, "#3a0f14"], ["hills", "#070b16", 343, 520, 22, 300]], m: "petals", pn: 10},
    {n: "Under the crimson moon", at: 0.34, re: /Crimson|Moon|Swordmaster|Seigan|Night|Tsuchi|Ooshu/i, sky: ["#12040a", "#3a0a14", "#7a1420"], d: [["orb", 1100, 140, 66, "#d02a3a", 0.9], ["hills", "#2a0810", 351, 372, 60, 300], ["pines", "#16040a", 352, 448, 150, 22], ["p", "torii", 520, 506, 1.1, "#0a0204"], ["hills", "#080103", 353, 520, 22, 300]], m: "petals", pn: 10},
    {n: "Onriedo Castle", at: 0.78, re: /Castle|Onri|Edo|Amakusa|Final|Ryutan|Hell/i, sky: ["#0c0306", "#3a060c", "#a0201a"], d: [["orb", 1180, 120, 60, "#d02a3a", 0.9], ["peaks", "#240509", 361, 380, 110, 200], ["p", "keep", 800, 456, 1.25, "#0f0204"], ["hills", "#070102", 362, 522, 22, 300]], m: "embers", pn: 12, fx: ["heat"]}]},
  204: {acts: [
    {n: "Salem village", sky: ["#12141a", "#3a3a40", "#8a8070"], t: [["flock", "#0b0c0b", 8, 371, 560, 90, 700, 150, 0.9]], d: [["hills", "#2a2c2a", 371, 372, 50, 300], ["city", "#1a1c1a", 372, 448, "house", 34, 66, 70, "#d8b070"], ["p", "tower", 1000, 448, 1, "#1a1c1a", 30, 110, "spire"], ["p", "deadTree", 420, 506, 1.3, "#0b0c0b"], ["hills", "#0b0c0b", 373, 520, 22, 300]], m: "fog", pn: 3, fx: ["mist"]},
    {n: "The hill of the trials", at: 0.4, re: /Trial|Gallows|Hill|Court|Witch|Hang|Night/i, sky: ["#0a0a10", "#1c1a26", "#4a3a4a"], t: [["flock", "#060508", 14, 381, 800, 60, 1200, 220, 1]], d: [["orb", 380, 110, 30, "#d8d0c8", 0.5], ["hills", "#14121c", 381, 430, 130, 760], ["p", "deadTree", 800, 372, 1.2, "#0a090f"], ["p", "deadTree", 1010, 400, 0.8, "#0a090f"], ["city", "#0c0b12", 382, 470, "house", 26, 50, 110, "#d8b070"], ["hills", "#060508", 383, 522, 20, 300]], m: "fog", pn: 3, fx: ["mist"]},
    {n: "The Sabbath", at: 0.8, re: /Sabbath|Abigail|Raum|Key|Final|Outer|Typhon/i, sky: ["#0a0414", "#2a0c3a", "#6a1a6a"], stars: 1, t: [["blackSun", "#05020a", "#c05ae0", 800, 200, 70], ["flock", "#04020a", 12, 391, 800, 60, 1300, 240, 1]], d: [["p", "beam", 800, 470, 1, "#b05ae0", 6], ["hills", "#180a26", 391, 430, 130, 760], ["p", "deadTree", 640, 384, 1.1, "#0a0412"], ["p", "deadTree", 980, 392, 0.9, "#0a0412"], ["hills", "#06020c", 392, 522, 20, 300]], m: "motes", pn: 10, fx: ["pulse"]}]},
  300: {acts: [
    {n: "Chaldea, in the ice", sky: ["#0a1020", "#2a3a5a", "#a0b4c8"], d: [["peaks", "#5a6f8a", 401, 356, 150, 220], ["p", "chaldea", 800, 448, 0.95, "#1c2a3e", "#ffd88a"], ["hills", "#4a5f78", 402, 456, 26, 320], ["hills", "#24344a", 403, 518, 22, 300]], m: "snow", pn: 14, fx: ["mist"]},
    {n: "The last day of Chaldea", at: 0.45, re: /Invasion|Oprichnik|Attack|Evacu|Kotomine|Escape|Raid|Ordeal/i, sky: ["#100a12", "#3a1a24", "#8a3a3a"], d: [["peaks", "#4a3a4a", 411, 356, 150, 220], ["p", "chaldea", 800, 448, 0.95, "#1a1018", "#ff5a4a"], ["hills", "#3a2a36", 412, 456, 26, 320], ["hills", "#1c1219", 413, 518, 22, 300]], m: "snow", pn: 14, fx: ["heat"]},
    {n: "The bleached Earth", at: 0.82, re: /Bleach|Border|Void|Imaginary|Flight|White|Drift/i, sky: ["#1a2030", "#5a6578", "#c8d0dc"], t: [["border", "#141c28", "#8ad0ff", 800, 210, 1.1]], d: [["flat", "#6f7c8e", 420], ["flat", "#4a5666", 500]], m: "dust", pn: 8}]},
  301: {acts: [
    {n: "The frozen land", sky: ["#060e20", "#1c3a6a", "#8ab8e0"], t: [["aurora", "#7fe0c0", "#8a9aff"]], d: [["peaks", "#3a5f8f", 421, 356, 120, 220], ["p", "greatTree", 1290, 384, 0.5, "#27456e", "#bfe8ff"], ["pines", "#14305a", 422, 446, 110, 34], ["p", "huts", 640, 506, 1, "#0c1f3c", 5, 423, 620], ["hills", "#0a1830", 424, 518, 20, 300]], m: "snow", pn: 16, fx: ["mist", "aurora"]},
    {n: "Moscow", at: 0.5, re: /Moscow|Yaga|Kremlin|Capital|City|Palace/i, sky: ["#080a1c", "#24285a", "#7a6aa0"], t: [["aurora", "#8a9aff", "#c08aff"]], d: [["p", "greatTree", 1320, 404, 0.5, "#15173a", "#c8b0ff"], ["city", "#1a1c44", 431, 406, "onion", 60, 170, 10, "#ffcf8a"], ["p", "tower", 700, 456, 1, "#101230", 44, 150, "onion"], ["p", "tower", 800, 456, 1, "#101230", 56, 210, "onion"], ["p", "tower", 900, 456, 1, "#101230", 44, 150, "onion"], ["hills", "#0a0c22", 432, 518, 20, 300]], m: "snow", pn: 14, fx: ["aurora"]},
    {n: "The Tsar and the tree", at: 0.82, re: /Ivan|Terrible|Tsar|Mammoth|Tree|Final|Orochi|Thunder/i, sky: ["#06060f", "#1a1436", "#5a3a7a"], t: [["aurora", "#c08aff", "#8a9aff"]], d: [["city", "#121030", 441, 410, "onion", 40, 120, 30, "#ffcf8a"], ["p", "greatTree", 800, 476, 0.9, "#100c24", "#c8b0ff"], ["hills", "#070614", 442, 520, 20, 300]], m: "snow", pn: 14, fx: ["flash", "aurora"]}]},
  302: {acts: [
    {n: "Ice and flowers", sky: ["#0a1226", "#2a4a7a", "#e8c8d8"], d: [["orb", 1150, 160, 58, "#ffb0a0", 0.7], ["peaks", "#4a6a9a", 451, 346, 190, 220], ["p", "greatTree", 380, 376, 0.45, "#3a5a8a", "#bfe8ff"], ["hills", "#2a4672", 452, 446, 30, 300], ["p", "lights", 800, 470, 1, "#ff9ac0", 44, 453, 1900, 34], ["p", "huts", 980, 500, 0.9, "#10223f", 4, 454, 420], ["hills", "#10223f", 455, 520, 20, 300]], m: "snow", pn: 10},
    {n: "The castle of ice", at: 0.45, re: /Castle|Skadi|Ice|Queen|Valkyr|Prison/i, sky: ["#070c20", "#1c2c66", "#8ab0e8"], t: [["aurora", "#bfe8ff", "#8ab0e8"]], d: [["peaks", "#3a5a96", 461, 350, 190, 220], ["p", "castle", 800, 448, 0.9, "#8fb8e8", "#e8f6ff"], ["hills", "#22407a", 462, 462, 26, 300], ["hills", "#0c1c40", 463, 520, 20, 300]], m: "snow", pn: 14, fx: ["aurora"]},
    {n: "The burning sun", at: 0.78, re: /Surtr|Flame|Fire|Giant|Twilight|Ragnar|Final|Sun|Sinmara/i, sky: ["#1a0608", "#6a1410", "#e85a1c"], d: [["orb", 800, 340, 180, "#ff7a2a", 1], ["peaks", "#3a0c0a", 471, 372, 170, 220], ["hills", "#1f0606", 472, 452, 30, 300], ["hills", "#0d0303", 473, 520, 20, 300]], m: "icefire", pn: 14, fx: ["heat"]}]},
  303: {acts: [
    {n: "The quiet fields", sky: ["#0a1830", "#2a5a8a", "#c8e0b0"], t: [["wall", "#e8c070"]], d: [["orb", 1180, 160, 44, "#fff2c0", 0.8], ["hills", "#3a6a5a", 481, 368, 30, 520], ["p", "greatTree", 300, 386, 0.4, "#2f5a4c", "#e8f6c0"], ["hills", "#2a5a3a", 482, 446, 16, 420], ["p", "huts", 900, 500, 0.9, "#0f2a1c", 5, 483, 700], ["hills", "#0f2a1c", 484, 520, 14, 400]], m: "leaves", pn: 8},
    {n: "Xianyang", at: 0.5, re: /Xianyang|Capital|Palace|Emperor|Qin|Xiang Yu|Great Wall|Epang/i, sky: ["#0c1228", "#3a2a55", "#d08a4a"], t: [["wall", "#e8c070"]], d: [["city", "#2a1a30", 491, 396, "edo", 40, 90, 10, "#ffcf8a"], ["p", "palace", 800, 452, 1, "#180c1c"], ["p", "banner", 480, 470, 0.9, "#0c060e", "#c03a2a"], ["p", "banner", 1120, 470, 0.9, "#0c060e", "#c03a2a"], ["hills", "#0c060e", 492, 520, 16, 360]], m: "dust", pn: 10},
    {n: "Above the sky", at: 0.82, re: /Tree|Space|Final|Mayall|Shi Huang|Heaven|Orbit/i, sky: ["#03040c", "#0c1030", "#3a2a66"], stars: 2, t: [["wall", "#ffd98a"]], d: [["p", "greatTree", 800, 470, 0.85, "#0c0a24", "#e8f6c0"], ["p", "palace", 1180, 462, 0.5, "#0a081c"], ["hills", "#05040f", 501, 520, 16, 360]], m: "stars", pn: 12, fx: ["shoot"]}]},
  304: {acts: [
    {n: "Krita Yuga, the golden age", sky: ["#1a1230", "#6a4a3a", "#f0c060"], d: [["orb", 800, 260, 60, "#fff0b0", 0.9], ["peaks", "#6a4a4a", 511, 360, 150, 240], ["p", "shikhara", 520, 448, 0.8, "#3a2430"], ["p", "shikhara", 800, 452, 1.1, "#3a2430"], ["p", "shikhara", 1090, 448, 0.8, "#3a2430"], ["hills", "#2a1822", 512, 462, 26, 300], ["hills", "#140a10", 513, 520, 18, 300]], m: "motes", pn: 12},
    {n: "The turning of the Yugas", at: 0.3, re: /Treta|Dvapara|Village|Mountain|Kailash|Divine|Bishamon/i, sky: ["#140e2a", "#5a2a5a", "#e07a3a"], t: [["cubes", "#ffffff", 7, 521]], d: [["peaks", "#4a2a4a", 521, 360, 150, 240], ["p", "shikhara", 520, 448, 0.8, "#2a1630"], ["p", "shikhara", 800, 452, 1.1, "#2a1630"], ["p", "shikhara", 1090, 448, 0.8, "#2a1630"], ["hills", "#1c0f22", 522, 462, 26, 300], ["hills", "#0d0610", 523, 520, 18, 300]], m: "motes", pn: 12},
    {n: "Kali Yuga", at: 0.6, re: /Kali|Dissolution|Asura|Calamity|Purge|Ashwatthama/i, sky: ["#0c0616", "#3a0c2a", "#8a1c2a"], t: [["cubes", "#ffffff", 16, 531]], d: [["peaks", "#2a0c1c", 531, 360, 150, 240], ["city", "#1a0812", 532, 452, "ruin", 40, 150, 90, "#ff7a5a"], ["hills", "#0a0408", 533, 520, 18, 300]], m: "embers", pn: 10, fx: ["flash"]},
    {n: "The last god", at: 0.86, re: /Arjuna|God|Final|Tree|Spiral|Mahapralaya|Deva/i, sky: ["#06060f", "#1a1a3a", "#b0b8e0"], stars: 1, t: [["halos", "#e8e8ff", 800, 230], ["cubes", "#ffffff", 20, 541]], d: [["p", "greatTree", 800, 470, 0.8, "#10102a", "#e8e8ff"], ["flat", "#5a6078", 470], ["flat", "#3a4058", 520]], m: "stars", pn: 10, fx: ["pulse"]}]},
  305: {acts: [
    {n: "The ancient ocean", sky: ["#06142e", "#14509a", "#7fd8f0"], t: [["flock", "#082040", 5, 551, 480, 110, 420, 90, 0.8]], d: [["orb", 1220, 170, 46, "#fff2c0", 0.8], ["hills", "#1a5a94", 551, 380, 56, 560], ["p", "temple", 1150, 380, 0.6, "#134a80"], ["flat", "#0c3f78", 384], ["p", "ship", 700, 392, 1, "#082040", "#d0e8f6"], ["flat", "#0a3264", 446], ["flat", "#062448", 506]], m: "waves", pn: 3, fx: ["shine"]},
    {n: "The fleet of the gods' hunters", at: 0.35, re: /Fleet|Nemo|Odysseus|Argo|Island|Nautilus|Drake|Corday|Bartholomew/i, sky: ["#12102e", "#5a3a6a", "#e89a5a"], d: [["orb", 380, 372, 56, "#ffc070", 0.9], ["hills", "#3a2a5a", 561, 382, 50, 560], ["flat", "#2a2052", 386], ["p", "ship", 520, 394, 1.1, "#120c26", "#2a2046"], ["p", "ship", 860, 396, 1.3, "#120c26", "#2a2046"], ["p", "ship", 1180, 392, 0.8, "#120c26", "#2a2046"], ["flat", "#1c1640", 450], ["flat", "#100c28", 508]], m: "waves", pn: 3, fx: ["shine"]},
    {n: "Arrows from the sky", at: 0.65, re: /Artemis|Arrow|Orbit|Moon|Satellite|Orion|Goddess/i, sky: ["#04081a", "#0c1c4a", "#3a5a9a"], stars: 2, d: [["orb", 1040, -140, 40, "#e8f0ff", 0.9], ["p", "beam", 1040, 470, 1, "#bfe0ff", 9], ["hills", "#0f2a5a", 571, 382, 50, 560], ["flat", "#0a1e48", 386], ["p", "ship", 620, 394, 1, "#040c22", "#10244a"], ["flat", "#071636", 450], ["flat", "#040d22", 508]], m: "waves", pn: 3, fx: ["flash"]},
    {n: "The great hole", at: 0.88, re: /Hole|Pit|Poseidon|Core|Final|Fall|Descent|Atlantis Core/i, sky: ["#04060f", "#0c1836", "#2a4a8a"], stars: 1, d: [["hills", "#0c2250", 581, 380, 40, 600], ["flat", "#08183c", 384], ["p", "pit", 800, 440, 1.5, "#02030a", "#7fd8f0"], ["flat", "#050f28", 500]], m: "waves", pn: 3, fx: ["pulse"]}]},
  306: {acts: [
    {n: "The city of the gods", sky: ["#080c22", "#20306a", "#7ac8d8"], stars: 1, t: [["halos", "#bfe8ff", 1180, 210]], d: [["city", "#1a2a5a", 591, 396, "spire", 120, 330, 8, "#8af0ff"], ["city", "#101a40", 592, 458, "spire", 80, 220, 6, "#8af0ff"], ["flat", "#060a1c", 524]], m: "stars", pn: 10, fx: ["shoot"]},
    {n: "The machines of the twelve", at: 0.4, re: /Demeter|Aphrodite|Dioscuri|Machine|Temple|Underground|Resistance|Hephaestus/i, sky: ["#0a0a22", "#2a2060", "#b07ad8"], stars: 1, t: [["halos", "#e0c8ff", 420, 200], ["halos", "#bfe8ff", 1220, 250]], d: [["city", "#221c56", 601, 396, "spire", 100, 280, 8, "#e0c8ff"], ["p", "temple", 800, 458, 1.5, "#12103a"], ["city", "#0c0a28", 602, 470, "spire", 40, 120, 30, "#8af0ff"], ["flat", "#06051a", 524]], m: "motes", pn: 10},
    {n: "The thunder of Zeus", at: 0.72, re: /Zeus|Thunder|Keraunos|Sky|Final|Kirschtaria|Atlas|Olympus Core/i, sky: ["#060616", "#1a1650", "#6a5ae0"], stars: 2, t: [["halos", "#d8d0ff", 800, 230]], d: [["p", "beam", 620, 470, 1, "#d8d0ff", 5], ["p", "beam", 1060, 470, 1, "#d8d0ff", 7], ["city", "#16144a", 611, 396, "spire", 120, 330, 8, "#d8d0ff"], ["city", "#0a0926", 612, 458, "spire", 80, 220, 6, "#8af0ff"], ["flat", "#040412", 524]], m: "stars", pn: 10, fx: ["flash"]},
    {n: "The empty sky", at: 0.9, re: /Chaos|Tree|Magellan|Void|Collapse|Epilogue|Wodime/i, sky: ["#020208", "#0a0a24", "#2a2a5a"], stars: 2, t: [["blackSun", "#000004", "#7a5ae0", 800, 210, 110]], d: [["p", "greatTree", 1220, 470, 0.7, "#08081e", "#b0a0ff"], ["city", "#0a0a22", 621, 420, "spire", 80, 240, 20, "#7a5ae0"], ["flat", "#03030c", 520]], m: "stars", pn: 12, fx: ["pulse"]}]},
  307: {acts: [
    {n: "The capital by night", sky: ["#080616", "#1c1440", "#6a3a6a"], stars: 1, d: [["orb", 1150, 150, 78, "#f6ecd0", 0.8], ["hills", "#1a1436", 631, 372, 60, 320], ["p", "pagoda", 420, 448, 0.9, "#100a24"], ["city", "#100a24", 632, 448, "edo", 34, 76, 30, "#ffb060"], ["p", "torii", 980, 508, 1, "#5a1420"], ["p", "lights", 800, 520, 1, "#e0324a", 46, 633, 1900, 18], ["hills", "#06040f", 634, 524, 16, 300]], m: "petals", pn: 10},
    {n: "Mount Ooe", at: 0.4, re: /Ooe|Oe\b|Mountain|Oni|Shuten|Ibaraki|Kintoki|Tsuna/i, sky: ["#0a0614", "#2a1436", "#8a3a4a"], stars: 1, d: [["orb", 380, 130, 60, "#f6ecd0", 0.7], ["peaks", "#221236", 641, 356, 230, 300], ["pines", "#130a22", 642, 450, 120, 30], ["p", "torii", 800, 508, 1.2, "#5a1420"], ["p", "lights", 800, 470, 1, "#ff9a4a", 12, 643, 900, 60], ["hills", "#07040e", 644, 524, 16, 300]], m: "leaves", pn: 10},
    {n: "The black sun", at: 0.78, re: /Douman|Naraka|Mandala|Curse|Final|Black|Limbo|Ashiya/i, sky: ["#0a0410", "#2a0a2a", "#6a1440"], t: [["blackSun", "#04020a", "#b03ad0", 800, 200, 90]], d: [["hills", "#1c0a22", 651, 376, 60, 320], ["p", "pagoda", 420, 448, 0.9, "#0c0512"], ["city", "#0c0512", 652, 448, "edo", 34, 76, 30, "#b03ad0"], ["p", "lights", 800, 520, 1, "#e0324a", 46, 653, 1900, 18], ["hills", "#050208", 654, 524, 16, 300]], m: "embers", pn: 10, fx: ["pulse"]}]},
  308: {acts: [
    {n: "The shore of the fae", sky: ["#141a2a", "#5a5a4a", "#e8d08a"], d: [["orb", 400, 330, 50, "#ffe9b0", 0.8], ["hills", "#5a5a3a", 661, 372, 50, 340], ["p", "bellTower", 1100, 446, 0.7, "#2a3a24", "#ffe9a8"], ["pines", "#2a3a24", 662, 446, 90, 46], ["hills", "#101a10", 663, 518, 22, 300]], m: "motes", pn: 12},
    {n: "The towns of the bells", at: 0.25, re: /Bell|Salisbury|Gloucester|Norwich|Oxford|London|Sheffield|Pilgrim|Edinburgh/i, sky: ["#12142a", "#4a4a6a", "#e0b890"], d: [["hills", "#4a4a5a", 671, 372, 44, 340], ["city", "#2a2a44", 672, 408, "house", 40, 100, 14, "#ffe0a0"], ["p", "bellTower", 620, 456, 0.9, "#1a1a30", "#ffe9a8"], ["p", "bellTower", 1010, 456, 1.1, "#1a1a30", "#ffe9a8"], ["hills", "#0c0c1a", 673, 518, 22, 300]], m: "motes", pn: 12},
    {n: "Camelot", at: 0.5, re: /Camelot|Morgan|Queen|Throne|Coronation|Tintagel/i, sky: ["#0c0e24", "#2a2a6a", "#8a7ad0"], stars: 1, d: [["peaks", "#22245a", 681, 366, 150, 240], ["p", "castle", 800, 452, 1.1, "#0f1030", "#bfc8ff"], ["hills", "#0a0b22", 682, 468, 24, 300], ["hills", "#050612", 683, 522, 18, 300]], m: "motes", pn: 12},
    {n: "The Calamities", at: 0.72, re: /Calamit|Barghest|Albion|Melusine|Cernunnos|Curse|Great Pit|Fire|Disaster/i, sky: ["#12060a", "#4a1210", "#c04a1c"], d: [["peaks", "#3a100c", 691, 366, 150, 240], ["p", "castle", 800, 452, 1.1, "#120406", "#ff7a3a"], ["hills", "#120406", 692, 468, 24, 300], ["p", "pit", 420, 500, 0.7, "#050102", "#ff7a3a"], ["hills", "#070202", 693, 524, 16, 300]], m: "embers", pn: 14, fx: ["heat"]},
    {n: "The Abyss", at: 0.9, re: /Abyss|Oberon|Vortigern|Worm|Insect|Final|Stars|Avalon/i, sky: ["#02030a", "#080c22", "#1c2a5a"], stars: 2, d: [["hills", "#0a1030", 701, 420, 30, 400], ["p", "pit", 800, 470, 1.6, "#000002", "#8a9aff"], ["hills", "#03040c", 702, 528, 12, 300]], m: "stars", pn: 14, fx: ["shoot", "pulse"]}]},
  309: {acts: [
    {n: "The taiga", sky: ["#060a1a", "#1a2450", "#5a4a9a"], stars: 1, t: [["aurora", "#c08aff", "#7fd8ff"]], d: [["peaks", "#1a2048", 711, 360, 130, 240], ["pines", "#0f1432", 712, 448, 140, 30], ["pines", "#070a1c", 713, 524, 90, 36]], m: "snow", pn: 8, fx: ["aurora"]},
    {n: "The sanctuary", at: 0.45, re: /Sanctuary|Koyan|Nikitich|Forest|Nest|Dobrynya|Taisui/i, sky: ["#0a0616", "#2a1050", "#a03a9a"], stars: 1, t: [["aurora", "#ff9ad8", "#c08aff"], ["meteor", "#ffd0f0", 1220, 110, 18]], d: [["peaks", "#221048", 721, 360, 130, 240], ["pines", "#140a30", 722, 448, 140, 30], ["pines", "#09051a", 723, 524, 90, 36]], m: "motes", pn: 12, fx: ["aurora"]},
    {n: "Nine tails of light", at: 0.8, re: /Tail|Beast|Vitch|Final|Calamity|Light|Tamamo/i, sky: ["#0a0414", "#3a0c4a", "#e05aa8"], stars: 1, d: [["p", "tails", 800, 470, 1, "#ff9ad8"], ["peaks", "#2a0c3a", 731, 372, 110, 240], ["pines", "#16061f", 732, 452, 130, 30], ["pines", "#0a030f", 733, 524, 90, 36]], m: "motes", pn: 12, fx: ["pulse"]}]},
  310: {acts: [
    {n: "The field of the fallen", sky: ["#0e0e14", "#2e2a34", "#7a6a6a"], d: [["city", "#24202a", 741, 396, "ruin", 40, 160, 220, "#c9a27a"], ["hills", "#18151c", 742, 456, 24, 300], ["p", "banner", 460, 480, 0.8, "#0a090d", "#6a1a3a"], ["p", "banner", 800, 486, 1, "#0a090d", "#c9a23a"], ["p", "banner", 1150, 480, 0.8, "#0a090d", "#3a5ab0"], ["p", "blades", 800, 512, 1, "#3a3440", 44, 743, 2300], ["hills", "#0a090d", 744, 524, 16, 300]], m: "dust", pn: 12, fx: ["mist"]},
    {n: "The realm of kings", at: 0.34, re: /Royal|Charlemagne|Karl|King|Castle|White|Paladin/i, sky: ["#101426", "#3a4a7a", "#d8d0c0"], d: [["hills", "#4a5270", 751, 380, 40, 360], ["p", "castle", 800, 452, 1, "#a8a8b8", "#fff2c0"], ["hills", "#2a3048", 752, 466, 24, 300], ["p", "blades", 800, 512, 1, "#1c2030", 30, 753, 2300], ["hills", "#10131f", 754, 524, 16, 300]], m: "dust", pn: 10},
    {n: "The realm of revenge", at: 0.62, re: /Reveng|Kriemhild|Night|Fire|Burn|Hatred/i, sky: ["#100408", "#3a0a14", "#8a1c2a"], d: [["hills", "#2a0a12", 761, 380, 40, 360], ["p", "castle", 800, 452, 1, "#12040a", "#ff5a4a"], ["hills", "#16050a", 762, 466, 24, 300], ["p", "blades", 800, 512, 1, "#3a0f18", 40, 763, 2300], ["hills", "#090204", 764, 524, 16, 300]], m: "embers", pn: 12, fx: ["heat"]},
    {n: "The way out of the dream", at: 0.88, re: /Exit|Dream|Moriarty|Final|Dawn|Wake|Thanatos|Fou/i, sky: ["#0a0c1c", "#3a3a6a", "#e8b8a0"], d: [["orb", 800, 384, 70, "#ffe0c0", 0.9], ["hills", "#3a3050", 771, 388, 36, 380], ["hills", "#1c1830", 772, 458, 24, 300], ["p", "blades", 800, 512, 1, "#0e0c1a", 36, 773, 2300], ["hills", "#0a0814", 774, 524, 16, 300]], m: "motes", pn: 10}]},
  311: {dir: "down", acts: [
    {n: "The scorched surface", sky: ["#0c0808", "#2a1410", "#6a2a14"], d: [["orb", 540, 262, 30, "#ff6a2a", 0.8], ["peaks", "#24100c", 781, 366, 210, 300], ["hills", "#160a08", 782, 452, 30, 300], ["hills", "#0a0504", 783, 520, 20, 300]], m: "embers", pn: 10, fx: ["flash", "heat"]},
    {n: "The Golden Sea of Trees", at: 0.06, re: /Golden Sea|Sea of Trees|Chich|Deinos|Jungle|Itza/i, sky: ["#0a1a10", "#2a5a2a", "#e8d070"], t: [["flock", "#0a2010", 6, 791, 560, 110, 700, 140, 1.2]], d: [["orb", 800, 70, 90, "#fff2b0", 1], ["canopy", "#2a5a2a", 791, 376, 50, 70], ["p", "ziggurat", 1060, 446, 0.7, "#1f4020", "#ffe9a8"], ["canopy", "#153a1c", 792, 456, 44, 56], ["canopy", "#0a2010", 793, 522, 34, 56]], m: "leaves", pn: 12},
    {n: "First Underworld: the river of falls", at: 0.2, re: /First Underworld|Tlatlau/i, sky: ["#06141a", "#0c3a4a", "#5ac0c0"], t: [["ceiling", "#041014", 801, 170]], d: [["orb", 800, 30, 60, "#d0f0e0", 0.6], ["city", "#0f3a44", 801, 300, "block", 0, 44, 0], ["p", "falls", 560, 456, 1, "#8ae0e0", 156], ["p", "falls", 830, 456, 1.2, "#8ae0e0", 130], ["p", "falls", 1110, 456, 0.9, "#8ae0e0", 173], ["p", "falls", 250, 456, 0.8, "#8ae0e0", 195], ["p", "falls", 1380, 456, 0.8, "#8ae0e0", 195], ["flat", "#0a2c38", 456], ["hills", "#05181f", 802, 524, 16, 300]], m: "motes", pn: 10, fx: ["shine", "mist"]},
    {n: "Second Underworld: the wind on the peaks", at: 0.34, re: /Second Underworld|Iztauh|Iztac/i, sky: ["#0a0e1a", "#2a3450", "#a8b8d0"], t: [["ceiling", "#070a12", 811, 140]], d: [["peaks", "#3a4866", 811, 336, 260, 200], ["peaks", "#232e48", 812, 436, 180, 180], ["peaks", "#10172a", 813, 524, 90, 160]], m: "snow", pn: 12, fx: ["mist"]},
    {n: "Third Underworld: the burning sand", at: 0.48, re: /Third Underworld|Xoxouh|Desert/i, sky: ["#1a0c08", "#6a2c14", "#f0a040"], t: [["ceiling", "#120806", 821, 120]], d: [["orb", 1150, 70, 70, "#ffd080", 0.9], ["hills", "#8a4a20", 821, 376, 60, 500], ["p", "ort", 420, 386, 0.5, "#3a1c10", "#9ae8ff"], ["hills", "#5a2c14", 822, 448, 40, 420], ["hills", "#2a1208", 823, 518, 24, 360]], m: "dust", pn: 12, fx: ["heat"]},
    {n: "Fourth Underworld: the caves of the bats", at: 0.62, re: /Fourth Underworld|Yayauh|Camazotz|Bat/i, sky: ["#07060e", "#18142e", "#3a2a5a"], t: [["ceiling", "#0a0816", 831, 260], ["flock", "#04030a", 30, 832, 800, 250, 1700, 220, 1.1]], d: [["orb", 800, 300, 40, "#c8b0ff", 0.35], ["peaks", "#120f24", 833, 408, 130, 160], ["p", "lights", 800, 440, 1, "#ff4a4a", 16, 834, 1700, 110], ["peaks", "#0a0816", 835, 476, 90, 140], ["hills", "#05040c", 836, 524, 14, 300]], m: "motes", pn: 6},
    {n: "The red plain under the sun", at: 0.8, re: /Mexico City|Mictl|Last Stand|Xibalba|Tezcatlipoca|Daybit|Meztitlan/i, sky: ["#160606", "#5a1410", "#d0401c"], d: [["orb", 800, 130, 120, "#e0402a", 1], ["hills", "#3a0f0c", 841, 386, 36, 420], ["p", "ziggurat", 800, 446, 1, "#1c0606", "#ff8a4a"], ["hills", "#130404", 842, 460, 24, 320], ["hills", "#080202", 843, 522, 16, 300]], m: "embers", pn: 10, fx: ["heat"]},
    {n: "Crystal Valley", at: 0.92, re: /Crystal|ORT|Cosmos|Final|Emptiness|Star|Kukulkan/i, sky: ["#02030c", "#0a0c2c", "#2a3a7a"], stars: 2, d: [["peaks", "#101a44", 851, 380, 120, 220], ["p", "crystals", 800, 470, 1, "#9ae8ff", 36, 852, 2300], ["p", "ort", 800, 452, 1.1, "#0c1030", "#bff4ff"], ["hills", "#04050f", 853, 524, 16, 300]], m: "stars", pn: 12, fx: ["shoot", "pulse"]}]},
  400: {acts: [
    {n: "The bleached Earth", sky: ["#0c1220", "#3a4a66", "#c8d4e4"], t: [["border", "#141c28", "#8ad0ff", 520, 250, 1], ["sigils", "#bfd0ff"]], d: [["flat", "#5f6e84", 410], ["hills", "#4a586c", 861, 470, 12, 520], ["flat", "#3a4658", 506]], m: "dust", pn: 8, fx: ["shoot"]}]},
  402: {acts: [
    {n: "The city under the paper moon", sky: ["#0c1024", "#2e3a66", "#c8c4b0"], t: [["paperMoon", "#2e3a66", "#f2ead0"]], d: [["city", "#2a3050", 871, 396, "block", 60, 200, 10, "#f2ead0"], ["city", "#1a1e38", 872, 456, "block", 40, 140, 8, "#f2ead0"], ["flat", "#0b0d1c", 470], ["p", "grid", 800, 470, 1, "#8a9ad8"]], m: "motes", pn: 10},
    {n: "Inside the compass", at: 0.4, re: /Inner|Compass|Garage|Meet|District|Area|Sector|Layer/i, sky: ["#080a1c", "#1c2456", "#6a7ad0"], stars: 1, t: [["paperMoon", "#1c2456", "#e8ecff"]], d: [["city", "#1c2250", 881, 396, "block", 60, 220, 10, "#8af0ff"], ["city", "#101434", 882, 456, "block", 40, 150, 8, "#8af0ff"], ["flat", "#070818", 470], ["p", "grid", 800, 470, 1, "#8af0ff"]], m: "motes", pn: 10, fx: ["pulse"]},
    {n: "The far side of the moon", at: 0.8, re: /Far Side|Kama|Durga|Mara|Final|Kazura|Alter Ego|Moon\b/i, sky: ["#06040f", "#1c0c3a", "#a03a8a"], stars: 1, t: [["paperMoon", "#1c0c3a", "#ffd0e8"]], d: [["city", "#1c0c36", 891, 396, "block", 60, 220, 10, "#ff9ad8"], ["city", "#0e0620", 892, 456, "block", 40, 150, 8, "#ff9ad8"], ["flat", "#06030e", 470], ["p", "grid", 800, 470, 1, "#ff9ad8"]], m: "petals", pn: 10, fx: ["pulse"]}]},
  403: {acts: [
    {n: "The school at dusk", sky: ["#10101e", "#4a2a44", "#e8935a"], t: [["flock", "#0c0812", 5, 901, 1080, 110, 420, 90, 0.8]], d: [["orb", 300, 340, 50, "#ffc080", 0.8], ["city", "#2a1a30", 901, 396, "modern", 80, 220, 8, "#ffd08a"], ["p", "school", 800, 458, 1, "#1a1020", "#ffd08a"], ["hills", "#0c0812", 902, 522, 14, 400]], m: "petals", pn: 8},
    {n: "The night with no way out", at: 0.4, re: /Night|Loop|Prison|City|Street|Dormitor|Roof/i, sky: ["#06060e", "#16142c", "#3a2a55"], stars: 1, d: [["orb", 1200, 130, 34, "#d8d8e8", 0.6], ["city", "#14122a", 911, 396, "modern", 80, 220, 8, "#8a9ad8"], ["p", "school", 800, 458, 1, "#0c0a1a", "#8a9ad8"], ["hills", "#06050c", 912, 522, 14, 400]], m: "rain", pn: 10, fx: ["mist"]},
    {n: "Gehenna", at: 0.75, re: /Gehenna|Hell|Fire|Flame|Final|Avenger|Vengeance|Id\b/i, sky: ["#100204", "#3a0608", "#b0200c"], d: [["city", "#200608", 921, 396, "ruin", 60, 200, 30, "#ff7a3a"], ["p", "school", 800, 458, 1, "#0e0203", "#ff7a3a"], ["hills", "#070102", 922, 522, 14, 400]], m: "embers", pn: 14, fx: ["heat"]}]},
  404: {acts: [
    {n: "Dubai, far from now", sky: ["#0a1430", "#2a5a9a", "#f0c890"], d: [["orb", 1220, 190, 50, "#fff2c0", 0.9], ["city", "#24406e", 931, 396, "modern", 120, 300, 10, "#8ae8ff"], ["p", "needle", 800, 452, 0.95, "#16284a", "#8ae8ff"], ["p", "sail", 1090, 452, 1, "#16284a"], ["p", "wheel", 450, 452, 0.8, "#16284a"], ["flat", "#123a66", 452], ["p", "palm", 300, 520, 1, "#0a1a30"], ["p", "palm", 1300, 524, 1.1, "#0a1a30"], ["hills", "#0a1a30", 932, 524, 14, 420]], m: "motes", pn: 10, fx: ["shine"]},
    {n: "The city of lights", at: 0.4, re: /Night|BB|Casino|Tower|Festival|District|Resort/i, sky: ["#06061a", "#1a1450", "#c03a8a"], stars: 1, d: [["city", "#1a1648", 941, 396, "modern", 120, 300, 10, "#ff5ad0"], ["p", "needle", 800, 452, 0.95, "#0e0c2c", "#ff5ad0"], ["p", "sail", 1090, 452, 1, "#0e0c2c"], ["p", "wheel", 450, 452, 0.8, "#3a2a7a"], ["flat", "#0c0a30", 452], ["p", "palm", 300, 520, 1, "#060516"], ["p", "palm", 1300, 524, 1.1, "#060516"], ["hills", "#060516", 942, 524, 14, 420]], m: "motes", pn: 12, fx: ["shoot", "shine"]},
    {n: "Above the Earth", at: 0.78, re: /Space|Orbit|Earth|Archetype|Final|Star|Beast|Moon/i, sky: ["#02030a", "#080a22", "#141c44"], stars: 2, d: [["orb", 1230, -170, 40, "#e8ecf6", 0.6], ["orb", 800, 880, 560, "#1c4a9a", 0.5]], m: "stars", pn: 14, fx: ["shoot", "shoot2"]}]}
};

/* ---------- drawing ---------- */
function scPaths(items) {
  let h = "";
  for (const it of items || []) {
    if (!it || !it.d) continue;
    const o = it.o != null && it.o < 1 ? ` opacity="${it.o}"` : "";
    if (it.s) h += `<path d="${it.d}" fill="none" stroke="${scTone(it.s)}" stroke-width="${(it.w || 2).toFixed(1)}" stroke-linecap="round"${it.dash ? ` stroke-dasharray="${it.dash}"` : ""}${o}/>`;
    else h += `<path d="${it.d}" fill="${scTone(it.f || "#000000")}"${it.eo ? ` fill-rule="evenodd"` : ""}${o}/>`;
  }
  return h;
}
function scLandSVG(list) {
  let h = "";
  for (const it of list || []) {
    const k = it[0];
    if (k === "orb") { const x = it[1], y = it[2], r = it[3], c = scTone(it[4]), g = it[5] == null ? 0.7 : it[5]; h += `<circle cx="${x}" cy="${y}" r="${scN(r * 2.7)}" fill="${c}" opacity="${(g * 0.1).toFixed(2)}"/><circle cx="${x}" cy="${y}" r="${scN(r * 1.7)}" fill="${c}" opacity="${(g * 0.2).toFixed(2)}"/><circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity="${Math.min(1, g + 0.1).toFixed(2)}"/>`; }
    else if (k === "p") { const fn = SCP[it[1]]; if (fn) h += scPaths(fn.apply(null, it.slice(2))); }
    else if (k === "city") { const out = SCG.city(it[2], it[3], it[4], it[5], it[6], it[7]); h += `<path d="${out[0]}" fill="${scTone(it[1])}"/>`; if (it[8] && out[1]) h += `<path d="${out[1]}" fill="${scTone(it[8])}" opacity=".7"/>`; }
    else if (k === "flat") h += `<path d="${SCG.flat(it[2])}" fill="${scTone(it[1])}"/>`;
    else if (SCG[k]) h += `<path d="${SCG[k].apply(null, it.slice(2))}" fill="${scTone(it[1])}"/>`;
  }
  return h;
}
function scTopSVG(list) {
  let h = "";
  for (const it of list || []) {
    if (it[0] === "p") { const fn = SCP[it[1]]; if (fn) h += scPaths(fn.apply(null, it.slice(2))); }
    else { const fn = SCK[it[0]]; if (fn) h += scPaths(fn.apply(null, it.slice(1))); }
  }
  return h;
}
const SC_FX = {heat: `<b class="sb-heat"></b>`, flash: `<b class="sb-flash"></b>`, mist: `<b class="sb-mist"></b>`, mist2: `<b class="sb-mist m2"></b>`, shoot: `<b class="sb-shoot"></b>`, shoot2: `<b class="sb-shoot s2"></b>`,
  shine: `<b class="sb-shine"></b><b class="sb-shine s2"></b>`, pulse: `<b class="sb-pulse"></b>`, aurora: `<b class="sb-aurora"></b>`};
function scPartsHTML(c, act) {
  const m = act.m, n = act.pn || 10; if (!m) return "";
  let seed = c.id * 7919 + 17; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let h = "";
  for (let i = 0; i < n; i++) {
    const x = (r() * 100).toFixed(1), y = (r() * (m === "stars" ? 46 : 100)).toFixed(1), s = (0.55 + r() * 0.9).toFixed(2), d = (m === "rain" ? 0.9 + r() * 0.8 : m === "stars" ? 2.5 + r() * 4 : 9 + r() * 14).toFixed(1);
    const dl = (-r() * 20).toFixed(1), k = m === "icefire" ? (i % 2 ? 2 : 1) : 1 + (i % 3), rz = Math.round(r() * 360), sw = ((r() - 0.5) * 12).toFixed(1);
    h += `<i class="k${k}" style="--x:${x}%;--y:${y}%;--s:${s};--d:${d}s;--dl:${dl}s;--r:${rz}deg;--sw:${sw}vw;--i:${i}"></i>`;
  }
  return h;
}
/* ---------- depth ----------
   The drawing is taken apart into sheets (the sky's things, each row of silhouettes with its landmarks), each with a
   depth. A camera moves (with the pointer, with the page's scroll, and through the scene when the story moves on) and
   near sheets pass far ones as they would in perspective.
   0.52.1: the sheets used to hang in a real CSS 3D space. That made every sheet a drawing pass of its own for the
   graphics card (7 to 12 full-screen passes a frame), and Noyr's frame rate dropped. Now each sheet is moved and
   sized with a plain 2D transform worked out from its depth: the same motion, one pass. Only transforms change; the
   sheets are never painted again. */
const SC_P = 1000, SC_FAR = 1400, SC_MAXPL = 5;
const scIsRow = (it) => it[0] === "city" || it[0] === "flat" || !!SCG[it[0]];
// the window's measures the depth is worked out from (the same numbers the CSS uses, written onto #story-bg)
function scMetrics() {
  const bg = document.getElementById("story-bg"), H = (bg && bg.clientHeight) || window.innerHeight, W = (bg && bg.clientWidth) || window.innerWidth, scw = Math.min(Math.max(W, 1000), 1.75 * H);
  return {H: H, W: W, scw: scw, k: scw / 1600, Oy: 0.7 * H};
}
function scPlanes(act, M) {
  const rows = [], pre = [];
  let cur = null;
  for (const it of act.d || []) { if (scIsRow(it)) { cur = [it]; rows.push(cur); } else (cur || pre).push(it); }
  while (rows.length > SC_MAXPL) rows.splice(0, 2, rows[0].concat(rows[1])); // the furthest two share a sheet
  const n = rows.length, out = [];
  if (act.t && act.t.length) out.push({k: "top", z: -SC_FAR * 1.2, h: scTopSVG(act.t)});
  if (pre.length) out.push({k: "land", z: -SC_FAR * 1.06, h: scLandSVG(pre)});
  rows.forEach((r, i) => {
    const z = n > 1 ? -SC_FAR * (n - 1 - i) / (n - 1) : 0;
    // level ground or water is a real floor: in front of the flat sheet it lies down from its line towards the eye, as
    // far as the next row (nothing in a scene crosses anything else, so near and far never have to be worked out)
    out.push({k: "land", z: z, h: scLandSVG(r)});
    if (r[0][0] === "flat") {
      const zn = i < n - 1 ? -SC_FAR * (n - 2 - i) / (n - 1) - 2 : 620, sc = (SC_P - z) / SC_P, line = M.H - (560 - r[0][2]) * M.k;
      out.splice(out.length - 1, 0, {k: "floor", z: z, zn: zn, c: r[0][1], first: !out.some((o) => o.k === "floor"), line: line, Yw: M.Oy + (line - M.Oy) * sc});
      out[out.length - 1].flat = true; // (this sheet is the water or ground itself: the 3D sea of 59-bg3d.js takes its place)
      // (the row's own things, a ship, stand on the far edge: they go on a sheet after the floor)
      if (r.length > 1) { out[out.length - 1].h = scLandSVG([r[0]]); out.push({k: "land", z: z, h: scLandSVG(r.slice(1))}); }
    }
  });
  // (what lies beyond the first water or ground reaches down behind it; under a 3D sea, which is behind every sheet,
  // those sheets are cut off at the waterline so the sea shows: 59-bg3d.js, 38-bg3d.css)
  const f0 = out.findIndex((o) => o.k === "floor");
  if (f0 > 0) out.slice(0, f0).forEach((o) => { if (o.k === "land") o.cut = out[f0].line; });
  return out;
}
// (drawn at a quarter of its size and scaled up: it's soft bands of colour, and a floor this long would be a huge picture)
// what a sheet at depth z needs to move as depth would move it, with plain 2D transforms: --c how far it follows the
// camera (1 for the nearest, about 0 for the furthest, a little the other way for the sky), --f how much of a move
// up or down reaches it, --kin and --kout its size when the camera is far behind the scene or flying into it
function scPlVars(z) {
  const f = SC_P / (SC_P - z);
  return `--z:${Math.round(z)}px;--c:${((f - 0.45) / 0.55).toFixed(3)};--f:${f.toFixed(3)};--kin:${((SC_P - z) / (SC_P - z + 1100)).toFixed(3)};--kout:${((SC_P - z) / (SC_P - z - 640)).toFixed(3)}`;
}
function scFloorHTML(pl, act, M) {
  const s = (SC_P - pl.z) / SC_P, c = scTone(pl.c), far = scTone(scMix(pl.c, act.sky[2], pl.first ? 0.2 : 0)), line = scTone(scMix(pl.c, act.sky[2], 0.6)), L = pl.zn - pl.z;
  // its twin for the flat picture: the same floor as it looks with the camera home, as one gradient down the window
  const at = (d) => M.Oy + (pl.Yw - M.Oy) * SC_P / (SC_P - (pl.z + d)) - pl.line;
  const col = (t) => { const base = scMix(far, c, Math.min(1, t / 0.55)), haze = Math.max(0, 1 - t / 0.34); return [scMix(base, far, haze), haze]; };
  const stops = [], room = M.H - pl.line + 40, end = Math.min(at(L), room);
  for (let i = 0; i <= 16; i++) { const t = i / 16, y = at(t * L); if (y > room && i) break; stops.push([y, col(t)[0]]); }
  for (let d = 52; d < L; d += 56) {
    const ya = at(d), yb = at(d + 6); if (ya > room) break; if (yb - ya < 1) continue;
    const cc = col((d + 3) / L), band = scMix(cc[0], line, 0.2 * (1 - cc[1]));
    stops.push([ya, cc[0]], [ya, band], [yb, band], [yb, cc[0]]);
  }
  stops.sort((a, b) => a[0] - b[0]);
  return `<div class="sc-pl sc-ff" style="${scPlVars(pl.z)};top:${pl.line.toFixed(1)}px;height:${(Math.max(0, end) + 90).toFixed(1)}px;transform-origin:50% ${(M.Oy - pl.line).toFixed(1)}px;background:linear-gradient(to bottom, ${stops.map((st) => st[1] + " " + st[0].toFixed(1) + "px").join(", ")})"></div>`;
}
/* A sheet is a picture, drawn once (0.52.2). The drawing is vector paths, and it used to stay an <svg> on the page.
   Firefox draws SVG on the processor and did so again whenever something moved over or with it, which cost Noyr most
   of his frame rate there (Edge kept it as a texture). So each sheet's paths are drawn a single time into a still
   canvas the size of the window plus a margin, and from then on the browser only moves a bitmap. Nothing is ever
   drawn on these canvases again: they are pictures, not animations. */
const SC_MX = 110;
// how high each sheet's drawing reaches (and how low the sky's things hang), so its picture is no bigger than it has
// to be: a picture's empty part still costs the graphics card on every frame
function scMeasure(planes) {
  const ns = "http://www.w3.org/2000/svg", sv = document.createElementNS(ns, "svg");
  sv.setAttribute("style", "position:absolute;left:-9999px;top:0;width:10px;height:10px;visibility:hidden;overflow:hidden");
  try {
    sv.innerHTML = planes.map((pl) => `<g>${pl.h || ""}</g>`).join("");
    document.body.appendChild(sv);
    Array.from(sv.children).forEach((g, i) => { const pl = planes[i]; if (!pl.h) return; const b = g.getBBox(); if (b && b.height > 0) { pl.y0 = b.y; pl.y1 = b.y + b.height; } });
  } catch (e) {}
  sv.remove();
  return planes;
}
function scSheetHTML(pl, M, jobs) {
  const top = pl.k === "top", y0 = top ? -60 : Math.max(-230, Math.floor(pl.y0 == null ? -230 : pl.y0) - 8), y1 = top ? Math.min(560, Math.ceil(pl.y1 == null ? 560 : pl.y1) + 8) : 640, wi = M.W + SC_MX * 2, hi = (y1 - y0) * M.k, vw = wi / M.k, y = top ? y0 * M.k : M.H - (560 - y0) * M.k;
  const rs = Math.min(window.devicePixelRatio || 1, 1.25), cw = Math.max(2, Math.round(wi * rs)), ch = Math.max(2, Math.round(hi * rs));
  jobs.push({svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${cw}" height="${ch}" viewBox="${(800 - vw / 2).toFixed(1)} ${y0} ${vw.toFixed(1)} ${y1 - y0}" preserveAspectRatio="none">${pl.h}</svg>`, w: cw, h: ch});
  return `<canvas class="sc-pl sc-${pl.k}${pl.flat ? " sc-flat" : ""}${pl.cut != null ? " sc-far" : ""}" width="${cw}" height="${ch}" data-job="${jobs.length - 1}" style="${scPlVars(pl.z)};${pl.cut != null ? `--cutb:${Math.max(0, y + hi - pl.cut).toFixed(1)}px;` : ""}left:${-SC_MX}px;width:${wi.toFixed(1)}px;top:${y.toFixed(1)}px;height:${hi.toFixed(1)}px;transform-origin:50% ${(M.Oy - y).toFixed(1)}px" aria-hidden="true"></canvas>`;
}
function scRaster(el, jobs) {
  el.querySelectorAll("canvas[data-job]").forEach((cv) => {
    const j = jobs[Number(cv.dataset.job)]; if (!j) return;
    const im = new Image();
    im.onload = () => { try { cv.getContext("2d").drawImage(im, 0, 0, j.w, j.h); cv.dataset.drawn = "1"; } catch (e) {} };
    im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(j.svg);
  });
}
// the sky's three colours in this theme, top to horizon
// (in the dark theme the horizon is pulled a little towards the sky above it: the page's words lie on it)
const scSky = (act) => (isDark() ? [act.sky[0], act.sky[1], scMix(act.sky[2], act.sky[1], 0.32)] : act.sky).map(scTone);
const scSkyCss = (sky) => `linear-gradient(to bottom, ${sky[0]} 0%, ${sky[1]} 46%, ${sky[2]} 84%, ${scMix(sky[2], sky[1], 0.5)} 100%)`;
function scSceneHTML(act, M) {
  const jobs = [];
  const sky = scSky(act);
  return {bg: scSkyCss(sky),
    html: `${act.stars && isDark() ? `<div class="sc-stars s${act.stars}"></div>` : ""}<div class="sc-cam">${scMeasure(scPlanes(act, M)).map((pl) => pl.k === "floor" ? scFloorHTML(pl, act, M) : scSheetHTML(pl, M, jobs)).join("")}</div><div class="sc-veil"></div>`, jobs: jobs};
}

/* ---------- which act ---------- */
// how far through the chapter the position is (0–1), and the sections up to it; null while NA's data hasn't arrived
function scWhere(c, pos) {
  const w = ST.wars[c.id]; if (!w || !w.q || !w.q.length || !pos) return null;
  const i = w.q.findIndex((q) => q.id === pos.q); if (i < 0) return null;
  return {i: i, n: w.q.length, frac: w.q.length > 1 ? i / (w.q.length - 1) : 0, qs: w.q};
}
function scActOf(c, pos) {
  const sc = SCENES[c.id]; if (!sc) return 0;
  const wh = scWhere(c, pos); if (!wh) return 0;
  const text = (q) => (q.n || "") + " | " + (q.sp || "") + " | " + (q.lab || "");
  // names work for this chapter when at least one act's name is found somewhere in it
  const named = sc.acts.map((a) => a.re ? wh.qs.findIndex((q) => a.re.test(text(q))) : -1), byName = named.some((v) => v >= 0);
  let best = 0;
  sc.acts.forEach((a, k) => {
    if (!k) return;
    // (a scene whose name isn't in the data goes by how far through the chapter you are, but never past a named
    // scene you haven't reached)
    const hit = byName && named[k] >= 0 ? named[k] <= wh.i : wh.frac >= (a.at == null ? 2 : a.at) - 1e-9 && !(byName && named.some((v, j) => j < k && v > wh.i));
    if (hit) best = k;
  });
  return best;
}
let scForce = null; // for the tests and for looking at a scene: {w, a}
const scNow = () => { if (scForce) { const c = STORY_BY.get(scForce.w); return c && SCENES[c.id] ? {c: c, a: clamp(scForce.a, 0, SCENES[c.id].acts.length - 1)} : null; } const c = storyOn() ? STORY_BY.get(ST.pos.w) : null; return c && SCENES[c.id] ? {c: c, a: scActOf(c, ST.pos)} : null; };

/* ---------- painting it ---------- */
storyBgHTML = function () { return ""; };
let scKey = "";
function scPaint() {
  const bg = document.getElementById("story-bg"); if (!bg) return;
  const now = scNow();
  if (!now) { if (!bg.classList.contains("on")) { scKey = ""; } return; }
  const c = now.c, sc = SCENES[c.id], act = sc.acts[now.a], key = c.id + "|" + now.a + "|" + (isDark() ? "d" : "l");
  if (key === scKey && bg.querySelector(".sc")) return;
  // the camera travels to a new scene: forward through the old one (back out of it when the story goes back); in a
  // chapter that goes down (Nahui Mictlān) it sinks, the old stratum rising past
  const prev = scKey.split("|"), same = prev[0] === String(c.id), moved = !!scKey && prev[2] === (isDark() ? "d" : "l") && !RM.matches && !!bg.querySelector(".sc");
  const down = !same || now.a > Number(prev[1]), vert = same && sc.dir === "down";
  const M = scCamSize();
  scKey = key;
  bg.dataset.m = act.m || ""; bg.dataset.ch = String(c.id); bg.dataset.act = String(now.a);
  const built = scSceneHTML(act, M), el = document.createElement("div");
  el.className = "sc" + (moved ? " in" + (vert ? (down ? " from-below" : " from-above") : down ? "" : " back") : "");
  el.style.background = built.bg; el.innerHTML = built.html; scRaster(el, built.jobs);
  // (the old look's glows and wheel of light, if the page drew them before this file ran, go too)
  bg.querySelectorAll(".sc-live, .sb-parts, :scope > b").forEach((x) => x.remove());
  const olds = Array.from(bg.querySelectorAll(".sc"));
  if (moved) olds.forEach((o) => { o.classList.remove("in", "from-below", "from-above"); o.classList.add("out"); if (vert) o.classList.add(down ? "to-above" : "to-below"); else if (!down) o.classList.add("back"); setTimeout(() => o.remove(), 1900); });
  else olds.forEach((o) => o.remove());
  bg.appendChild(el);
  if (moved) setTimeout(() => el.classList.remove("in", "from-below", "from-above", "back"), 2300);
  const warm = scTone(act.sky[2]), pale = scTone(scMix(act.sky[2], "#ffffff", 0.4));
  bg.insertAdjacentHTML("beforeend", `<div class="sc-live" style="--c1:${warm};--c2:${scTone(act.sky[1])};--c3:${pale}">${(act.fx || []).map((f) => SC_FX[f] || "").join("")}</div><div class="sb-parts">${scPartsHTML(c, act)}</div>`);
  scCaption();
}
/* ---------- the camera ----------
   It leans after the pointer and sinks a little as the page scrolls. One style write at most every 110 ms, eased by a
   CSS transition; nothing runs while the pointer is still. */
let scCamX = 0, scCamY = 0, scCamS = 0, scCamT = 0, scCamHold = null;
// Settings: the scene can be kept still (spirit-origin-list:v1:scenecam = "off")
const SCCAM_KEY = "spirit-origin-list:v1:scenecam";
let scCamOn = lsGet(SCCAM_KEY) !== "off";
function scCamPaintSet() { document.querySelectorAll('[data-action="scenecam"]').forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.v === "1") === scCamOn))); }
function setSceneCam(on, quiet) {
  scCamOn = !!on; try { if (scCamOn) localStorage.removeItem(SCCAM_KEY); else localStorage.setItem(SCCAM_KEY, "off"); } catch (e) {}
  scCamPaintSet(); scCamApply();
  if (!quiet) toastAction(scCamOn ? "Story scenes follow the pointer again." : "Story scenes stay still now.", "Undo", () => setSceneCam(!scCamOn, true));
}
document.addEventListener("click", (e) => { const b = e.target.closest && e.target.closest('[data-action="scenecam"]'); if (!b) return; const on = b.dataset.v === "1"; if (on !== scCamOn) setSceneCam(on); });
// the pointer hasn't moved for a while: the camera goes home
let scHomeT = 0;
function scHomeSoon() { clearTimeout(scHomeT); scHomeT = setTimeout(() => { if (scCamHold) return; scCamX = 0; scCamY = 0; scCamApply(); }, 6000); }
function scCamSize() { const bg = document.getElementById("story-bg"), M = scMetrics(); if (bg) { bg.style.setProperty("--sch", M.H + "px"); bg.style.setProperty("--scw", M.scw.toFixed(1) + "px"); } return M; }
function scCamApply() {
  scCamT = 0;
  const bg = document.getElementById("story-bg"); if (!bg || !bg.querySelector(".sc")) return;
  // the move is eased in steps at the background's frame rate (half the chosen one with power saving): a smooth 60 a
  // second here would make the whole window redraw twice as often as everything else on the page asks for
  const fpsNow = typeof ambFps === "function" ? ambFps() : 30;
  bg.style.setProperty("--sce", fpsNow >= 60 ? "cubic-bezier(.2, .7, .2, 1)" : `steps(${Math.max(6, Math.round(0.9 * fpsNow))}, end)`);
  const still = RM.matches || !scCamOn, x = still ? 0 : scCamHold ? scCamHold[0] : scCamX, y = still ? 0 : scCamHold ? scCamHold[1] : scCamY, sy = still ? 0 : scCamS;
  bg.style.setProperty("--cx", (-x * 44).toFixed(1) + "px"); bg.style.setProperty("--cy", (-y * 18 + sy * 30).toFixed(1) + "px");
}
const scCamAsk = () => { if (!scCamT && scKey) scCamT = setTimeout(scCamApply, 110); };
window.addEventListener("pointermove", (e) => { if (e.pointerType === "touch" || !scKey) return; scCamX = clamp(e.clientX / window.innerWidth * 2 - 1, -1, 1); scCamY = clamp(e.clientY / window.innerHeight * 2 - 1, -1, 1); if (!scCamOn) return; scCamAsk(); scHomeSoon(); }, {passive: true});
window.addEventListener("scroll", () => { if (!scKey || !scCamOn) return; scCamS = clamp(window.scrollY / 900, 0, 1); scCamAsk(); }, {passive: true});
// a floor's place is worked out in pixels: a window of another size gets the scene laid out again
let scSizeT = 0;
window.addEventListener("resize", () => { clearTimeout(scSizeT); scSizeT = setTimeout(() => { if (!scKey) return; scKey = ""; try { scPaint(); } catch (e) {} }, 250); });
// the Story page says which scene is up
function scCaption() {
  const p = document.querySelector("#story .st-pos"); if (!p) return;
  let cap = p.parentElement.querySelector(".st-scene");
  const now = !ST.other && ST.theme && ST.pos && SCENES[ST.pos.w] ? {c: STORY_BY.get(ST.pos.w), a: scActOf(STORY_BY.get(ST.pos.w), ST.pos)} : null;
  if (!now) { if (cap) cap.remove(); return; }
  const acts = SCENES[now.c.id].acts, t = `Backdrop: <b>${esc(acts[now.a].n)}</b>${acts.length > 1 ? ` <span>· scene ${now.a + 1} of ${acts.length}, it changes as you move through the chapter</span>` : ""}`;
  if (!cap) { p.insertAdjacentHTML("afterend", `<p class="st-scene"></p>`); cap = p.parentElement.querySelector(".st-scene"); }
  if (cap.dataset.t !== t) { cap.dataset.t = t; cap.innerHTML = t; }
}
const storyPaint57 = storyPaint;
storyPaint = function () { const r = storyPaint57.apply(this, arguments); try { scPaint(); } catch (e) { console.error(e); } return r; };
const renderStory57 = renderStory;
renderStory = function () { const r = renderStory57.apply(this, arguments); try { scCaption(); } catch (e) {} return r; };
// a new position on the Story page: the scene may have moved on
const storySetPos57 = storySetPos;
storySetPos = function () { const r = storySetPos57.apply(this, arguments); setTimeout(() => { try { scPaint(); } catch (e) {} }, 0); return r; };
scPaint();
// for the tests, and for looking through the scenes
window.__fgiScene = {
  // (for the tests) travel from the scene that's up to another one, as the story moving on does
  go: (w, a) => { scForce = {w: w, a: a | 0}; scPaint(); },
  // (for the tests) put the camera somewhere: x and y from -1 to 1; null gives it back to the pointer
  camOn: () => scCamOn,
  cam: (x, y) => { scCamHold = x == null ? null : [x, y]; scCamApply(); },
  planes: () => Array.from(document.querySelectorAll("#story-bg .sc:not(.out) .sc-pl")).map((e) => ({k: e.classList.contains("sc-top") ? "top" : e.classList.contains("sc-ff") ? "floor" : "land", z: parseFloat(e.style.getPropertyValue("--z"))})),
  list: () => Object.keys(SCENES).map((k) => ({w: Number(k), n: STORY_BY.get(Number(k)).n, acts: SCENES[k].acts.map((a) => a.n), dir: SCENES[k].dir || "fade"})),
  now: () => { const n = scNow(); return n ? {w: n.c.id, a: n.a, n: SCENES[n.c.id].acts[n.a].n, of: SCENES[n.c.id].acts.length} : null; },
  actFor: (w, names, i) => { const c = STORY_BY.get(w); const keep = ST.wars[w]; ST.wars[w] = {q: names.map((n, k) => ({id: k + 1, n: n, sp: "", lab: ""}))}; const a = scActOf(c, {w: w, q: i + 1, ph: 1}); if (keep) ST.wars[w] = keep; else delete ST.wars[w]; return a; },
  // look at one scene, whatever the story position is (null puts the real one back). For the tests and for checking the drawings
  show: (w, a) => {
    scForce = w == null ? null : {w: w, a: a | 0}; scKey = "";
    if (w == null) { storyRepaint(); return; }
    const c = STORY_BY.get(w);
    let bg = document.getElementById("story-bg");
    if (!bg) { document.querySelector(".page-bg").insertAdjacentHTML("afterend", `<div id="story-bg" class="story-bg" aria-hidden="true"></div>`); bg = document.getElementById("story-bg"); }
    bg.querySelectorAll(".sc").forEach((x) => x.remove());
    document.documentElement.classList.add("story-on"); bg.classList.add("on"); bg.classList.toggle("lt", !isDark()); bg.style.cssText = palVars(c);
    curPal = c.pal; curExtra = hexToRgb(c.pal[0]); PAGE.pal = c.pal.map(hexToRgb); paintPage(); setIdle(true);
    const idle = document.getElementById("idle-bg"); if (idle) { idle.dataset.st = String(c.id); idle.classList.add("st-tint"); idle.style.cssText = palVars(c); }
    scPaint();
  }
};
scCamPaintSet();
const renderSettings57 = typeof renderSettings === "function" ? renderSettings : null;
if (renderSettings57) renderSettings = function () { const r = renderSettings57.apply(this, arguments); scCamPaintSet(); return r; };
