/* ================= 0.53.0-beta: a 3D background for every class =================
   Noyr: custom vanta.js backgrounds for all classes, including the Beasts, Draco (Sodom's Beast) and Space Ereshkigal.
   On a servant's page (Servants, with a servant open) the 3D background of 59-bg3d.js becomes their class's, in the
   colours of the picture you gave them (each class has colours of its own for servants without one):

   Saber      blades       swords of light hanging in the dark, turning slowly as they rise      (3D, our own)
   Archer     arrows       a volley falling through the depth of the sky                           (3D, our own)
   Lancer     thrust       a charge: lines of speed rushing to a point                             (shader, our own)
   Rider      birds        a flock in flight                                                       (vanta)
   Caster     magecraft    a magic circle turning: rings, runes and a six-pointed star             (shader, our own)
   Assassin   fog          low dark mist                                                           (vanta)
   Berserker  frenzy       cells of red that throb with a heartbeat                                (shader, our own)
   Ruler      judgement    light falling from above, with motes                                    (shader, our own)
   Avenger    flames       dark fire rising, with embers                                           (shader, our own)
   Moon Cancer dots        SE.RA.PH's grid of light                                                (vanta)
   Alter Ego  datasea      a sea of data: a grid of light rolling in waves, data falling above it  (shader, our own)
   Foreigner  void         the outer dark, folding on itself, with stars                           (shader, our own)
   Pretender  net          a web of points, a lie that holds                                       (vanta)
   Shielder   hex          a barrier of hexagons, a wave of light crossing it                      (shader, our own)
   Beast      calamity     a storm, now and then a flash                                           (shader, our own)
   Draco      draco        a crimson vortex with gold petals falling: Sodom's Beast                (shader, our own)
   Space Ereshkigal speresh stars streaming past, and the ring of her underworld                   (shader, our own)

   Our own are vanta effects: built on VANTA.VantaBase and registered with VANTA.register, so 59-bg3d.js starts, recolours,
   paces and stops them like vanta's own (frame rate, power saving, rest, size). Shaders take a few noise passes on
   under half a megapixel; the two 3D ones draw a hundred-odd small pieces. Settings → Class backgrounds switches it off.
   An effect that won't start in a browser gives way to haze, without switching 3D off. */
const BG3D_CLS_KEY = "spirit-origin-list:v1:bg3d-cls"; // "off": the usual effect on servant pages too
let bg3dCls = lsGet(BG3D_CLS_KEY) !== "off";
Object.assign(BG3D_PX, {blades: 0.9, arrows: 0.9, thrust: 0.45, judgement: 0.4, flames: 0.4, void: 0.35, hex: 0.5, calamity: 0.35, draco: 0.38, speresh: 0.45, magecraft: 0.5, frenzy: 0.45, datasea: 0.45, birds: 0.7, dots: 0.9});

/* ---------- each class: its effect and colours ([main, deep, light]) ---------- */
const CB_THEME = {
  Saber: {k: "blades", c: ["#4f82e6", "#16264f", "#d8e6ff"]}, Archer: {k: "arrows", c: ["#e0524a", "#3a1010", "#ffd8b4"]},
  Lancer: {k: "thrust", c: ["#36bfe0", "#0d2f3a", "#cdf4ff"]}, Rider: {k: "birds", c: ["#e6ae40", "#3b2a10", "#fff2c9"]},
  Caster: {k: "magecraft", c: ["#a066f2", "#241042", "#e8d8ff"]}, Assassin: {k: "fog", c: ["#8a78ac", "#151020", "#d6cdea"]},
  Berserker: {k: "frenzy", c: ["#e8392f", "#2a0606", "#ffa072"]}, Ruler: {k: "judgement", c: ["#f2c95c", "#3a2e10", "#fff7da"]},
  Avenger: {k: "flames", c: ["#ff5038", "#1f0505", "#ffc472"]}, "Moon Cancer": {k: "dots", c: ["#ff62ca", "#2a0c2c", "#ffd6f2"]},
  "Alter Ego": {k: "datasea", c: ["#44dbff", "#0a2733", "#d6fbff"]}, Foreigner: {k: "void", c: ["#40e2ca", "#071d22", "#cbaaff"]},
  Pretender: {k: "net", c: ["#5ee9a4", "#0c2a1c", "#e8ffd6"]}, Shielder: {k: "hex", c: ["#6eaaff", "#101c38", "#e6efff"]},
  Beast: {k: "calamity", c: ["#ff5cb6", "#2a0518", "#ffd36a"]},
  Draco: {k: "draco", c: ["#e8223f", "#2a0308", "#f6c75c"], sig: 0.55}, Speresh: {k: "speresh", c: ["#ff52a0", "#120428", "#a2eaff"], sig: 0.5}
};
const cbKey = (s) => !s ? "" : s.cls === "Beast" && /draco|sodom/i.test(s.name || "") ? "Draco" : s.cls === "Beast" && /space ereshkigal|speresh/i.test(s.name || "") ? "Speresh" : CB_THEME[s.cls] ? s.cls : "";
// the colours: the servant's picture where there is one (the Beasts keep half of their own), else the class's
function cbCols(t, dark) {
  const own = palServant(), w = own ? (t.sig || 0.3) : 1;
  const base = [0, 1, 2].map((i) => own ? scMix(curPal[i], t.c[i], w) : t.c[i]);
  const T = (hx, L, v) => toHex(toneOf(hx, L, dark, v));
  return dark ? {bg: T(base[1], 0.045, false), c2: T(base[1], 0.26, true), c1: T(base[0], 0.56, true), c3: T(base[2], 0.82, true), lt: 0}
    : {bg: scMix("#f3ecdd", T(base[1], 0.86, false), 0.35), c2: T(base[1], 0.7, true), c1: T(base[0], 0.42, true), c3: T(base[2], 0.3, true), lt: 1};
}
function cbOpts(k, C, dark) {
  const S3 = {backgroundColor: C.bg, color: C.c1, color2: C.c2, color3: C.c3, light: C.lt};
  if (k === "birds") return {backgroundColor: C.bg, color1: C.c1, color2: C.c3, colorMode: "lerpGradient", birdSize: 1.3, wingSpan: 24, speedLimit: 4, separation: 34, alignment: 26, cohesion: 22, quantity: 3};
  if (k === "fog") return {baseColor: C.bg, lowlightColor: C.c2, midtoneColor: scMix(C.c2, C.bg, 0.3), highlightColor: C.c1, blurFactor: 0.72, speed: 0.55, zoom: 0.8};
  if (k === "dots") return {color: C.lt ? C.c1 : C.c3, color2: C.c1, backgroundColor: C.bg, size: 4.2, spacing: 24, showLines: true};
  if (k === "net") return {color: C.c1, backgroundColor: C.bg, backgroundAlpha: 1, points: 11, maxDistance: 22, spacing: 16, showDots: true};
  return S3;
}
let cbForce = ""; // (a test tool's: show another class's background on the open servant)
function cbTheme() {
  if (!bg3dCls || S.tab !== "servants" || !S.selected) return null;
  const s = S.servants.find((x) => x.id === S.selected), key = s && CB_THEME[cbForce] ? cbForce : cbKey(s); if (!key) return null;
  const t = CB_THEME[key], dark = isDark(), C = cbCols(t, dark), k = BG3D_BROKEN[t.k] ? "fog" : t.k;
  return {story: false, cls: key, kind: k, css: "", opts: cbOpts(k, C, dark), a: k === "fog" ? 0.85 : 0.92};
}
const bg3dWant63 = bg3dWant;
bg3dWant = function () {
  const w = bg3dWant63.apply(this, arguments);
  if (!w || w.story) return w; // switched off, reduce motion, no WebGL, or a story scene: as it was
  return cbTheme() || w;
};
// a servant opening or closing on the Servants page, or another tab
const renderAll63 = renderAll;
renderAll = function () { const r = renderAll63.apply(this, arguments); bg3dSoon(); return r; };

/* ---------- our own vanta effects ---------- */
const CB_GLSL = `
uniform float iTime; uniform vec2 iResolution; uniform vec2 uM; uniform vec3 color; uniform vec3 color2; uniform vec3 color3; uniform vec3 backgroundColor; uniform float light;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vn(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }
`;
const CB_FRAG = {
  // Avenger: dark fire rising from below, embers drifting up
  flames: `void main() {
    vec2 uv = gl_FragCoord.xy / iResolution.xy, p = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;
    float t = iTime;
    vec2 q = vec2(p.x * 2.4 + (uM.x - 0.5) * 0.4, uv.y * 1.7 - t * 0.55);
    float n = fbm(q + vec2(0.0, fbm(q * 1.7 + t * 0.15) * 1.3));
    float f = clamp(n * 1.35 * smoothstep(1.1, 0.0, uv.y) - uv.y * 0.3, 0.0, 1.0);
    vec3 col = mix(backgroundColor, color2, smoothstep(0.2, 0.7, f) * 0.9);
    col = mix(col, color, smoothstep(0.45, 0.85, f) * 0.95);
    col = mix(col, color3, smoothstep(0.75, 1.0, f) * 0.7);
    vec2 g = vec2(p.x * 13.0, uv.y * 9.0 - t * 0.9); vec2 id = floor(g); float r = h21(id);
    vec2 fp = fract(g) - 0.5 - vec2(sin(t * 1.3 + r * 6.28) * 0.25, 0.0);
    col = mix(col, color3, smoothstep(0.09, 0.0, length(fp)) * step(0.86, r) * (1.0 - uv.y * 0.7));
    gl_FragColor = vec4(col, 1.0);
  }`,
  // Foreigner: the outer dark folding on itself, stars far behind
  void: `void main() {
    vec2 p = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y + (uM - 0.5) * vec2(0.08, -0.08);
    float t = iTime * 0.045;
    vec2 q = vec2(fbm(p * 1.6 + vec2(0.0, t)), fbm(p * 1.6 + vec2(5.2, 1.3) - t));
    vec2 r = vec2(fbm(p * 1.6 + 3.5 * q + vec2(1.7, 9.2) + t * 1.5), fbm(p * 1.6 + 3.5 * q + vec2(8.3, 2.8) - t));
    float f = fbm(p * 1.6 + 3.0 * r);
    vec3 col = mix(backgroundColor, color2, clamp(f * f * 1.9, 0.0, 1.0));
    col = mix(col, color, clamp(length(q) * 0.6 - 0.12, 0.0, 1.0) * 0.85);
    col = mix(col, color3, clamp(r.x * r.x * 1.3 - 0.28, 0.0, 1.0) * 0.6);
    float s = h21(floor(gl_FragCoord.xy / 2.5));
    col = mix(col, color3, step(0.997, s) * (0.5 + 0.5 * sin(iTime * 2.0 + s * 40.0)) * (1.0 - light * 0.5));
    col = mix(backgroundColor, col, smoothstep(1.3, 0.2, length(p)));
    gl_FragColor = vec4(col, 1.0);
  }`,
  // Shielder: a barrier of hexagons; a wave of light crosses it, a few cells glint
  hex: `void main() {
    vec2 p0 = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;
    vec2 p = p0 * 7.0 + (uM - 0.5) * vec2(0.5, -0.5);
    vec2 s = vec2(1.0, 1.7320508);
    vec4 hc = floor(vec4(p, p - vec2(0.5, 1.0)) / s.xyxy) + 0.5;
    vec4 h = vec4(p - hc.xy * s, p - (hc.zw + 0.5) * s);
    vec2 gv = dot(h.xy, h.xy) < dot(h.zw, h.zw) ? h.xy : h.zw;
    vec2 id = p - gv;
    float d = max(abs(gv.x) * 0.5 + abs(gv.y) * 0.8660254, abs(gv.x));
    float edge = smoothstep(0.42, 0.5, d);
    float pulse = pow(0.5 + 0.5 * sin(length(id) * 0.55 - iTime * 1.5), 6.0);
    float cell = h21(id); float glint = step(0.93, cell) * (0.5 + 0.5 * sin(iTime * 1.7 + cell * 20.0));
    vec3 col = mix(backgroundColor, color2, 0.12 + 0.4 * smoothstep(1.3, 0.0, length(p0)));
    col = mix(col, color, edge * (0.3 + 0.7 * pulse));
    col = mix(col, color3, (1.0 - smoothstep(0.0, 0.45, d)) * glint * 0.35 + edge * pulse * 0.25);
    gl_FragColor = vec4(col, 1.0);
  }`,
  // Ruler: light falling from above, slow rays, motes drifting down
  judgement: `void main() {
    vec2 uv = gl_FragCoord.xy / iResolution.xy;
    vec2 p = (gl_FragCoord.xy - vec2((0.5 + (uM.x - 0.5) * 0.15) * iResolution.x, 1.3 * iResolution.y)) / iResolution.y;
    float a = atan(p.x, -p.y), r = length(p);
    float rays = smoothstep(0.38, 0.85, fbm(vec2(a * 9.0, iTime * 0.12)));
    float fall = smoothstep(2.4, 0.25, r);
    vec3 col = mix(backgroundColor, color2, fall * 0.5);
    col = mix(col, color, rays * fall * 0.62);
    col = mix(col, color3, smoothstep(0.85, 0.25, r) * 0.4);
    vec2 g = vec2(uv.x * 22.0, uv.y * 13.0 + iTime * 0.22); vec2 id = floor(g); float rr = h21(id);
    vec2 fp = fract(g) - 0.5 - vec2(sin(iTime * 0.8 + rr * 6.28) * 0.22, 0.0);
    col = mix(col, color3, smoothstep(0.1, 0.0, length(fp)) * step(0.9, rr) * 0.85);
    gl_FragColor = vec4(col, 1.0);
  }`,
  // Lancer: a charge, lines of speed rushing to one point
  thrust: `void main() {
    vec2 uv = gl_FragCoord.xy / iResolution.xy;
    vec2 c = vec2(0.62 + (uM.x - 0.5) * 0.08, 0.5 - (uM.y - 0.5) * 0.08);
    vec2 p = (uv - c) * vec2(iResolution.x / iResolution.y, 1.0);
    float r = length(p), a = atan(p.y, p.x) / 6.2831853 + 0.5;
    float k = 120.0, seg = floor(a * k), ax = abs(fract(a * k) - 0.5), rnd = h21(vec2(seg, 3.1));
    float line = smoothstep(0.0025, 0.0, ax * 6.2831853 / k * r) * step(0.45, rnd);
    float d = fract(r * (1.0 + rnd) + iTime * (0.5 + rnd * 0.7) + rnd * 9.0);
    float dash = smoothstep(0.0, 0.12, d) * smoothstep(0.55, 0.12, d);
    float streak = line * dash * smoothstep(0.04, 0.3, r);
    vec3 col = mix(backgroundColor, color2, 0.3 * smoothstep(1.3, 0.0, r));
    col = mix(col, color, streak * 0.95);
    col = mix(col, color3, smoothstep(0.22, 0.0, r) * 0.55);
    gl_FragColor = vec4(col, 1.0);
  }`,
  // Beast: a storm turning, and now and then a flash
  calamity: `void main() {
    vec2 p = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y + (uM - 0.5) * vec2(0.06, -0.06);
    float t = iTime * 0.05;
    vec2 q = vec2(fbm(p * 2.0 + t), fbm(p * 2.0 - t + 4.0));
    float f = fbm(p * 2.2 + q * 2.4 + vec2(t * 2.0, -t));
    vec3 col = mix(backgroundColor, color2, smoothstep(0.22, 0.62, f));
    col = mix(col, color, smoothstep(0.45, 0.8, f) * 0.9);
    float L = abs(fbm(vec2(p.x * 3.0, p.y * 1.2 + floor(iTime * 0.08) * 7.0)) - 0.5 - p.x * 0.05);
    float flash = pow(max(0.0, sin(iTime * 0.25)), 60.0);
    col = mix(col, color3, smoothstep(0.02, 0.0, L) * flash);
    col = mix(backgroundColor, col, smoothstep(1.35, 0.3, length(p)));
    gl_FragColor = vec4(col, 1.0);
  }`,
  // Berserker: cells of red that throb with a heartbeat (vanta's cells go to black at their edge, which is grey on cream)
  frenzy: `void main() {
    vec2 q = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y, p = q * 5.0 + (uM - 0.5) * vec2(0.3, -0.3);
    float t = iTime, d1 = 8.0, d2 = 8.0;
    vec2 i = floor(p), f = fract(p);
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y)), o = vec2(h21(i + g), h21(i + g + 17.3));
      o = 0.5 + 0.38 * sin(t * 0.6 + 6.2831853 * o);
      float d = length(g + o - f);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
    }
    float edge = smoothstep(0.13, 0.0, d2 - d1);
    float beat = pow(max(sin(t * 2.2), 0.0), 10.0) + 0.6 * pow(max(sin(t * 2.2 - 0.75), 0.0), 10.0);
    float vign = smoothstep(1.35, 0.15, length(q));
    vec3 col = mix(backgroundColor, color2, (0.3 + 0.25 * beat) * (1.0 - d1) * vign);
    col = mix(col, color, edge * (0.5 + 0.45 * beat) * vign);
    col = mix(col, color3, edge * beat * 0.3 * vign);
    gl_FragColor = vec4(col, 1.0);
  }`,
  // Alter Ego: a sea of data, a grid of light seen from just above it, rolling in waves; data falling in the dark above
  // (vanta's ripple was the first pick: its shader takes 400 steps for every pixel, too hot for a background)
  datasea: `void main() {
    vec2 uv = gl_FragCoord.xy / iResolution.xy;
    float asp = iResolution.x / iResolution.y, t = iTime, hz = 0.6 + (uM.y - 0.5) * 0.04;
    vec3 col = mix(backgroundColor, color2, 0.45 * smoothstep(0.45, 0.0, abs(uv.y - hz)));
    float cx = floor(uv.x * 70.0), rnd = h21(vec2(cx, 4.2));
    float yy = fract(uv.y * (0.6 + rnd) + t * (0.06 + rnd * 0.1) + rnd * 7.0);
    float rain = step(0.8, rnd) * smoothstep(0.0, 0.2, yy) * smoothstep(0.35, 0.2, yy) * step(hz, uv.y) * step(abs(fract(uv.x * 70.0) - 0.5), 0.2);
    col = mix(col, color3, rain * 0.45 * smoothstep(1.0, hz, uv.y));
    if (uv.y < hz) {
      // (3 lines to a unit; each line about a pixel and a half wide however far off it is)
      float d = hz - uv.y, z = 0.32 / d;
      float x = (uv.x - 0.5 - (uM.x - 0.5) * 0.05) * asp * z * 3.0, zz = (z + t * 0.8) * 3.0;
      float wave = pow(0.5 + 0.5 * sin(zz * 0.7 - x * 0.06 + t * 0.9), 2.0) * (0.7 + 0.3 * sin(x * 0.09 + t * 0.4));
      float wx = 0.012 + 0.009 * z, wz = min(0.45, 0.012 + 0.02 * z * z), fade = smoothstep(9.0, 1.6, z);
      float grid = max(smoothstep(wx, 0.0, 0.5 - abs(fract(x) - 0.5)), smoothstep(wz, 0.0, 0.5 - abs(fract(zz) - 0.5)));
      col = mix(col, mix(color2, color, 0.45), fade * wave * 0.6);
      col = mix(col, color, step(0.93, h21(floor(vec2(x, zz)))) * fade * wave * 0.6);
      col = mix(col, color, grid * fade * (0.45 + 0.55 * wave));
      col = mix(col, color3, grid * fade * pow(wave, 4.0) * 0.75);
    }
    gl_FragColor = vec4(col, 1.0);
  }`,
  // Caster: a magic circle turning, rings and runes, a six-pointed star inside, breathing slowly
  magecraft: `void main() {
    vec2 c = vec2(0.64 + (uM.x - 0.5) * 0.05, 0.5 - (uM.y - 0.5) * 0.05);
    vec2 p = (gl_FragCoord.xy / iResolution.xy - c) * vec2(iResolution.x / iResolution.y, 1.0);
    float r = length(p), a = atan(p.y, p.x), t = iTime, w = 0.0045, pulse = 0.65 + 0.35 * sin(t * 0.9);
    vec3 col = mix(backgroundColor, color2, 0.4 * smoothstep(0.85, 0.0, r));
    float ring = smoothstep(w, 0.0, abs(r - 0.43)) + smoothstep(w, 0.0, abs(r - 0.385)) + smoothstep(w, 0.0, abs(r - 0.25)) + smoothstep(w, 0.0, abs(r - 0.13));
    float k1 = fract((a + t * 0.12) / 6.2831853 * 60.0);
    float tick = step(0.39, r) * step(r, 0.425) * smoothstep(0.12, 0.0, abs(k1 - 0.5) - 0.05);
    float a2 = (a - t * 0.07) / 6.2831853 * 28.0, s = floor(a2), kf = fract(a2);
    float rune = step(0.272, r) * step(r, 0.36) * step(0.18, kf) * step(kf, 0.82) * step(0.45, h21(vec2(s, floor((r - 0.272) / 0.022))));
    float R = 0.25, rot = t * 0.05;
    float e1 = abs(r * cos(mod(a - rot, 2.0943951) - 1.0471976) - R * 0.5), e2 = abs(r * cos(mod(a - rot + 1.0471976, 2.0943951) - 1.0471976) - R * 0.5);
    float star = (smoothstep(w, 0.0, e1) + smoothstep(w, 0.0, e2)) * step(r, R);
    col = mix(col, color, clamp(ring + star, 0.0, 1.0) * (0.75 + 0.25 * pulse));
    col = mix(col, color, tick * 0.8);
    col = mix(col, color3, rune * 0.5);
    col = mix(col, color3, smoothstep(0.09, 0.0, abs(r - 0.405)) * 0.18 * pulse);
    vec2 g = gl_FragCoord.xy / iResolution.y * 14.0 + vec2(0.0, -t * 0.25); vec2 id = floor(g); float rr = h21(id);
    col = mix(col, color3, smoothstep(0.08, 0.0, length(fract(g) - 0.5)) * step(0.93, rr) * (0.5 + 0.5 * sin(t * 2.0 + rr * 30.0)) * 0.7);
    gl_FragColor = vec4(col, 1.0);
  }`,
  // Draco, Sodom's Beast: a crimson vortex around an eye of light, gold petals falling
  draco: `void main() {
    vec2 uv = gl_FragCoord.xy / iResolution.xy;
    vec2 p = (gl_FragCoord.xy - vec2(0.6, 0.5) * iResolution.xy) / iResolution.y + (uM - 0.5) * vec2(0.06, -0.06);
    float r = length(p), an = iTime * 0.07 + r * 2.2;
    vec2 pr = mat2(cos(an), -sin(an), sin(an), cos(an)) * p;
    float f = fbm(pr * 2.6 + vec2(iTime * 0.05, 0.0));
    vec3 col = mix(backgroundColor, color2, smoothstep(0.32, 0.75, f) * (1.0 - r * 0.35));
    col = mix(col, color, smoothstep(0.58, 0.85, f) * 0.85);
    col = mix(col, color3, smoothstep(0.3, 0.0, r) * 0.35);
    vec2 g = vec2(uv.x * 11.0 + sin(uv.y * 3.0 + iTime * 0.3) * 0.4, uv.y * 7.0 + iTime * 0.33);
    vec2 id = floor(g); float rr = h21(id); float ro = rr * 6.28 + iTime * (0.5 + rr);
    vec2 fp = mat2(cos(ro), -sin(ro), sin(ro), cos(ro)) * (fract(g) - 0.5);
    col = mix(col, color3, smoothstep(0.11, 0.0, length(fp * vec2(1.0, 2.4))) * step(0.8, rr) * 0.9);
    gl_FragColor = vec4(col, 1.0);
  }`,
  // Space Ereshkigal: stars streaming past, the ring of her underworld turning around a dark heart
  speresh: `void main() {
    vec2 c = vec2(0.64 + (uM.x - 0.5) * 0.06, 0.52 - (uM.y - 0.5) * 0.06);
    vec2 p = (gl_FragCoord.xy / iResolution.xy - c) * vec2(iResolution.x / iResolution.y, 1.0);
    float r = length(p), a = atan(p.y, p.x) / 6.2831853 + 0.5;
    vec3 col = mix(backgroundColor, color2, 0.4 * smoothstep(1.4, 0.1, r) * (0.6 + 0.4 * fbm(p * 3.0 + iTime * 0.03)));
    for (int i = 0; i < 2; i++) {
      float k = 90.0 + float(i) * 70.0, seg = floor(a * k), ax = abs(fract(a * k) - 0.5), rnd = h21(vec2(seg, 1.7 + float(i) * 5.0));
      float z = fract(rnd * 9.1 + iTime * (0.05 + rnd * 0.07)), rs = 0.1 + z * z * 1.5, len = 0.015 + z * 0.16;
      float on = step(r, rs) * step(rs - len, r) * smoothstep(0.003, 0.0, ax * 6.2831853 / k * r) * step(0.4, rnd);
      col = mix(col, color3, on * z);
    }
    float ring = smoothstep(0.012, 0.0, abs(r - 0.33 - 0.012 * sin(a * 6.2831853 * 6.0 + iTime)));
    col = mix(col, mix(backgroundColor, color, light * 0.16), smoothstep(0.33, 0.29, r) * 0.9);
    col = mix(col, color, ring * 0.95);
    col = mix(col, color, smoothstep(0.16, 0.0, abs(r - 0.33)) * 0.35);
    gl_FragColor = vec4(col, 1.0);
  }`
};
let cbReady = false;
function cbRegister() {
  if (cbReady) return; cbReady = true;
  const V = window.VANTA, T = window.THREE; if (!V || !V.VantaBase || !T) return;
  const col = (v) => new T.Color(v);
  /* a full-window shader, the way vanta's own shader effects are made */
  const shader = (name, frag) => {
    class E extends V.VantaBase {
      getDefaultOptions() { return {backgroundColor: 0x000000, color: 0xffffff, color2: 0x888888, color3: 0xffffff, light: 0, speed: 1, mouseEase: true}; }
      onInit() {
        this.uniforms = {iTime: {value: 1}, iResolution: {value: new T.Vector2(1, 1)}, iMouse: {value: new T.Vector2(0, 0)}, uM: {value: new T.Vector2(0.5, 0.5)}, color: {value: col(0)}, color2: {value: col(0)}, color3: {value: col(0)}, backgroundColor: {value: col(0)}, light: {value: 0}};
        this.cbSet();
        const m = new T.ShaderMaterial({uniforms: this.uniforms, vertexShader: "void main() { gl_Position = vec4(position, 1.0); }", fragmentShader: CB_GLSL + frag, depthTest: false, depthWrite: false});
        this.scene.add(new T.Mesh(new T.PlaneGeometry(2, 2), m));
        this.camera = new T.Camera(); this.camera.position.z = 1;
      }
      cbSet() { const o = this.options, u = this.uniforms; if (!u) return; ["color", "color2", "color3", "backgroundColor"].forEach((k) => u[k].value.set(o[k])); u.light.value = o.light ? 1 : 0; }
      setOptions(o) { super.setOptions(o); this.cbSet(); }
      onMouseMove(x, y) { if (this.uniforms) this.uniforms.uM.value.set(x, y); }
      onResize() { if (this.uniforms && this.renderer) this.renderer.getDrawingBufferSize(this.uniforms.iResolution.value); }
    }
    V.register(name.toUpperCase(), E);
  };
  Object.keys(CB_FRAG).forEach((k) => shader(k, CB_FRAG[k]));
  /* pieces in a 3D space: swords for Saber, arrows for Archer */
  const pieces = (name, cfg) => {
    class E extends V.VantaBase {
      getDefaultOptions() { return {backgroundColor: 0x000000, color: 0xffffff, color2: 0x888888, color3: 0xffffff, light: 0, mouseEase: true}; }
      onInit() {
        const o = this.options;
        this.camera = new T.PerspectiveCamera(45, this.width / this.height, 1, 3000);
        this.camera.position.set(0, 0, 640); this.cx = 0; this.cy = 0;
        this.scene.fog = new T.Fog(col(o.backgroundColor), cfg.fog[0], cfg.fog[1]);
        this.mat = cfg.mat(T, o);
        this.mesh = new T.InstancedMesh(cfg.geo(T), this.mat, cfg.n);
        this.dummy = new T.Object3D();
        this.p = [];
        for (let i = 0; i < cfg.n; i++) { this.p.push(cfg.seed(i)); this.mesh.setColorAt(i, col(i % 3 === 0 ? o.color3 : o.color)); }
        this.scene.add(this.mesh);
        this.lights = cfg.lights ? cfg.lights(T, o, this.scene) : [];
        this.place(0);
      }
      place(dt) {
        const d = this.dummy;
        this.p.forEach((q, i) => { cfg.move(q, dt); d.position.set(q.x, q.y, q.z); d.rotation.set(q.rx, q.ry, q.rz); d.scale.setScalar(q.s || 1); d.updateMatrix(); this.mesh.setMatrixAt(i, d.matrix); });
        this.mesh.instanceMatrix.needsUpdate = true;
      }
      onUpdate() {
        const now = performance.now(), dt = this.lastT ? Math.min(4, (now - this.lastT) / (1000 / 60)) : 1; this.lastT = now;
        this.place(dt);
        const c = this.camera; c.position.x += (this.cx * 60 - c.position.x) * 0.05; c.position.y += (-this.cy * 40 - c.position.y) * 0.05; c.lookAt(0, 0, 0);
      }
      onMouseMove(x, y) { this.cx = x - 0.5; this.cy = y - 0.5; }
      setOptions(o) {
        super.setOptions(o); const p = this.options; if (!this.mesh) return;
        for (let i = 0; i < cfg.n; i++) this.mesh.setColorAt(i, col(i % 3 === 0 ? p.color3 : p.color));
        if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
        if (this.scene.fog) this.scene.fog.color.set(p.backgroundColor);
        if (cfg.recolour) cfg.recolour(T, this.mat, this.lights, p);
      }
    }
    V.register(name.toUpperCase(), E);
  };
  const rnd = (a, b) => a + Math.random() * (b - a);
  pieces("blades", {n: 64, fog: [420, 1500],
    geo: (T) => { const g = new T.OctahedronGeometry(1, 0); g.scale(9, 95, 2.2); return g; },
    mat: (T, o) => new T.MeshPhongMaterial({color: 0xffffff, emissive: col(o.color2), emissiveIntensity: o.light ? 0.2 : 0.8, specular: col(o.color3), shininess: 90, flatShading: true}),
    lights: (T, o, sc) => { const a = new T.AmbientLight(0xffffff, o.light ? 0.75 : 0.45), d = new T.DirectionalLight(col(o.color3), 1.3), p = new T.PointLight(col(o.color), 0.9, 1600); d.position.set(300, 500, 400); p.position.set(-200, -100, 300); sc.add(a, d, p); return [a, d, p]; },
    recolour: (T, m, L, o) => { m.emissive.set(o.color2); m.specular.set(o.color3); L[1].color.set(o.color3); L[2].color.set(o.color); },
    seed: () => ({x: rnd(-620, 620), y: rnd(-480, 480), z: rnd(-900, 180), rx: rnd(-0.25, 0.25) + Math.PI, ry: rnd(0, 6.28), rz: rnd(-0.3, 0.3), vy: rnd(0.25, 0.7), vr: rnd(-0.012, 0.012) || 0.006, s: rnd(0.7, 1.3)}),
    move: (q, dt) => { q.y += q.vy * dt; q.ry += q.vr * dt; if (q.y > 540) { q.y = -540; q.x = rnd(-620, 620); } }});
  pieces("arrows", {n: 130, fog: [380, 1500],
    geo: (T) => { const g = new T.CylinderGeometry(0.9, 0.9, 120, 4, 1); g.rotateZ(-0.5); g.rotateX(0.25); return g; },
    mat: (T, o) => new T.MeshBasicMaterial({color: 0xffffff, transparent: true, opacity: o.light ? 0.8 : 0.9, blending: o.light ? T.NormalBlending : T.AdditiveBlending, depthWrite: false, fog: true}),
    seed: () => ({x: rnd(-800, 800), y: rnd(-560, 560), z: rnd(-1000, 160), rx: 0, ry: 0, rz: 0, v: rnd(6, 12), s: rnd(0.6, 1.4)}),
    move: (q, dt) => { q.x += q.v * 0.48 * dt; q.y -= q.v * dt; q.z += q.v * 0.12 * dt; if (q.y < -600 || q.x > 900) { q.y = rnd(560, 700); q.x = rnd(-1000, 500); q.z = rnd(-1000, 160); } }});
}
const bg3dLoad63 = bg3dLoad;
bg3dLoad = function () { const ok = bg3dLoad63.apply(this, arguments); if (ok) { try { cbRegister(); } catch (e) { console.error(e); } } return ok; };

/* ---------- Settings ---------- */
function cbPaint() {
  document.querySelectorAll('[data-action="bg3d-cls"]').forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.v === "1") === bg3dCls)));
}
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest('[data-action="bg3d-cls"]'); if (!b) return;
  const on = b.dataset.v === "1"; if (on === bg3dCls) return;
  bg3dCls = on; try { if (on) localStorage.removeItem(BG3D_CLS_KEY); else localStorage.setItem(BG3D_CLS_KEY, "off"); } catch (e2) {}
  cbPaint(); bg3dSync();
});
const renderSettings63 = typeof renderSettings === "function" ? renderSettings : null;
if (renderSettings63) renderSettings = function () { const r = renderSettings63.apply(this, arguments); cbPaint(); return r; };
cbPaint();
window.__fgiCls = {key: (s) => cbKey(s), theme: () => cbTheme(), themes: () => CB_THEME, on: () => bg3dCls,
  open: () => { const s = S.servants.find((x) => x.id === S.selected); return s ? {id: s.id, cls: s.cls, name: s.name, key: cbKey(s)} : null; },
  roster: () => S.servants.map((s) => [s.id, s.cls, s.name]), force: (k) => { cbForce = k || ""; bg3dSoon(); }};
